#!/usr/bin/env node
/**
 * scripts/modernize-mpp-openapi.js
 *
 * Fetches the live OpenAPI spec (or generates it locally as a fallback),
 * modernises x-payment-info fields so every paid operation carries both
 * `protocol` and `protocols`, then writes the result to public/openapi.json.
 *
 * Usage:
 *   node scripts/modernize-mpp-openapi.js
 *   OPENAPI_URL=http://localhost:3000/openapi.json node scripts/modernize-mpp-openapi.js
 */

const fs   = require("fs");
const path = require("path");

const SOURCE_URL = process.env.OPENAPI_URL || "https://hawaii-conditions.vercel.app/openapi.json";
const OUT_FILE   = path.resolve(__dirname, "../public/openapi.json");
const SERVER_URL = process.env.SERVER_URL  || "https://hawaii-conditions.vercel.app";

/**
 * Normalises a single x-payment-info object so it always has both
 * `protocol: "stripe-card-prepaid"` and `protocols: ["stripe-card-prepaid"]`.
 *
 * Handles two shapes:
 *  - Flat:  { price, currency, billing, protocols?, ... }
 *  - Array: { options: [{ protocol?, protocols?, price, ... }] }
 */
function convertPaymentInfo(info) {
  if (!info || typeof info !== "object") return info;
  const result = { ...info };

  // Flat format — price is a top-level field
  if (result.price !== undefined) {
    result.protocol  = "stripe-card-prepaid";
    result.protocols = ["stripe-card-prepaid"];
  }

  // Options-array format
  if (Array.isArray(result.options)) {
    result.options = result.options.map((opt) => {
      const o = { ...opt };
      o.protocol  = o.protocol  || "stripe-card-prepaid";
      o.protocols = o.protocols || [o.protocol];
      return o;
    });
  }

  return result;
}

function processSpec(spec) {
  if (!spec || !spec.paths) return spec;
  for (const pathItem of Object.values(spec.paths)) {
    for (const operation of Object.values(pathItem)) {
      if (!operation || typeof operation !== "object") continue;
      if (operation["x-payment-info"]) {
        operation["x-payment-info"] = convertPaymentInfo(operation["x-payment-info"]);
      }
    }
  }
  return spec;
}

// ── Local spec builder ────────────────────────────────────────────────────────
// Mirrors app/openapi.json/route.ts so the script works without a live server.

function buildLocalSpec() {
  const ISLAND_ENUM = ["oahu", "maui", "kauai", "big-island", "molokai", "lanai"];
  const islandProp  = { type: "string", enum: ISLAND_ENUM };

  const paid = (price) => ({
    price,
    currency: "USD",
    protocols: ["stripe-card-prepaid"],
    protocol:  "stripe-card-prepaid",
    pricingMode: "fixed",
    billing: "prepaid_balance",
    accountHeader: "X-MCP-Account",
  });

  const free = {
    price: 0,
    currency: "USD",
    protocols: ["stripe-card-prepaid"],
    protocol:  "stripe-card-prepaid",
    pricingMode: "fixed",
    billing: "free",
  };

  const paidSecurity = [{ McpPrepaidAccount: [] }, { MppPayment: [] }];
  const freeSecurity = [];

  const islandParam = { name: "island", in: "query", required: false,
    schema: { type: "string", enum: ISLAND_ENUM, default: "oahu" } };

  const accountParam = { name: "X-MCP-Account", in: "header", required: false,
    schema: { type: "string", pattern: "^mcp_live_" },
    description: "Your prepaid API key (format: mcp_live_…). Register via register_agent." };

  function paidOp(operationId, summary, payInfo, parameters, requestBody) {
    const op = { operationId, summary, tags: ["Hawaii Conditions"],
      "x-payment-info": payInfo, parameters, security: paidSecurity,
      responses: { "200": { description: "Success" }, "402": { description: "Payment required" } } };
    if (requestBody) op.requestBody = requestBody;
    return op;
  }

  function freeOp(operationId, summary, parameters, requestBody) {
    const op = { operationId, summary, tags: ["Hawaii Conditions"],
      "x-payment-info": free, parameters, security: freeSecurity,
      responses: { "200": { description: "Success" } } };
    if (requestBody) op.requestBody = requestBody;
    return op;
  }

  function body(schema) {
    return { required: true, content: { "application/json": { schema } } };
  }

  const islandBody   = body({ type: "object", properties: { island: islandProp } });
  const volcanoBody  = body({ type: "object", properties: {}, required: [] });
  const sunTimesBody = body({ type: "object", properties: {
    island: islandProp, date: { type: "string", format: "date" } } });
  const moonBody     = body({ type: "object", properties: {
    island: islandProp, date: { type: "string", format: "date" } } });

  return {
    openapi: "3.1.0",
    info: {
      title:       "HawaiiConditions",
      version:     "1.0.0",
      description: "HawaiiConditions — real-time Hawaii conditions with prepaid-balance payments via Stripe card.",
    },
    paths: {
      "/api/mcp": {
        get:  { operationId: "mcp_info",    summary: "MCP server info and tool list",                   tags: ["MCP"], "x-payment-info": free, security: [],           responses: { "200": { description: "Server info and tools" } } },
        post: { operationId: "mcp_message", summary: "Send MCP JSON-RPC 2.0 message",                   tags: ["MCP"], "x-payment-info": free, security: [],           responses: { "200": { description: "Message processed" }, "402": { description: "Payment required" } },
          requestBody: body({ type: "object", properties: { jsonrpc: { type: "string" }, method: { type: "string" } }, required: ["jsonrpc", "method"] }) },
      },
      "/gpt/weather": {
        get:  paidOp("get_weather",      "Get current Hawaii weather conditions",        paid(0.10), [accountParam, islandParam]),
        post: paidOp("post_weather",     "Get current Hawaii weather conditions (POST)", paid(0.10), [accountParam], islandBody),
      },
      "/gpt/surf": {
        get:  paidOp("get_surf",         "Get Hawaii surf conditions",                   paid(0.10), [accountParam, islandParam]),
        post: paidOp("post_surf",        "Get Hawaii surf conditions (POST)",            paid(0.10), [accountParam], islandBody),
      },
      "/gpt/volcano": {
        get:  { ...paidOp("get_volcano",  "Get Hawaii volcanic activity status",          paid(0.25), [accountParam]),
          "x-input-schema": { type: "object", properties: {}, required: [] } },
        post: { ...paidOp("post_volcano", "Get Hawaii volcanic activity status (POST)",   paid(0.25), [accountParam], volcanoBody),
          "x-input-schema": { type: "object", properties: {}, required: [] } },
      },
      "/gpt/trails": {
        get:  paidOp("get_trails",       "Get Hawaii trail conditions",                  paid(0.25), [accountParam, islandParam]),
        post: paidOp("post_trails",      "Get Hawaii trail conditions (POST)",           paid(0.25), [accountParam], islandBody),
      },
      "/gpt/ocean-safety": {
        get:  paidOp("get_ocean_safety",  "Get Hawaii ocean safety conditions",          paid(0.50), [accountParam, islandParam]),
        post: paidOp("post_ocean_safety", "Get Hawaii ocean safety conditions (POST)",   paid(0.50), [accountParam], islandBody),
      },
      "/gpt/sun-times": {
        get:  freeOp("get_sun_times",    "Get Hawaii sunrise and sunset times — Free",   [accountParam, islandParam,
          { name: "date", in: "query", required: false, schema: { type: "string", format: "date" } }]),
        post: freeOp("post_sun_times",   "Get Hawaii sunrise and sunset times (POST) — Free", [accountParam], sunTimesBody),
      },
      "/gpt/moon-phase": {
        get:  freeOp("get_moon_phase",   "Get Hawaii moon phase — Free",                [accountParam, islandParam,
          { name: "date", in: "query", required: false, schema: { type: "string", format: "date" } }]),
        post: freeOp("post_moon_phase",  "Get Hawaii moon phase (POST) — Free",         [accountParam], moonBody),
      },
      "/gpt/briefing": {
        get:  paidOp("get_briefing",     "Get full Hawaii conditions briefing",          paid(2.00), [accountParam, islandParam]),
        post: paidOp("post_briefing",    "Get full Hawaii conditions briefing (POST)",   paid(2.00), [accountParam], islandBody),
      },
      "/gpt/restaurants": {
        get:  paidOp("get_restaurants",  "Search Hawaii restaurants",                   paid(0.25), [accountParam,
          { name: "location", in: "query", required: true,  schema: { type: "string" } },
          { name: "cuisine",  in: "query", required: false, schema: { type: "string" } },
          { name: "price",    in: "query", required: false, schema: { type: "string", enum: ["$","$$","$$$","$$$$"] } },
          { name: "open_now", in: "query", required: false, schema: { type: "boolean" } },
        ]),
        post: paidOp("post_restaurants", "Search Hawaii restaurants (POST)",             paid(0.25), [accountParam],
          body({ type: "object", required: ["location"], properties: {
            location: { type: "string" }, cuisine: { type: "string" },
            price:    { type: "string" }, open_now: { type: "boolean" } } })),
      },
      "/gpt/restaurant": {
        get:  paidOp("get_restaurant",   "Get details for a specific Hawaii restaurant", paid(0.15), [accountParam,
          { name: "place_id", in: "query", required: true, schema: { type: "string" } }]),
        post: paidOp("post_restaurant",  "Get details for a specific Hawaii restaurant (POST)", paid(0.15), [accountParam],
          body({ type: "object", required: ["place_id"], properties: { place_id: { type: "string" } } })),
      },
    },
    components: {
      securitySchemes: {
        McpPrepaidAccount: {
          type: "apiKey", in: "header", name: "X-MCP-Account",
          description: `Prepaid account key (format: mcp_live_…). Register via register_agent at ${SERVER_URL}/mcp`,
        },
        MppPayment: {
          type: "http", scheme: "bearer", bearerFormat: "MPP",
          description: "MPP payment credential issued after a 402 challenge.",
        },
      },
    },
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  let spec;

  try {
    console.log("Fetching " + SOURCE_URL + " …");
    const res = await fetch(SOURCE_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    spec = await res.json();
    console.log("Fetched remote spec.");
  } catch (err) {
    console.warn("Remote fetch failed (" + err.message + "); using local spec.");
    spec = buildLocalSpec();
  }

  const modernised = processSpec(spec);

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(modernised, null, 2) + "\n");
  console.log("Wrote " + OUT_FILE);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
