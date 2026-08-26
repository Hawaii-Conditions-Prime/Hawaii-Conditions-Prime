// Surf / wave conditions from the Open-Meteo Marine API (no API key required).
//
// The lookup uses each island's exposed surf point rather than its town
// centre — a wave forecast sampled inland is meaningless.

import { fetchJson } from "./http";
import { islandInfo, type Island } from "./islands";

const MARINE_URL = "https://marine-api.open-meteo.com/v1/marine";

interface OpenMeteoMarine {
  current?: {
    time: string;
    wave_height: number;
    wave_direction: number;
    wave_period: number;
    swell_wave_height: number;
    swell_wave_direction: number;
    swell_wave_period: number;
  };
  daily?: {
    time: string[];
    wave_height_max: number[];
    wave_direction_dominant: number[];
    wave_period_max: number[];
    swell_wave_height_max: number[];
  };
}

const COMPASS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

export function compassDirection(deg: number | undefined): string {
  if (deg === undefined || Number.isNaN(deg)) return "unknown";
  return COMPASS[Math.round(((deg % 360) / 22.5)) % 16];
}

// Plain-language sizing so an agent can act on the number without surf jargon.
export function describeSurf(heightFt: number | undefined): string {
  if (heightFt === undefined) return "unknown";
  if (heightFt < 1) return "Flat";
  if (heightFt < 2) return "Small — beginner friendly";
  if (heightFt < 4) return "Moderate — fun size";
  if (heightFt < 6) return "Solid — experienced surfers";
  if (heightFt < 10) return "Large — advanced only";
  return "Extra large — dangerous, expert only";
}

export async function getSurf(island: Island) {
  const info = islandInfo(island);
  const params = new URLSearchParams({
    latitude: String(info.surf.lat),
    longitude: String(info.surf.lon),
    current: "wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period",
    daily: "wave_height_max,wave_direction_dominant,wave_period_max,swell_wave_height_max",
    length_unit: "imperial",
    timezone: "Pacific/Honolulu",
    forecast_days: "3",
  });

  const data = await fetchJson<OpenMeteoMarine>("Open-Meteo Marine", `${MARINE_URL}?${params}`);
  const daily = data.daily;

  return {
    island,
    island_name: info.label,
    break_location: info.surf.place,
    current: data.current
      ? {
          observed_at: data.current.time,
          wave_height_ft: data.current.wave_height,
          wave_period_s: data.current.wave_period,
          wave_direction_deg: data.current.wave_direction,
          wave_direction: compassDirection(data.current.wave_direction),
          swell_height_ft: data.current.swell_wave_height,
          swell_period_s: data.current.swell_wave_period,
          swell_direction: compassDirection(data.current.swell_wave_direction),
          summary: describeSurf(data.current.wave_height),
        }
      : null,
    forecast: (daily?.time ?? []).map((date, i) => ({
      date,
      wave_height_max_ft: daily!.wave_height_max[i],
      wave_period_max_s: daily!.wave_period_max[i],
      dominant_direction: compassDirection(daily!.wave_direction_dominant[i]),
      swell_height_max_ft: daily!.swell_wave_height_max?.[i] ?? null,
      summary: describeSurf(daily!.wave_height_max[i]),
    })),
    note: "Open-ocean model data for the named break. Always check posted beach warnings and lifeguard advice before entering the water.",
    source: "Open-Meteo Marine API (https://open-meteo.com)",
    retrieved_at: new Date().toISOString(),
  };
}
