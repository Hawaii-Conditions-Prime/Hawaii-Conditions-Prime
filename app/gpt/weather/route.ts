import { isValidToken } from "@/lib/token-store";
import { paymentRequiredResponse } from "@/lib/payment-challenge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAYMENT_CHALLENGE = {
  toolName: "get_weather",
  amountCents: 10,
  description: "Hawaii weather conditions. Cost: $0.10 per call.",
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
    temperature_f: 82,
    conditions: "Partly cloudy with trade winds",
    wind_mph: 15,
    humidity_pct: 68,
    uv_index: 9,
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
    temperature_f: 82,
    conditions: "Partly cloudy with trade winds",
    wind_mph: 15,
    humidity_pct: 68,
    uv_index: 9,
    updated_at: new Date().toISOString(),
  });
}
