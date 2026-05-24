export async function executeTool(tool: string, params: Record<string, unknown>) {
  switch (tool) {
    case "get_surf_report": {
      const spot = (params.spot as string) ?? "pipeline";
      return {
        spot,
        wave_height_ft: { min: 4, max: 8 },
        swell_direction: "NNW",
        swell_period_s: 14,
        wind: "Light offshores",
        rating: "Good",
        updated_at: new Date().toISOString(),
      };
    }
    case "get_weather_forecast": {
      const island = (params.island as string) ?? "oahu";
      return {
        island,
        temperature_f: 82,
        conditions: "Partly cloudy with trade winds",
        wind_mph: 15,
        humidity_pct: 68,
        uv_index: 9,
        updated_at: new Date().toISOString(),
      };
    }
    case "run_analysis": {
      return {
        status: "ok",
        params,
        analyzed_at: new Date().toISOString(),
      };
    }
    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}
