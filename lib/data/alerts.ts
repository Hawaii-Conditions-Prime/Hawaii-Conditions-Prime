// Active National Weather Service alerts for Hawaii, filtered to an island.
//
// NWS `areaDesc` names forecast zones ("Kona; Kohala; Big Island Interior"),
// not islands, so each island carries a keyword list to match against.

import { fetchJson } from "./http";
import { islandInfo, type Island } from "./islands";

const NWS_ALERTS_URL = "https://api.weather.gov/alerts/active?area=HI";

interface NwsAlertFeature {
  properties: {
    event: string;
    headline?: string;
    description?: string;
    instruction?: string;
    severity: string;
    urgency: string;
    certainty: string;
    areaDesc: string;
    effective: string;
    expires: string;
  };
}

export interface NwsAlert {
  event: string;
  headline: string | null;
  severity: string;
  urgency: string;
  areas: string;
  effective: string;
  expires: string;
  instruction: string | null;
}

export async function getAlerts(island: Island): Promise<NwsAlert[]> {
  const info = islandInfo(island);
  const feed = await fetchJson<{ features?: NwsAlertFeature[] }>("NWS", NWS_ALERTS_URL);

  return (feed.features ?? [])
    .filter((f) => {
      const area = (f.properties.areaDesc ?? "").toLowerCase();
      return info.zoneKeywords.some((kw) => area.includes(kw));
    })
    .map((f) => ({
      event: f.properties.event,
      headline: f.properties.headline ?? null,
      severity: f.properties.severity,
      urgency: f.properties.urgency,
      areas: f.properties.areaDesc,
      effective: f.properties.effective,
      expires: f.properties.expires,
      instruction: f.properties.instruction?.trim() ?? null,
    }));
}

// Marine/coastal subset — the alert types that bear on entering the water.
const MARINE_EVENT_PATTERN = /surf|rip current|marine|beach|coastal|tsunami|small craft|shark/i;

export function marineAlerts(alerts: NwsAlert[]): NwsAlert[] {
  return alerts.filter((a) => MARINE_EVENT_PATTERN.test(a.event));
}
