// Shared x402 discovery catalog — used by both the /api/x402 resource
// endpoint and the /.well-known/x402 discovery manifest, so agent crawlers
// (e.g. AgentCash, the Coinbase x402 Bazaar) see identical data at either
// conventional path.
//
// This is a plain informational index — no payment processing happens here.
// Each listed endpoint (/api/x402/<tool>) is its own x402 v2 resource,
// implemented in lib/x402-server.ts.

import { TOOL_PRICES } from "./payment-challenge";
import { X402_ENABLED, X402_NETWORK } from "./x402";

const SERVER_URL = (process.env.SERVER_URL ?? "https://hawaii-conditions-prime.vercel.app").replace(/\/+$/, "");

export const TOOL_DESCRIPTIONS: Record<string, string> = {
  get_weather: "5-day Hawaii forecast, UV index, wind, sunrise/sunset.",
  get_surf_conditions: "Wave height, period, direction + 3-day surf forecast.",
  get_trail_status: "NPS alerts and state trail closures.",
  get_volcano_status: "Live Kīlauea status from USGS HVO.",
  get_ocean_safety: "Box jellyfish, rip currents, NOAA marine alerts.",
  get_full_briefing: "All five data sources combined — best value.",
  search_restaurants: "Find restaurants by location, cuisine, price, open-now.",
  get_restaurant_details: "Full hours, reviews, photos for a restaurant.",
};

export function x402ResourceUrl(tool: string): string {
  return `${SERVER_URL}/api/x402/${tool}`;
}

export function buildX402Catalog() {
  return {
    x402Version: 2,
    service: "Hawaii Conditions",
    mcp_endpoint: `${SERVER_URL}/api/mcp`,
    network: X402_NETWORK === "base" ? "eip155:8453" : "eip155:84532",
    enabled: X402_ENABLED,
    resources: Object.keys(TOOL_PRICES).map((t) => ({
      tool: t,
      endpoint: x402ResourceUrl(t),
      method: "GET",
      priceUsd: TOOL_PRICES[t],
      description: TOOL_DESCRIPTIONS[t] ?? null,
    })),
    ...(X402_ENABLED
      ? {}
      : { notice: "x402 is not yet configured. Set X402_PAY_TO, CDP_API_KEY_ID, and CDP_API_KEY_SECRET to enable on-chain payments." }),
  };
}
