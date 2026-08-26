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
    data: { type: "object" },
  },
  required: ["ok", "tool", "paid_usd", "data"],
};

// Trimmed samples of what each tool's upstream actually returns, so the
// Bazaar listing previews real fields rather than a generic envelope.
const TOOL_DATA_EXAMPLES: Record<string, Record<string, unknown>> = {
  get_weather: {
    island: "oahu",
    location: "Honolulu",
    current: { temperature_f: 83.6, conditions: "Partly cloudy", wind_mph: 15.8 },
    forecast: [{ date: "2026-08-23", high_f: 83.8, low_f: 76.3, uv_index_max: 9.1, uv_risk: "very high" }],
    source: "Open-Meteo (https://open-meteo.com)",
  },
  get_surf_conditions: {
    island: "oahu",
    break_location: "North Shore (Pipeline)",
    current: { wave_height_ft: 5.97, wave_period_s: 6.7, wave_direction: "ENE", summary: "Solid — experienced surfers" },
    source: "Open-Meteo Marine API (https://open-meteo.com)",
  },
  get_trail_status: {
    island: "maui",
    national_park_alerts: [{ park_code: "hale", title: "Trail closure", category: "Closure" }],
    state_trails: { coverage: "not_available", url: "https://hawaiitrails.hawaii.gov/trails/" },
    source: "National Park Service API",
  },
  get_volcano_status: {
    volcano: "Kīlauea",
    alert_level: "ADVISORY",
    color_code: "YELLOW",
    erupting: false,
    status: "Kīlauea volcano is not erupting; the summit eruption in Halemaʻumaʻu is paused.",
    source: "USGS Volcano Hazards Program (https://volcanoes.usgs.gov)",
  },
  get_ocean_safety: {
    island: "oahu",
    marine_alerts: [{ event: "High Surf Advisory", severity: "Moderate" }],
    rip_current_risk: { level: "moderate", basis: "Modelled surf 4.2 ft — rip currents possible." },
    box_jellyfish: { risk: "low", basis: "lunar_calendar_forecast" },
  },
  get_full_briefing: {
    island: "big-island",
    weather: { current: { temperature_f: 81.2 } },
    surf: { current: { wave_height_ft: 4.1 } },
    volcano: { alert_level: "ADVISORY" },
    ocean_safety: { rip_current_risk: { level: "moderate" } },
    moon: { phase: "Waxing Gibbous", illumination_pct: 88 },
  },
  search_restaurants: {
    result_count: 15,
    results: [
      {
        place_id: "ChIJVXWkuO1sAHwRfKBTFDqz1S8",
        name: "Example Poke Co.",
        address: "123 Kalakaua Ave, Honolulu, HI 96815",
        rating: 4.6,
        price: "$$",
        open_now: true,
      },
    ],
    source: "Google Places API (New)",
  },
  get_restaurant_details: {
    place_id: "ChIJVXWkuO1sAHwRfKBTFDqz1S8",
    name: "Example Poke Co.",
    rating: 4.6,
    phone: "(808) 555-0142",
    hours: ["Monday: 10:00 AM – 9:00 PM"],
    reviews: [{ rating: 5, text: "Great poke.", published: "2 weeks ago" }],
    source: "Google Places API (New)",
  },
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
        data: TOOL_DATA_EXAMPLES[tool] ?? {},
      },
      schema: OUTPUT_SCHEMA,
    },
  });
}
