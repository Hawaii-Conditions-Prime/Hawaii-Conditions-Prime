// Shared x402 discovery catalog — used by both the /api/x402 resource
// endpoint and the /.well-known/x402 discovery manifest, so agent crawlers
// (e.g. AgentCash, the Coinbase x402 Bazaar) see identical data at either
// conventional path.

import { TOOL_PRICES } from "./payment-challenge";
import { TOOL_INPUT_SCHEMAS } from "./tool-schemas";
import { X402_ENABLED, buildPaymentRequirements, facilitatorInfo, type PaymentRequirements } from "./x402";

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
  return `${SERVER_URL}/api/x402?tool=${tool}`;
}

export function x402RequirementsFor(tool: string): PaymentRequirements {
  return buildPaymentRequirements({
    priceUsd: TOOL_PRICES[tool],
    resource: x402ResourceUrl(tool),
    description: TOOL_DESCRIPTIONS[tool] ?? `Hawaii Conditions tool: ${tool}.`,
    outputSchema: TOOL_INPUT_SCHEMAS[tool],
  });
}

export function buildX402Catalog() {
  return {
    x402Version: 1,
    service: "Hawaii Conditions",
    mcp_endpoint: `${SERVER_URL}/api/mcp`,
    x402: facilitatorInfo(),
    enabled: X402_ENABLED,
    resources: Object.keys(TOOL_PRICES).map((t) => ({
      tool: t,
      endpoint: x402ResourceUrl(t),
      priceUsd: TOOL_PRICES[t],
      description: TOOL_DESCRIPTIONS[t] ?? null,
      accepts: X402_ENABLED ? [x402RequirementsFor(t)] : [],
    })),
    ...(X402_ENABLED
      ? {}
      : { notice: "x402 is not yet configured. Set X402_PAY_TO (recipient wallet) to enable on-chain payments." }),
  };
}
