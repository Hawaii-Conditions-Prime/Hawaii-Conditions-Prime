import { isValidToken } from "@/lib/token-store";
import { paymentRequiredResponse } from "@/lib/payment-challenge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAYMENT_CHALLENGE = {
  toolName: "get_full_briefing",
  amountCents: 200,
  description: "Full Hawaii conditions briefing. Cost: $2.00 per call.",
  inputSchema: {
    type: "object",
    properties: {
      island: { type: "string", enum: ["oahu", "maui", "big island", "kauai", "molokai", "lanai"], default: "oahu" },
    },
  },
};

const UNAUTHORIZED = new Response(
  JSON.stringify({ error: "unauthorized", message: "Invalid API key. Register with register_agent at /api/mcp." }),
  { status: 401, headers: { "Content-Type": "application/json" } }
);

export async function GET(req: Request) {
  const auth = req.headers.get("X-MCP-Account") ?? req.headers.get("Authorization");
  if (!auth) return paymentRequiredResponse(PAYMENT_CHALLENGE);
  if (!(await isValidToken(auth))) return UNAUTHORIZED;

  const { searchParams } = new URL(req.url);
  const island = searchParams.get("island") ?? "oahu";

  return Response.json({
    island,
    summary: `Today on ${island}: warm and partly cloudy with trade winds. Good surf on the North Shore, moderate ocean safety conditions, no volcanic hazards. Sunrise at 06:02, sunset at 18:47.`,
    weather: { temperature_f: 82, conditions: "Partly cloudy", wind_mph: 15 },
    surf: { rating: "Good", wave_height_ft: { min: 4, max: 8 } },
    ocean_safety: { flag_color: "Yellow", rip_current_risk: "Moderate" },
    volcano: { alert_level: "Watch", lava_flow_hazard: false },
    sun: { sunrise: "06:02", sunset: "18:47" },
    updated_at: new Date().toISOString(),
  });
}

export async function POST(req: Request) {
  const auth = req.headers.get("X-MCP-Account") ?? req.headers.get("Authorization");
  if (!auth) return paymentRequiredResponse(PAYMENT_CHALLENGE);
  if (!(await isValidToken(auth))) return UNAUTHORIZED;

  const body = await req.json().catch(() => ({}));
  const island: string = body.island ?? "oahu";

  return Response.json({
    island,
    summary: `Today on ${island}: warm and partly cloudy with trade winds. Good surf on the North Shore, moderate ocean safety conditions, no volcanic hazards. Sunrise at 06:02, sunset at 18:47.`,
    weather: { temperature_f: 82, conditions: "Partly cloudy", wind_mph: 15 },
    surf: { rating: "Good", wave_height_ft: { min: 4, max: 8 } },
    ocean_safety: { flag_color: "Yellow", rip_current_risk: "Moderate" },
    volcano: { alert_level: "Watch", lava_flow_hazard: false },
    sun: { sunrise: "06:02", sunset: "18:47" },
    updated_at: new Date().toISOString(),
  });
}
