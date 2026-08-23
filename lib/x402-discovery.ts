// Bazaar discovery declarations for each payable tool.
//
// `declareDiscoveryExtension` builds the `extensions.bazaar` block the Coinbase
// x402 Bazaar indexes on. It fills in `info.input.{type,method}` and the JSON
// Schema itself; what's declared here is the per-tool detail it can't infer:
// a representative query-param example (the Bazaar replays this when probing
// the resource) and an example of what the resource returns.

import { declareDiscoveryExtension } from "@x402/extensions/bazaar";

import { TOOL_INPUT_SCHEMAS } from "./tool-schemas";

// Query params the Bazaar can safely replay against each resource.
const TOOL_QUERY_EXAMPLES: Record<string, Record<string, unknown>> = {
  get_weather: { island: "oahu" },
  get_surf_conditions: { island: "oahu" },
  get_trail_status: { island: "maui" },
  get_volcano_status: {},
  get_ocean_safety: { island: "oahu" },
  get_full_briefing: { island: "big-island" },
  search_restaurants: { location: "Waikiki", cuisine: "Hawaiian", price: "$$" },
  get_restaurant_details: { place_id: "ChIJVXWkuO1sAHwRfKBTFDqz1S8" },
};

const OUTPUT_SCHEMA = {
  properties: {
    ok: { type: "boolean" },
    tool: { type: "string" },
    paid_usd: { type: "number" },
    payer: { type: ["string", "null"] },
    note: { type: "string" },
  },
  required: ["ok", "tool", "paid_usd"],
};

export function bazaarExtensionFor(tool: string, priceUsd: number) {
  return declareDiscoveryExtension({
    input: TOOL_QUERY_EXAMPLES[tool] ?? {},
    inputSchema: TOOL_INPUT_SCHEMAS[tool] ?? { properties: {} },
    output: {
      example: {
        ok: true,
        tool,
        paid_usd: priceUsd,
        payer: "0x0000000000000000000000000000000000000000",
        note: "Payment settled via x402.",
      },
      schema: OUTPUT_SCHEMA,
    },
  });
}
