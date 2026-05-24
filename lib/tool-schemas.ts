// Single source of truth for paid-tool input schemas.
// Used by ALL_TOOLS (MCP inputSchema) and the OpenAPI requestBody definitions.

const ISLAND_ENUM = ["oahu", "maui", "kauai", "big-island", "molokai", "lanai"] as const;

const islandProp = {
  type: "string",
  description: "Island name (e.g. oahu, maui, kauai, big-island)",
  enum: [...ISLAND_ENUM],
};

export const sharedAuthHeader = {
  "X-MCP-Account": {
    type: "string",
    required: true,
    pattern: "^mcp_live_",
    description: "Your prepaid API key (format: mcp_live_…). Register via register_agent.",
  },
};

// Inner JSON Schema objects — used as MCP inputSchema directly.
export const TOOL_INPUT_SCHEMAS: Record<string, Record<string, unknown>> = {
  get_weather: {
    type: "object",
    required: ["island"],
    properties: { island: islandProp },
  },
  get_surf_conditions: {
    type: "object",
    required: ["island"],
    properties: { island: islandProp },
  },
  get_trail_status: {
    type: "object",
    required: ["island"],
    properties: { island: islandProp },
  },
  get_volcano_status: {
    type: "object",
    properties: {},
  },
  get_ocean_safety: {
    type: "object",
    required: ["island"],
    properties: { island: islandProp },
  },
  get_full_briefing: {
    type: "object",
    required: ["island"],
    properties: { island: islandProp },
  },
  search_restaurants: {
    type: "object",
    required: ["location"],
    properties: {
      location: { type: "string", description: "Location to search (e.g. Waikiki, Kailua, Lahaina)" },
      cuisine:  { type: "string", description: "Cuisine type (e.g. Hawaiian, Japanese, Mexican)" },
      price:    { type: "string", enum: ["$", "$$", "$$$", "$$$$"], description: "Price range" },
      open_now: { type: "boolean", description: "Filter for currently open restaurants" },
    },
  },
  get_restaurant_details: {
    type: "object",
    required: ["place_id"],
    properties: {
      place_id: { type: "string", description: "Google place_id returned from search_restaurants" },
    },
  },
};

// Wraps an inner schema in an OpenAPI requestBody envelope.
export function toRequestBody(toolName: string, required = true) {
  return {
    required,
    content: {
      "application/json": {
        schema: TOOL_INPUT_SCHEMAS[toolName] ?? {
          type: "object",
          description: `Input schema for ${toolName}`,
          properties: {},
        },
      },
    },
  };
}

// MPP Scan's L3 checks expect paid operations to expose a concrete input schema.
// Some scanners do not treat query parameters as enough for paid GET endpoints,
// so this helper places the same JSON Schema directly on the operation too.
export function inputSchema(toolName: string) {
  return TOOL_INPUT_SCHEMAS[toolName] ?? {
    type: "object",
    description: `Input schema for ${toolName}`,
    properties: {},
  };
}
