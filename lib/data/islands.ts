// Per-island reference data used to query the upstream providers.
//
// `center` is the main population centre (weather). `surf` is an exposed
// coastal point used for the marine/wave lookup, since a wave forecast taken
// at an inland town centre is meaningless. `npsParks` are the National Park
// Service unit codes on that island (trail alerts). `zoneKeywords` match the
// NWS `areaDesc` strings, which name forecast zones rather than islands.

export const ISLANDS = ["oahu", "maui", "kauai", "big-island", "molokai", "lanai"] as const;

export type Island = (typeof ISLANDS)[number];

export interface IslandInfo {
  label: string;
  center: { lat: number; lon: number; place: string };
  surf: { lat: number; lon: number; place: string };
  npsParks: string[];
  zoneKeywords: string[];
}

export const ISLAND_DATA: Record<Island, IslandInfo> = {
  oahu: {
    label: "Oʻahu",
    center: { lat: 21.3069, lon: -157.8583, place: "Honolulu" },
    surf: { lat: 21.665, lon: -158.053, place: "North Shore (Pipeline)" },
    npsParks: ["perl", "hono"],
    zoneKeywords: ["oahu", "honolulu", "waianae", "koolau"],
  },
  maui: {
    label: "Maui",
    center: { lat: 20.8893, lon: -156.4729, place: "Kahului" },
    surf: { lat: 20.9333, lon: -156.3583, place: "Hoʻokipa" },
    npsParks: ["hale"],
    zoneKeywords: ["maui", "haleakala", "kahoolawe"],
  },
  kauai: {
    label: "Kauaʻi",
    center: { lat: 21.9811, lon: -159.3711, place: "Līhuʻe" },
    surf: { lat: 22.205, lon: -159.503, place: "Hanalei Bay" },
    npsParks: [],
    zoneKeywords: ["kauai", "niihau"],
  },
  "big-island": {
    label: "Hawaiʻi (Big Island)",
    center: { lat: 19.7297, lon: -155.09, place: "Hilo" },
    surf: { lat: 19.76, lon: -155.085, place: "Honoliʻi" },
    npsParks: ["havo", "puho", "puhe", "kaho", "alka"],
    zoneKeywords: ["big island", "kona", "kohala", "hilo", "puna", "kau"],
  },
  molokai: {
    label: "Molokaʻi",
    center: { lat: 21.0889, lon: -157.0203, place: "Kaunakakai" },
    surf: { lat: 21.17, lon: -156.95, place: "North Shore" },
    npsParks: ["kala"],
    zoneKeywords: ["molokai"],
  },
  lanai: {
    label: "Lānaʻi",
    center: { lat: 20.8275, lon: -156.9219, place: "Lānaʻi City" },
    surf: { lat: 20.74, lon: -156.89, place: "Hulopoʻe Bay" },
    npsParks: [],
    zoneKeywords: ["lanai"],
  },
};

// Accepts the documented slugs plus common variants ("big island", "hawaii").
export function normalizeIsland(value: unknown): Island {
  const raw = String(value ?? "oahu")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[ʻ'’]/g, "");

  if ((ISLANDS as readonly string[]).includes(raw)) return raw as Island;
  if (raw === "hawaii" || raw === "hawai-i" || raw === "bigisland") return "big-island";
  if (raw === "oahu-island") return "oahu";
  return "oahu";
}

export function islandInfo(island: Island): IslandInfo {
  return ISLAND_DATA[island];
}
