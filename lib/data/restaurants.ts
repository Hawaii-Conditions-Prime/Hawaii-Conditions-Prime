// Restaurant search and details via the Google Places API (New).
//
// The legacy `maps.googleapis.com/maps/api/place` endpoints are deprecated;
// this uses `places.googleapis.com/v1`, which takes the key in a header and
// requires an explicit field mask.

import { fetchJson } from "./http";

const PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const PLACES_DETAILS_URL = "https://places.googleapis.com/v1/places";

const SEARCH_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.currentOpeningHours.openNow",
  "places.primaryTypeDisplayName",
  "places.location",
].join(",");

const DETAIL_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "nationalPhoneNumber",
  "websiteUri",
  "rating",
  "userRatingCount",
  "priceLevel",
  "currentOpeningHours",
  "regularOpeningHours",
  "reviews",
  "primaryTypeDisplayName",
  "location",
  "googleMapsUri",
].join(",");

// Google returns PRICE_LEVEL_* enums; agents asked for "$"–"$$$$".
const PRICE_ENUM_TO_SYMBOL: Record<string, string> = {
  PRICE_LEVEL_FREE: "Free",
  PRICE_LEVEL_INEXPENSIVE: "$",
  PRICE_LEVEL_MODERATE: "$$",
  PRICE_LEVEL_EXPENSIVE: "$$$",
  PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
};

const SYMBOL_TO_PRICE_ENUM: Record<string, string> = {
  $: "PRICE_LEVEL_INEXPENSIVE",
  $$: "PRICE_LEVEL_MODERATE",
  $$$: "PRICE_LEVEL_EXPENSIVE",
  $$$$: "PRICE_LEVEL_VERY_EXPENSIVE",
};

interface PlaceSummary {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  currentOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  primaryTypeDisplayName?: { text: string };
  location?: { latitude: number; longitude: number };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  reviews?: Array<{
    rating?: number;
    text?: { text: string };
    relativePublishTimeDescription?: string;
    authorAttribution?: { displayName?: string };
  }>;
}

function requireKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not configured on this deployment.");
  return key;
}

function normalizePlace(p: PlaceSummary) {
  return {
    place_id: p.id,
    name: p.displayName?.text ?? null,
    address: p.formattedAddress ?? null,
    rating: p.rating ?? null,
    review_count: p.userRatingCount ?? null,
    price: p.priceLevel ? (PRICE_ENUM_TO_SYMBOL[p.priceLevel] ?? null) : null,
    open_now: p.currentOpeningHours?.openNow ?? null,
    category: p.primaryTypeDisplayName?.text ?? null,
    coordinates: p.location ? { lat: p.location.latitude, lon: p.location.longitude } : null,
  };
}

export async function searchRestaurants(params: {
  location: string;
  cuisine?: string;
  price?: string;
  open_now?: boolean;
}) {
  const key = requireKey();
  const query = [params.cuisine, "restaurants in", params.location, "Hawaii"]
    .filter(Boolean)
    .join(" ");

  const body: Record<string, unknown> = {
    textQuery: query,
    includedType: "restaurant",
    maxResultCount: 15,
  };

  if (params.open_now) body.openNow = true;
  const priceEnum = params.price ? SYMBOL_TO_PRICE_ENUM[params.price] : undefined;
  if (priceEnum) body.priceLevels = [priceEnum];

  const data = await fetchJson<{ places?: PlaceSummary[] }>("Google Places", PLACES_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": SEARCH_FIELDS,
    },
    body: JSON.stringify(body),
  });

  const results = (data.places ?? []).map(normalizePlace);

  return {
    query: { location: params.location, cuisine: params.cuisine ?? null, price: params.price ?? null, open_now: params.open_now ?? false },
    result_count: results.length,
    results,
    next_step: "Call get_restaurant_details with a place_id for hours, reviews, and contact details.",
    source: "Google Places API (New)",
    retrieved_at: new Date().toISOString(),
  };
}

export async function getRestaurantDetails(placeId: string) {
  const key = requireKey();

  const place = await fetchJson<PlaceSummary>(
    "Google Places",
    `${PLACES_DETAILS_URL}/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": DETAIL_FIELDS,
      },
    },
  );

  return {
    ...normalizePlace(place),
    phone: place.nationalPhoneNumber ?? null,
    website: place.websiteUri ?? null,
    google_maps_url: place.googleMapsUri ?? null,
    hours:
      place.currentOpeningHours?.weekdayDescriptions ??
      place.regularOpeningHours?.weekdayDescriptions ??
      null,
    reviews: (place.reviews ?? []).slice(0, 5).map((r) => ({
      rating: r.rating ?? null,
      text: r.text?.text ?? null,
      author: r.authorAttribution?.displayName ?? null,
      published: r.relativePublishTimeDescription ?? null,
    })),
    source: "Google Places API (New)",
    retrieved_at: new Date().toISOString(),
  };
}
