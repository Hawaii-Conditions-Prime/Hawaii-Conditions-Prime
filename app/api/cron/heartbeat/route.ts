import { NextRequest, NextResponse } from "next/server";
import RegistryHeartbeat from "@/registry-heartbeat";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const heartbeat = new RegistryHeartbeat({
      serverName: "hawaii-conditions",
      serverUrl: "https://hawaii-conditions.vercel.app/mcp",
      healthCheckUrl: "https://hawaii-conditions.vercel.app/health",
      heartbeatInterval: "CONSERVATIVE",
      capabilities: [
        "get_weather",
        "get_surf_conditions",
        "get_volcano_status",
        "get_trail_status",
        "get_ocean_safety",
        "get_full_briefing",
        "search_restaurants",
        "get_restaurant_details",
        "get_sun_times",
        "get_moon_phase",
        "ping"
      ]
    });

    const results = await heartbeat.sendAllPings();
    const successful = results.filter(r => r).length;

    console.log(`[CRON] Registry heartbeat complete: ${successful}/4 registries responded`);

    return NextResponse.json({
      success: true,
      message: "Registry heartbeat sent successfully",
      timestamp: new Date().toISOString(),
      results: {
        successful,
        total: 4,
        registries: ["official", "x402scan", "mppscan", "mcpmarket"]
      }
    });
  } catch (error) {
    console.error("[CRON] Heartbeat error:", error);
    return NextResponse.json(
      {
        error: "Heartbeat failed",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
