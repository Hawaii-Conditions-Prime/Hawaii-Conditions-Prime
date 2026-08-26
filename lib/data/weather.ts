// Weather + astronomy from Open-Meteo (no API key required).

import { fetchJson } from "./http";
import { islandInfo, type Island } from "./islands";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

// https://open-meteo.com/en/docs — WMO weather interpretation codes.
const WMO_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Light rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Light snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with light hail",
  99: "Thunderstorm with heavy hail",
};

export function describeWeatherCode(code: number | undefined): string {
  return code === undefined ? "Unknown" : (WMO_CODES[code] ?? `WMO code ${code}`);
}

export function uvRisk(uv: number | undefined): string {
  if (uv === undefined) return "unknown";
  if (uv < 3) return "low";
  if (uv < 6) return "moderate";
  if (uv < 8) return "high";
  if (uv < 11) return "very high";
  return "extreme";
}

interface OpenMeteoForecast {
  current?: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    weather_code: number;
  };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    uv_index_max: number[];
    precipitation_probability_max: number[];
    precipitation_sum: number[];
    wind_speed_10m_max: number[];
    weather_code: number[];
    sunrise: string[];
    sunset: string[];
    daylight_duration: number[];
  };
}

function forecastUrl(lat: number, lon: number, days: number): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code",
    daily:
      "temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,weather_code,sunrise,sunset,daylight_duration",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "Pacific/Honolulu",
    forecast_days: String(days),
  });
  return `${FORECAST_URL}?${params}`;
}

export async function getWeather(island: Island) {
  const info = islandInfo(island);
  const data = await fetchJson<OpenMeteoForecast>(
    "Open-Meteo",
    forecastUrl(info.center.lat, info.center.lon, 5),
  );

  const daily = data.daily;
  const forecast = (daily?.time ?? []).map((date, i) => ({
    date,
    high_f: daily!.temperature_2m_max[i],
    low_f: daily!.temperature_2m_min[i],
    conditions: describeWeatherCode(daily!.weather_code[i]),
    uv_index_max: daily!.uv_index_max[i],
    uv_risk: uvRisk(daily!.uv_index_max[i]),
    precipitation_chance_pct: daily!.precipitation_probability_max[i],
    precipitation_in: daily!.precipitation_sum[i],
    max_wind_mph: daily!.wind_speed_10m_max[i],
    sunrise: daily!.sunrise[i],
    sunset: daily!.sunset[i],
  }));

  return {
    island,
    island_name: info.label,
    location: info.center.place,
    timezone: "Pacific/Honolulu (HST, UTC-10)",
    current: data.current
      ? {
          observed_at: data.current.time,
          temperature_f: data.current.temperature_2m,
          conditions: describeWeatherCode(data.current.weather_code),
          humidity_pct: data.current.relative_humidity_2m,
          wind_mph: data.current.wind_speed_10m,
          wind_direction_deg: data.current.wind_direction_10m,
        }
      : null,
    forecast,
    source: "Open-Meteo (https://open-meteo.com)",
    retrieved_at: new Date().toISOString(),
  };
}

export async function getSunTimes(island: Island, date?: string) {
  const info = islandInfo(island);
  const data = await fetchJson<OpenMeteoForecast>(
    "Open-Meteo",
    forecastUrl(info.center.lat, info.center.lon, 7),
  );

  const daily = data.daily;
  const idx = date ? (daily?.time ?? []).indexOf(date) : 0;
  const i = idx >= 0 ? idx : 0;

  if (!daily || !daily.time[i]) {
    return {
      island,
      island_name: info.label,
      error: "no_data_for_date",
      message: date
        ? `No sun data available for ${date}. Open-Meteo covers today through the next 6 days.`
        : "No sun data available.",
      source: "Open-Meteo (https://open-meteo.com)",
    };
  }

  const seconds = daily.daylight_duration?.[i];
  return {
    island,
    island_name: info.label,
    location: info.center.place,
    date: daily.time[i],
    sunrise: daily.sunrise[i],
    sunset: daily.sunset[i],
    daylight_hours: seconds ? Number((seconds / 3600).toFixed(2)) : null,
    timezone: "Pacific/Honolulu (HST, UTC-10)",
    source: "Open-Meteo (https://open-meteo.com)",
    retrieved_at: new Date().toISOString(),
  };
}
