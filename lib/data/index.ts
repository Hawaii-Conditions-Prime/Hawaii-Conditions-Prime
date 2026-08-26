// Single dispatcher for every tool's real data.
//
// The MCP endpoint, the /gpt/* REST routes, and the x402 resources all call
// through here, so a tool behaves identically regardless of which surface —
// and which payment rail — an agent arrives on.

import { moonPhaseResponse } from "./astronomy";
import { settleSection, UpstreamError } from "./http";
import { normalizeIsland } from "./islands";
import { getOceanSafety } from "./ocean";
import { getRestaurantDetails, searchRestaurants } from "./restaurants";
import { getSurf } from "./surf";
import { getTrailStatus } from "./trails";
import { getVolcano } from "./volcano";
import { getSunTimes, getWeather } from "./weather";

export { UpstreamError };

async function getFullBriefing(island: ReturnType<typeof normalizeIsland>) {
  // Each section degrades independently: one dead upstream shouldn't void a
  // $2.00 briefing that the other four sources can still populate.
  const [weather, surf, trails, volcano, ocean] = await Promise.all([
    settleSection("weather", () => getWeather(island)),
    settleSection("surf", () => getSurf(island)),
    settleSection("trails", () => getTrailStatus(island)),
    settleSection("volcano", () => getVolcano("kilauea")),
    settleSection("ocean_safety", () => getOceanSafety(island)),
  ]);

  return {
    island,
    generated_at: new Date().toISOString(),
    weather,
    surf,
    trails,
    volcano,
    ocean_safety: ocean,
    moon: moonPhaseResponse(),
  };
}

export async function executeTool(
  tool: string,
  params: Record<string, unknown> = {},
): Promise<unknown> {
  switch (tool) {
    case "ping":
      return {
        status: "ok",
        server: "HawaiiConditions",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
      };

    case "get_weather":
      return getWeather(normalizeIsland(params.island));

    case "get_surf_conditions":
      return getSurf(normalizeIsland(params.island));

    case "get_trail_status":
      return getTrailStatus(normalizeIsland(params.island));

    case "get_volcano_status":
      return getVolcano((params.volcano as string) ?? "kilauea");

    case "get_ocean_safety":
      return getOceanSafety(normalizeIsland(params.island));

    case "get_full_briefing":
      return getFullBriefing(normalizeIsland(params.island));

    case "get_sun_times":
      return getSunTimes(normalizeIsland(params.island), params.date as string | undefined);

    case "get_moon_phase":
      return moonPhaseResponse(params.date as string | undefined);

    case "search_restaurants": {
      const location = params.location as string | undefined;
      if (!location) {
        throw new Error("search_restaurants requires a 'location' (e.g. Waikiki, Kailua, Lahaina).");
      }
      return searchRestaurants({
        location,
        cuisine: params.cuisine as string | undefined,
        price: params.price as string | undefined,
        open_now: Boolean(params.open_now),
      });
    }

    case "get_restaurant_details": {
      const placeId = params.place_id as string | undefined;
      if (!placeId) {
        throw new Error("get_restaurant_details requires a 'place_id' from search_restaurants.");
      }
      return getRestaurantDetails(placeId);
    }

    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}
