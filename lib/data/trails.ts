// Trail status: National Park Service alerts plus weather alerts that close trails.
//
// State (DLNR Nā Ala Hele) trail closures have no public API, so they are not
// invented here — the response says so and links to the authoritative page
// rather than implying full coverage.

import { fetchJson, settleSection } from "./http";
import { getAlerts } from "./alerts";
import { islandInfo, type Island } from "./islands";

const NPS_ALERTS_URL = "https://developer.nps.gov/api/v1/alerts";
const DLNR_TRAILS_URL = "https://hawaiitrails.hawaii.gov/trails/";

interface NpsAlert {
  id: string;
  url: string;
  title: string;
  parkCode: string;
  description: string;
  category: string;
  lastIndexedDate?: string;
}

async function npsAlerts(parkCodes: string[]) {
  const apiKey = process.env.NPS_API_KEY;
  if (!apiKey) {
    throw new Error("NPS_API_KEY is not configured on this deployment.");
  }
  if (parkCodes.length === 0) return [];

  const params = new URLSearchParams({
    parkCode: parkCodes.join(","),
    limit: "50",
    api_key: apiKey,
  });

  const feed = await fetchJson<{ data?: NpsAlert[] }>("NPS", `${NPS_ALERTS_URL}?${params}`);

  return (feed.data ?? []).map((a) => ({
    park_code: a.parkCode,
    title: a.title,
    category: a.category,
    description: a.description,
    url: a.url,
    last_updated: a.lastIndexedDate ?? null,
  }));
}

export async function getTrailStatus(island: Island) {
  const info = islandInfo(island);

  const [nps, alerts] = await Promise.all([
    settleSection("NPS", () => npsAlerts(info.npsParks)),
    settleSection("NWS alerts", () => getAlerts(island)),
  ]);

  const weatherImpacting = Array.isArray(alerts)
    ? alerts.filter((a) => /flood|wind|rain|thunder|fire|heat/i.test(a.event))
    : alerts;

  return {
    island,
    island_name: info.label,
    national_park_alerts: nps,
    national_parks_checked: info.npsParks,
    weather_alerts_affecting_trails: weatherImpacting,
    state_trails: {
      coverage: "not_available",
      note: "Hawaiʻi state trail (Nā Ala Hele) closures are not published as a machine-readable feed. Check the official site before hiking.",
      url: DLNR_TRAILS_URL,
    },
    sources: [
      "National Park Service API (https://www.nps.gov/subjects/developer)",
      "NOAA/NWS active alerts (https://api.weather.gov)",
    ],
    retrieved_at: new Date().toISOString(),
  };
}
