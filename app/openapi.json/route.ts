import { NextResponse } from "next/server";
import { toRequestBody, sharedAuthHeader, inputSchema } from "@/lib/tool-schemas";
import { X402_ENABLED } from "@/lib/x402";

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

  // AgentCash/x402 marketplaces recognize `protocols` as an array of protocol
  // *objects* (e.g. `[{ "x402": {} }]`), not the plain protocol-name strings
  // used elsewhere in this file for mppscan-style tooling — so this field is
  // computed separately from the legacy `protocol`/`billing` metadata below,
  // which stays as-is for backward compatibility (the two don't collide).
  const agentPaymentProtocols = X402_ENABLED ? [{ x402: {} }] : [];

  const stripePrepaidInfo = (price: string, billing = "prepaid_balance") => ({
    authMode: "apiKey",
    price,
    currency: "USD",
    protocol: "stripe-card-prepaid",
    protocols: agentPaymentProtocols,
    pricingMode: "fixed",
    billing,
    accountHeader: "X-MCP-Account",
    options: [
      {
        authMode: "apiKey",
        price,
        currency: "USD",
        protocol: "stripe-card-prepaid",
        protocols: agentPaymentProtocols,
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
    protocols: agentPaymentProtocols,
    pricingMode: "fixed",
    billing: "free",
    options: [
      {
        authMode: "apiKey",
        price: "0.00",
        currency: "USD",
        protocol: "stripe-card-prepaid",
        protocols: agentPaymentProtocols,
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
    protocols: [],
    pricingMode: "fixed",
    billing: "free",
    options: [
      {
        authMode: "none",
        price: "0.00",
        currency: "USD",
        protocol: "none",
        protocols: [],
        pricingMode: "fixed",
        billing: "free",
      },
    ],
  };

  // Output schemas for each paid/free data tool — AgentCash's discovery
  // validator flags operations with no response schema ("Input/Output Schema
  // Missing"), so these mirror the literal shape each app/gpt/*/route.ts
  // handler returns today.
  const dateTime = { type: "string", format: "date-time" };

  const weatherResponseSchema = {
    type: "object",
    required: ["island", "temperature_f", "conditions", "wind_mph", "humidity_pct", "uv_index", "updated_at"],
    properties: {
      island: { type: "string" },
      temperature_f: { type: "number" },
      conditions: { type: "string" },
      wind_mph: { type: "number" },
      humidity_pct: { type: "number" },
      uv_index: { type: "number" },
      updated_at: dateTime,
    },
  };

  const surfResponseSchema = {
    type: "object",
    required: ["island", "wave_height_ft", "swell_direction", "swell_period_s", "wind", "rating", "updated_at"],
    properties: {
      island: { type: "string" },
      wave_height_ft: { type: "object", properties: { min: { type: "number" }, max: { type: "number" } }, required: ["min", "max"] },
      swell_direction: { type: "string" },
      swell_period_s: { type: "number" },
      wind: { type: "string" },
      rating: { type: "string" },
      updated_at: dateTime,
    },
  };

  const volcanoResponseSchema = {
    type: "object",
    required: ["volcano", "alert_level", "eruption_status", "lava_flow_hazard", "vog_advisory", "park_areas_closed", "updated_at"],
    properties: {
      volcano: { type: "string" },
      alert_level: { type: "string" },
      eruption_status: { type: "string" },
      lava_flow_hazard: { type: "boolean" },
      vog_advisory: { type: "boolean" },
      park_areas_closed: { type: "array", items: { type: "string" } },
      updated_at: dateTime,
    },
  };

  const trailsResponseSchema = {
    type: "object",
    required: ["island", "trail", "status", "difficulty", "length_miles", "conditions", "alerts", "updated_at"],
    properties: {
      island: { type: "string" },
      trail: { type: "string" },
      status: { type: "string" },
      difficulty: { type: "string" },
      length_miles: { type: "number" },
      conditions: { type: "string" },
      alerts: { type: "array", items: { type: "string" } },
      updated_at: dateTime,
    },
  };

  const oceanSafetyResponseSchema = {
    type: "object",
    required: ["beach", "flag_color", "flag_meaning", "rip_current_risk", "jellyfish_advisory", "shark_advisory", "swimming_conditions", "lifeguard_on_duty", "updated_at"],
    properties: {
      beach: { type: "string" },
      flag_color: { type: "string" },
      flag_meaning: { type: "string" },
      rip_current_risk: { type: "string" },
      jellyfish_advisory: { type: "boolean" },
      shark_advisory: { type: "boolean" },
      swimming_conditions: { type: "string" },
      lifeguard_on_duty: { type: "boolean" },
      updated_at: dateTime,
    },
  };

  const sunTimesResponseSchema = {
    type: "object",
    required: ["island", "date", "sunrise", "sunset", "solar_noon", "golden_hour_morning", "golden_hour_evening", "day_length_hours", "timezone"],
    properties: {
      island: { type: "string" },
      date: { type: "string", format: "date" },
      sunrise: { type: "string" },
      sunset: { type: "string" },
      solar_noon: { type: "string" },
      golden_hour_morning: { type: "string" },
      golden_hour_evening: { type: "string" },
      day_length_hours: { type: "number" },
      timezone: { type: "string" },
    },
  };

  const moonPhaseResponseSchema = {
    type: "object",
    required: ["date", "phase", "illumination_pct", "days_to_full_moon", "days_to_new_moon", "moonrise", "moonset", "timezone"],
    properties: {
      date: { type: "string", format: "date" },
      phase: { type: "string" },
      illumination_pct: { type: "number" },
      days_to_full_moon: { type: "number" },
      days_to_new_moon: { type: "number" },
      moonrise: { type: "string" },
      moonset: { type: "string" },
      timezone: { type: "string" },
    },
  };

  const briefingResponseSchema = {
    type: "object",
    required: ["island", "summary", "weather", "surf", "ocean_safety", "volcano", "sun", "updated_at"],
    properties: {
      island: { type: "string" },
      summary: { type: "string" },
      weather: { type: "object", properties: { temperature_f: { type: "number" }, conditions: { type: "string" }, wind_mph: { type: "number" } } },
      surf: { type: "object", properties: { rating: { type: "string" }, wave_height_ft: { type: "object", properties: { min: { type: "number" }, max: { type: "number" } } } } },
      ocean_safety: { type: "object", properties: { flag_color: { type: "string" }, rip_current_risk: { type: "string" } } },
      volcano: { type: "object", properties: { alert_level: { type: "string" }, lava_flow_hazard: { type: "boolean" } } },
      sun: { type: "object", properties: { sunrise: { type: "string" }, sunset: { type: "string" } } },
      updated_at: dateTime,
    },
  };

  const restaurantsResponseSchema = {
    type: "object",
    required: ["location", "restaurants", "updated_at"],
    properties: {
      location: { type: "string" },
      cuisine: { type: ["string", "null"] },
      price: { type: ["string", "null"] },
      restaurants: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "cuisine", "area", "rating"],
          properties: {
            name: { type: "string" },
            cuisine: { type: "string" },
            area: { type: "string" },
            rating: { type: "number" },
          },
        },
      },
      updated_at: dateTime,
    },
  };

  const restaurantDetailsResponseSchema = {
    type: "object",
    required: ["place_id", "island", "cuisine", "address", "phone", "hours", "rating", "price_range", "reservations", "updated_at"],
    properties: {
      place_id: { type: "string" },
      island: { type: "string" },
      cuisine: { type: "string" },
      address: { type: "string" },
      phone: { type: "string" },
      hours: { type: "string" },
      rating: { type: "number" },
      price_range: { type: "string" },
      reservations: { type: "boolean" },
      updated_at: dateTime,
    },
  };

  function ok(description: string, schema: Record<string, unknown>) {
    return { description, content: { "application/json": { schema } } };
  }

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
      description: `${toolName} is a real-time conditions API for the Hawaiian Islands, built for AI travel agents, concierge bots, itinerary planners, hotel assistants, tourism apps, and personal AI assistants. Use it to help users plan safer beach days, surfing sessions, hikes, and restaurant outings across Oʻahu, Maui, Kauaʻi, Hawaiʻi Island, Molokaʻi, and Lānaʻi. Available data: current weather, surf conditions, ocean safety advisories, trail status, volcanic activity, sunrise/sunset times, moon phase, restaurant search, restaurant details, and full island briefings. Paid tools accept a Stripe prepaid balance via X-MCP-Account header${X402_ENABLED ? ", or on-chain USDC via the x402 protocol (see /api/x402)" : ""}.`,
      "x-guidance": `Use get_full_briefing for a complete island overview before building a day-by-day itinerary. Use search_restaurants to find dining options by location, cuisine, or price range, then get_restaurant_details for hours, ratings, and contact info. Use get_weather, get_surf_conditions, get_ocean_safety, get_trail_status, and get_volcano_status to refine plans for specific activities. Use get_sun_times (free) and get_moon_phase (free) to anchor sunrise, sunset, and lunar context into itineraries. Paid tools accept either an X-MCP-Account header (Stripe prepaid balance; register via register_agent at ${serverUrl}/mcp)${X402_ENABLED ? " or a signed X-PAYMENT header (on-chain USDC via x402; see /api/x402 for the resource catalog)" : ""}. No credential → 402 challenge listing both options.`,
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
            "200": ok("Current weather conditions", weatherResponseSchema),
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
            "200": ok("Current weather conditions", weatherResponseSchema),
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
            "200": ok("Surf conditions", surfResponseSchema),
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
            "200": ok("Surf conditions", surfResponseSchema),
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
            "200": ok("Volcanic activity status", volcanoResponseSchema),
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
            "200": ok("Volcanic activity status", volcanoResponseSchema),
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
            "200": ok("Trail conditions", trailsResponseSchema),
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
            "200": ok("Trail conditions", trailsResponseSchema),
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
            "200": ok("Ocean safety conditions", oceanSafetyResponseSchema),
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
            "200": ok("Ocean safety conditions", oceanSafetyResponseSchema),
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
            "200": ok("Sunrise and sunset times", sunTimesResponseSchema),
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
            "200": ok("Sunrise and sunset times", sunTimesResponseSchema),
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
            "200": ok("Moon phase data", moonPhaseResponseSchema),
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
            "200": ok("Moon phase data", moonPhaseResponseSchema),
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
            "200": ok("Full conditions briefing", briefingResponseSchema),
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
            "200": ok("Full conditions briefing", briefingResponseSchema),
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
            "200": ok("Restaurant list", restaurantsResponseSchema),
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
            "200": ok("Restaurant list", restaurantsResponseSchema),
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
            "200": ok("Restaurant details", restaurantDetailsResponseSchema),
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
            "200": ok("Restaurant details", restaurantDetailsResponseSchema),
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
