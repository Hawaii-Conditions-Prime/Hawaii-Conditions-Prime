// Ocean safety: NWS marine alerts, model surf, and the box-jellyfish lunar window.
//
// Box jellyfish arrive on Hawaiʻi's south-facing shores roughly 8–10 days
// after each full moon. That influx is predictable from the lunar calendar,
// so it is reported here as a *forecast window* derived from moon phase —
// never as an observation. Live sightings are posted by the Waikīkī Aquarium
// and county ocean safety, which publish no machine-readable feed.

import { getAlerts, marineAlerts, type NwsAlert } from "./alerts";
import { moonPhase } from "./astronomy";
import { settleSection } from "./http";
import { islandInfo, type Island } from "./islands";
import { describeSurf, getSurf } from "./surf";

const JELLYFISH_WINDOW_START = 8;
const JELLYFISH_WINDOW_END = 10;

// South-facing shores are the ones with a documented influx pattern.
const JELLYFISH_ISLANDS: Island[] = ["oahu", "maui", "big-island", "lanai", "molokai", "kauai"];

export function jellyfishOutlook(island: Island, date = new Date()) {
  const { days_since_full_moon } = moonPhase(date);
  const inWindow =
    days_since_full_moon >= JELLYFISH_WINDOW_START && days_since_full_moon <= JELLYFISH_WINDOW_END;

  const daysUntil =
    days_since_full_moon < JELLYFISH_WINDOW_START
      ? Number((JELLYFISH_WINDOW_START - days_since_full_moon).toFixed(1))
      : null;

  return {
    applies_to: JELLYFISH_ISLANDS.includes(island) ? "south-facing shores" : "not typically affected",
    risk: inWindow ? "elevated" : "low",
    days_since_full_moon,
    influx_window_days_after_full_moon: `${JELLYFISH_WINDOW_START}–${JELLYFISH_WINDOW_END}`,
    days_until_next_window: daysUntil,
    basis: "lunar_calendar_forecast",
    disclaimer:
      "Predicted from the lunar cycle, not a live sighting report. Check posted beach signage and county ocean safety before entering the water.",
  };
}

function ripCurrentRisk(waveHeightFt: number | null, alerts: NwsAlert[]) {
  const advisory = alerts.find((a) => /rip current|high surf/i.test(a.event));
  if (advisory) {
    return { level: "high", basis: `Active NWS alert: ${advisory.event}` };
  }
  if (waveHeightFt === null) {
    return { level: "unknown", basis: "No wave data available." };
  }
  if (waveHeightFt >= 6) {
    return { level: "high", basis: `Modelled surf ${waveHeightFt} ft — strong rip currents likely.` };
  }
  if (waveHeightFt >= 3) {
    return { level: "moderate", basis: `Modelled surf ${waveHeightFt} ft — rip currents possible.` };
  }
  return { level: "low", basis: `Modelled surf ${waveHeightFt} ft.` };
}

export async function getOceanSafety(island: Island) {
  const info = islandInfo(island);

  const [alertsResult, surfResult] = await Promise.all([
    settleSection("NWS alerts", () => getAlerts(island)),
    settleSection("Open-Meteo Marine", () => getSurf(island)),
  ]);

  const alerts = Array.isArray(alertsResult) ? alertsResult : [];
  const waveHeight =
    surfResult && "current" in surfResult && surfResult.current
      ? surfResult.current.wave_height_ft
      : null;

  return {
    island,
    island_name: info.label,
    marine_alerts: Array.isArray(alertsResult)
      ? marineAlerts(alerts)
      : alertsResult,
    all_active_alerts: Array.isArray(alertsResult) ? alerts : alertsResult,
    surf: {
      break_location: info.surf.place,
      wave_height_ft: waveHeight,
      summary: describeSurf(waveHeight ?? undefined),
    },
    rip_current_risk: ripCurrentRisk(waveHeight, alerts),
    box_jellyfish: jellyfishOutlook(island),
    sources: [
      "NOAA/NWS active alerts (https://api.weather.gov)",
      "Open-Meteo Marine API (https://open-meteo.com)",
      "Box jellyfish window derived from lunar phase",
    ],
    retrieved_at: new Date().toISOString(),
  };
}
