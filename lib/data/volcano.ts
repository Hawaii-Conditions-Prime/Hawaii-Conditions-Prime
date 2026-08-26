// Kīlauea / Mauna Loa status from the USGS Volcano Hazards Program (HANS).
//
// `getCapElevated` lists volcanoes currently or recently at an elevated alert
// level. A Hawaiian volcano missing from that feed is therefore at NORMAL /
// GREEN with no active notice — reported explicitly rather than as an error.

import { fetchJson } from "./http";

const HANS_URL = "https://volcanoes.usgs.gov/hans-public/api/volcano/getCapElevated";

// Smithsonian GVP volcano numbers.
const VOLCANOES: Record<string, { vnum: string; name: string }> = {
  kilauea: { vnum: "332010", name: "Kīlauea" },
  "mauna-loa": { vnum: "332020", name: "Mauna Loa" },
};

interface HansVolcano {
  volcano_name_appended: string;
  vnum: string;
  latitude: number;
  longitude: number;
  elevation_feet: number;
  obs_fullname: string;
  alert_level: string;
  color_code: string;
  is_elevated_cap: boolean;
  synopsis?: string;
  notice_identifier?: string;
  sent_date_cap?: string;
  cap_expires?: string;
}

export async function getVolcano(volcano = "kilauea") {
  const key = String(volcano).trim().toLowerCase().replace(/[\s_]+/g, "-");
  const target = VOLCANOES[key] ?? VOLCANOES.kilauea;

  const feed = await fetchJson<HansVolcano[]>("USGS HVO", HANS_URL);
  const match = Array.isArray(feed) ? feed.find((v) => v.vnum === target.vnum) : undefined;

  if (!match) {
    return {
      volcano: target.name,
      alert_level: "NORMAL",
      color_code: "GREEN",
      erupting: false,
      status: "No elevated alert is in effect. USGS lists this volcano at normal background activity.",
      observatory: "Hawaiian Volcano Observatory",
      source: "USGS Volcano Hazards Program (https://volcanoes.usgs.gov)",
      retrieved_at: new Date().toISOString(),
    };
  }

  const synopsis = match.synopsis?.trim();
  return {
    volcano: target.name,
    alert_level: match.alert_level,
    color_code: match.color_code,
    // The synopsis is the authoritative wording; only treat it as erupting
    // when USGS says so, since alert level alone doesn't imply an eruption.
    erupting: synopsis ? /\bis erupting\b/i.test(synopsis) : null,
    status: synopsis ?? "No synopsis published with the current notice.",
    coordinates: { lat: match.latitude, lon: match.longitude },
    summit_elevation_ft: Math.round(match.elevation_feet),
    observatory: match.obs_fullname,
    notice_id: match.notice_identifier ?? null,
    notice_issued: match.sent_date_cap ?? null,
    notice_expires: match.cap_expires ?? null,
    source: "USGS Volcano Hazards Program (https://volcanoes.usgs.gov)",
    retrieved_at: new Date().toISOString(),
  };
}
