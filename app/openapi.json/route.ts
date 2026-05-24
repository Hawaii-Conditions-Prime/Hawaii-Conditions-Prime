import { NextResponse } from "next/server";
import { toRequestBody, sharedAuthHeader, inputSchema } from "@/lib/tool-schemas";

export async function GET() {
  const paymentLink = process.env.STRIPE_PAYMENT_LINK ?? "";
  const toolName = process.env.MCP_TOOL_NAME ?? "HawaiiConditions";
  const rawServerUrl = process.env.SERVER_URL ?? "https://hawaii-conditions-prime.vercel.app";
  const serverUrl = rawServerUrl.replace(/\/+$/, "");
  const hostname = new URL(serverUrl).hostname;

  const islandParam = {
    name: "island",
    in: "query" as const,
    required: false,
    schema: { type: "string", enum: ["oahu", "maui", "kauai", "big-island", "molokai", "lanai"], default: "oahu" },
    description: "Hawaii island to query",
  };

  const mcpAccountParam = {
    name: "X-MCP-Account",
    in: "header" as const,
    required: true,
    schema: sharedAuthHeader["X-MCP-Account"],
    description: sharedAuthHeader["X-MCP-Account"].description,
  };

  const mcpJsonRpcSchema = {
    type: "object",
    description: "MCP JSON-RPC 2.0 message",
    properties: {
      jsonrpc: { type: "string", example: "2.0" },
      id: { oneOf: [{ type: "string" }, { type: "number" }] },
      method: { type: "string" },
      params: { type: "object", additionalProperties: true },
    },
    required: ["jsonrpc", "method"],
  };

  const paymentChallenge402 = {
    description: "Payment Required — register an account and add funds to continue",
    headers: {
      "WWW-Authenticate": {
        schema: { type: "string" },
        description: `Payment method="stripe-card-prepaid" intent="fund" realm="${hostname}" register="${serverUrl}/mcp"`,
      },
    },
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["error", "payment"],
          properties: {
            error: { type: "string", enum: ["payment_required"] },
            input_schema: {
              type: "object",
              description: "JSON Schema of the tool's input parameters",
            },
            payment: {
              type: "object",
              required: ["provider", "payment_method", "model", "currency", "funding_amounts", "account_header", "register_endpoint", "funding_tools"],
              properties: {
                provider:          { type: "string", example: "stripe" },
                payment_method:    { type: "string", example: "card" },
                model:             { type: "string", example: "prepaid_balance" },
                currency:          { type: "string", example: "usd" },
                funding_amounts:   { type: "array", items: { type: "string" }, example: ["5.00", "10.00", "20.00"] },
                account_header:    { type: "string", example: "X-MCP-Account" },
                register_endpoint: { type: "string", example: "/mcp" },
                funding_tools:     { type: "array", items: { type: "string" }, example: ["add_funds_5", "add_funds_10", "add_funds_20"] },
                checkout_url:      { type: "string", format: "uri", example: paymentLink },
              },
            },
          },
        },
      },
    },
  };

  const stripePrepaidInfo = (price: string, billing = "prepaid_balance") => ({
    authMode: "apiKey",
    price,
    currency: "USD",
    protocol: "stripe-card-prepaid",
    protocols: ["stripe-card-prepaid"],
    pricingMode: "fixed",
    billing,
    accountHeader: "X-MCP-Account",
    options: [
      {
        authMode: "apiKey",
        price,
        currency: "USD",
        protocol: "stripe-card-prepaid",
        protocols: ["stripe-card-prepaid"],
        pricingMode: "fixed",
        billing,
        accountHeader: "X-MCP-Account",
      },
    ],
  });

  const freeInfo = {
    authMode: "apiKey",
    price: "0.00",
    currency: "USD",
    protocol: "stripe-card-prepaid",
    protocols: ["stripe-card-prepaid"],
    pricingMode: "fixed",
    billing: "free",
    options: [
      {
        authMode: "apiKey",
        price: "0.00",
        currency: "USD",
        protocol: "stripe-card-prepaid",
        protocols: ["stripe-card-prepaid"],
        pricingMode: "fixed",
        billing: "free",
      },
    ],
  };

  const publicFreeInfo = {
    authMode: "none",
    price: "0.00",
    currency: "USD",
    protocol: "none",
    protocols: ["none"],
    pricingMode: "fixed",
    billing: "free",
    options: [
      {
        authMode: "none",
        price: "0.00",
        currency: "USD",
        protocol: "none",
        protocols: ["none"],
        pricingMode: "fixed",
        billing: "free",
      },
    ],
  };

  const p10 = stripePrepaidInfo("0.10");
  const p15 = stripePrepaidInfo("0.15");
  const p25 = stripePrepaidInfo("0.25");
  const p50 = stripePrepaidInfo("0.50");
  const p200 = stripePrepaidInfo("2.00");

  const paidSecurity = [{ McpPrepaidAccount: [] }, { MppPayment: [] }];
  const freeAuthenticatedSecurity = [{ McpPrepaidAccount: [] }];

  const spec = {
    openapi: "3.1.0",
    info: {
      title: toolName,
      version: "1.0.0",
      description: `${toolName} is a real-time conditions API for the Hawaiian Islands, built for AI travel agents, concierge bots, itinerary planners, hotel assistants, tourism apps, and personal AI assistants. Use it to help users plan safer beach days, surfing sessions, hikes, and restaurant outings across Oʻahu, Maui, Kauaʻi, Hawaiʻi Island, Molokaʻi, and Lānaʻi. Available data: current weather, surf conditions, ocean safety advisories, trail status, volcanic activity, sunrise/sunset times, moon phase, restaurant search, restaurant details, and full island briefings. Paid tools use a Stripe prepaid balance via X-MCP-Account header.`,
      "x-guidance": `Use get_full_briefing for a complete island overview before building a day-by-day itinerary. Use search_restaurants to find dining options by location, cuisine, or price range, then get_restaurant_details for hours, ratings, and contact info. Use get_weather, get_surf_conditions, get_ocean_safety, get_trail_status, and get_volcano_status to refine plans for specific activities. Use get_sun_times (free) and get_moon_phase (free) to anchor sunrise, sunset, and lunar context into itineraries. All paid tools require an X-MCP-Account header (Stripe prepaid balance). No token → 402 challenge. Register via register_agent tool at: ${serverUrl}/mcp`,
    },
    "x-discovery": {
      ownershipProofs: [] as string[],
    },
    paths: {
      "/api/mcp": {
        get: {
          operationId: "mcp_info",
          summary: "MCP server info and tool list",
          tags: ["MCP"],
          "x-payment-info": freeInfo,
          "x-input-schema": mcpJsonRpcSchema,
          parameters: [mcpAccountParam],
          security: freeAuthenticatedSecurity,
          responses: {
            "200": { description: "Server info and tools", content: { "application/json": {} } },
          },
        },
        post: {
          operationId: "mcp_message",
          summary: "Send MCP JSON-RPC 2.0 message (paid tools require X-MCP-Account)",
          tags: ["MCP"],
          "x-payment-info": freeInfo,
          "x-input-schema": mcpJsonRpcSchema,
          parameters: [mcpAccountParam],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: mcpJsonRpcSchema,
              },
            },
          },
          responses: {
            "200": { description: "Message processed" },
            "402": paymentChallenge402,
          },
          security: freeAuthenticatedSecurity,
        },
      },

      "/gpt/weather": {
        get: {
          operationId: "get_weather",
          summary: "Get current Hawaii weather conditions",
          tags: ["Hawaii Conditions"],
          "x-payment-info": p10,
          "x-input-schema": inputSchema("get_weather"),
          parameters: [mcpAccountParam, islandParam],
          responses: {
            "200": { description: "Current weather conditions" },
            "402": paymentChallenge402,
          },
          security: paidSecurity,
        },
        post: {
          operationId: "post_weather",
          summary: "Get current Hawaii weather conditions (POST)",
          tags: ["Hawaii Conditions"],
          "x-payment-info": p10,
          "x-input-schema": inputSchema("get_weather"),
          parameters: [mcpAccountParam],
          requestBody: toRequestBody("get_weather"),
          responses: {
            "200": { description: "Current weather conditions" },
            "402": paymentChallenge402,
          },
          security: paidSecurity,
        },
      },

      "/gpt/surf": {
        get: {
          operationId: "get_surf",
          summary: "Get Hawaii surf conditions",
          tags: ["Hawaii Conditions"],
          "x-payment-info": p10,
          "x-input-schema": inputSchema("get_surf_conditions"),
          parameters: [mcpAccountParam, islandParam],
          responses: {
            "200": { description: "Surf conditions" },
            "402": paymentChallenge402,
          },
          security: paidSecurity,
        },
        post: {
          operationId: "post_surf",
          summary: "Get Hawaii surf conditions (POST)",
          tags: ["Hawaii Conditions"],
          "x-payment-info": p10,
          "x-input-schema": inputSchema("get_surf_conditions"),
          parameters: [mcpAccountParam],
          requestBody: toRequestBody("get_surf_conditions"),
          responses: {
            "200": { description: "Surf conditions" },
            "402": paymentChallenge402,
          },
          security: paidSecurity,
        },
      },

      "/gpt/volcano": {
        get: {
          operationId: "get_volcano",
          summary: "Get Hawaii volcanic activity status",
          tags: ["Hawaii Conditions"],
          "x-payment-info": p25,
          "x-input-schema": inputSchema("get_volcano_status"),
          parameters: [mcpAccountParam],
          responses: {
            "200": { description: "Volcanic activity status" },
            "402": paymentChallenge402,
          },
          security: paidSecurity,
        },
        post: {
          operationId: "post_volcano",
          summary: "Get Hawaii volcanic activity status (POST)",
          tags: ["Hawaii Conditions"],
          "x-payment-info": p25,
          "x-input-schema": inputSchema("get_volcano_status"),
          parameters: [mcpAccountParam],
          requestBody: toRequestBody("get_volcano_status", false),
          responses: {
            "200": { description: "Volcanic activity status" },
            "402": paymentChallenge402,
          },
          security: paidSecurity,
        },
      },

      "/gpt/trails": {
        get: {
          operationId: "get_trails",
          summary: "Get Hawaii trail conditions",
          tags: ["Hawaii Conditions"],
          "x-payment-info": p25,
          "x-input-schema": inputSchema("get_trail_status"),
          parameters: [mcpAccountParam, islandParam],
          responses: {
            "200": { description: "Trail conditions" },
            "402": paymentChallenge402,
          },
          security: paidSecurity,
        },
        post: {
          operationId: "post_trails",
          summary: "Get Hawaii trail conditions (POST)",
          tags: ["Hawaii Conditions"],
          "x-payment-info": p25,
          "x-input-schema": inputSchema("get_trail_status"),
          parameters: [mcpAccountParam],
          requestBody: toRequestBody("get_trail_status"),
          responses: {
            "200": { description: "Trail conditions" },
            "402": paymentChallenge402,
          },
          security: paidSecurity,
        },
      },

      "/gpt/ocean-safety": {
        get: {
          operationId: "get_ocean_safety",
          summary: "Get Hawaii ocean safety conditions",
          tags: ["Hawaii Conditions"],
          "x-payment-info": p50,
          "x-input-schema": inputSchema("get_ocean_safety"),
          parameters: [mcpAccountParam, islandParam],
          responses: {
            "200": { description: "Ocean safety conditions" },
            "402": paymentChallenge402,
          },
          security: paidSecurity,
        },
        post: {
          operationId: "post_ocean_safety",
          summary: "Get Hawaii ocean safety conditions (POST)",
          tags: ["Hawaii Conditions"],
          "x-payment-info": p50,
          "x-input-schema": inputSchema("get_ocean_safety"),
          parameters: [mcpAccountParam],
          requestBody: toRequestBody("get_ocean_safety"),
          responses: {
            "200": { description: "Ocean safety conditions" },
            "402": paymentChallenge402,
          },
          security: paidSecurity,
        },
      },

      "/gpt/sun-times": {
        get: {
          operationId: "get_sun_times",
          summary: "Get Hawaii sunrise and sunset times — Free",
          tags: ["Hawaii Conditions"],
          "x-payment-info": publicFreeInfo,
          "x-input-schema": {
            type: "object",
            properties: {
              island: { type: "string", enum: ["oahu", "maui", "big-island", "kauai", "molokai", "lanai"] },
              date: { type: "string", format: "date" },
            },
          },
          security: [],
          parameters: [
            islandParam,
            { name: "date", in: "query", required: false, schema: { type: "string", format: "date" }, description: "Date YYYY-MM-DD" },
          ],
          responses: {
            "200": { description: "Sunrise and sunset times" },
          },
        },
        post: {
          operationId: "post_sun_times",
          summary: "Get Hawaii sunrise and sunset times (POST) — Free",
          tags: ["Hawaii Conditions"],
          "x-payment-info": publicFreeInfo,
          "x-input-schema": {
            type: "object",
            properties: {
              island: { type: "string", enum: ["oahu", "maui", "big-island", "kauai", "molokai", "lanai"] },
              date: { type: "string", format: "date" },
            },
          },
          security: [],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    island: { type: "string", enum: ["oahu", "maui", "big-island", "kauai", "molokai", "lanai"] },
                    date: { type: "string", format: "date" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Sunrise and sunset times" },
          },
        },
      },

      "/gpt/moon-phase": {
        get: {
          operationId: "get_moon_phase",
          summary: "Get Hawaii moon phase — Free",
          tags: ["Hawaii Conditions"],
          "x-payment-info": publicFreeInfo,
          "x-input-schema": {
            type: "object",
            properties: {
              island: { type: "string", enum: ["oahu", "maui", "big-island", "kauai", "molokai", "lanai"] },
              date: { type: "string", format: "date" },
            },
          },
          security: [],
          parameters: [
            islandParam,
            { name: "date", in: "query", required: false, schema: { type: "string", format: "date" }, description: "Date YYYY-MM-DD" },
          ],
          responses: {
            "200": { description: "Moon phase data" },
          },
        },
        post: {
          operationId: "post_moon_phase",
          summary: "Get Hawaii moon phase (POST) — Free",
          tags: ["Hawaii Conditions"],
          "x-payment-info": publicFreeInfo,
          "x-input-schema": {
            type: "object",
            properties: {
              island: { type: "string", enum: ["oahu", "maui", "big-island", "kauai", "molokai", "lanai"] },
              date: { type: "string", format: "date" },
            },
          },
          security: [],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    island: { type: "string", enum: ["oahu", "maui", "big-island", "kauai", "molokai", "lanai"] },
                    date: { type: "string", format: "date" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Moon phase data" },
          },
        },
      },

      "/gpt/briefing": {
        get: {
          operationId: "get_briefing",
          summary: "Get full Hawaii conditions briefing",
          tags: ["Hawaii Conditions"],
          "x-payment-info": p200,
          "x-input-schema": inputSchema("get_full_briefing"),
          parameters: [mcpAccountParam, islandParam],
          responses: {
            "200": { description: "Full conditions briefing" },
            "402": paymentChallenge402,
          },
          security: paidSecurity,
        },
        post: {
          operationId: "post_briefing",
          summary: "Get full Hawaii conditions briefing (POST)",
          tags: ["Hawaii Conditions"],
          "x-payment-info": p200,
          "x-input-schema": inputSchema("get_full_briefing"),
          parameters: [mcpAccountParam],
          requestBody: toRequestBody("get_full_briefing"),
          responses: {
            "200": { description: "Full conditions briefing" },
            "402": paymentChallenge402,
          },
          security: paidSecurity,
        },
      },

      "/gpt/restaurants": {
        get: {
          operationId: "get_restaurants",
          summary: "Search Hawaii restaurants",
          tags: ["Hawaii Conditions"],
          "x-payment-info": p25,
          "x-input-schema": inputSchema("search_restaurants"),
          parameters: [
            mcpAccountParam,
            { name: "location", in: "query", required: true,  schema: { type: "string" }, description: "Location to search (e.g. Waikiki, Kailua, Lahaina)" },
            { name: "cuisine",  in: "query", required: false, schema: { type: "string" }, description: "Cuisine type (e.g. Hawaiian, Japanese, Mexican)" },
            { name: "price",    in: "query", required: false, schema: { type: "string", enum: ["$", "$$", "$$$", "$$$$"] }, description: "Price range" },
            { name: "open_now", in: "query", required: false, schema: { type: "boolean" }, description: "Filter for currently open restaurants" },
          ],
          responses: {
            "200": { description: "Restaurant list" },
            "402": paymentChallenge402,
          },
          security: paidSecurity,
        },
        post: {
          operationId: "post_restaurants",
          summary: "Search Hawaii restaurants (POST)",
          tags: ["Hawaii Conditions"],
          "x-payment-info": p25,
          "x-input-schema": inputSchema("search_restaurants"),
          parameters: [mcpAccountParam],
          requestBody: toRequestBody("search_restaurants"),
          responses: {
            "200": { description: "Restaurant list" },
            "402": paymentChallenge402,
          },
          security: paidSecurity,
        },
      },

      "/gpt/restaurant": {
        get: {
          operationId: "get_restaurant",
          summary: "Get details for a specific Hawaii restaurant",
          tags: ["Hawaii Conditions"],
          "x-payment-info": p15,
          "x-input-schema": inputSchema("get_restaurant_details"),
          parameters: [
            mcpAccountParam,
            { name: "place_id", in: "query", required: true, schema: { type: "string" }, description: "Google place_id returned from search_restaurants" },
          ],
          responses: {
            "200": { description: "Restaurant details" },
            "402": paymentChallenge402,
          },
          security: paidSecurity,
        },
        post: {
          operationId: "post_restaurant",
          summary: "Get details for a specific Hawaii restaurant (POST)",
          tags: ["Hawaii Conditions"],
          "x-payment-info": p15,
          "x-input-schema": inputSchema("get_restaurant_details"),
          parameters: [mcpAccountParam],
          requestBody: toRequestBody("get_restaurant_details"),
          responses: {
            "200": { description: "Restaurant details" },
            "402": paymentChallenge402,
          },
          security: paidSecurity,
        },
      },
    },
    components: {
      securitySchemes: {
        McpPrepaidAccount: {
          type: "apiKey",
          in: "header",
          name: "X-MCP-Account",
          description: `Stripe card-funded prepaid MCP account key (format: mcp_live_…). Register via register_agent tool at ${serverUrl}/mcp`,
        },
        MppPayment: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "MPP",
          description: "MPP payment credential or payment proof used after receiving a 402 Payment Required challenge.",
        },
      },
    },
  };

  return NextResponse.json(spec);
}
