import { isValidToken } from "@/lib/token-store";
import { paymentRequiredResponse } from "@/lib/payment-challenge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAYMENT_CHALLENGE = {
  toolName: "get_ocean_safety",
  amountCents: 50,
  description: "Hawaii ocean safety conditions. Cost: $0.50 per call.",
  inputSchema: {
    type: "object",
    properties: {
      island: { type: "string", enum: ["oahu", "maui", "big island", "kauai", "molokai", "lanai"], default: "oahu" },
      beach: { type: "string", description: "Beach name (optional)" },
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
  const beach = searchParams.get("beach") ?? "waikiki";

  return Response.json({
    beach,
    flag_color: "Yellow",
    flag_meaning: "Caution — moderate surf or currents",
    rip_current_risk: "Moderate",
    jellyfish_advisory: false,
    shark_advisory: false,
    swimming_conditions: "Caution advised",
    lifeguard_on_duty: true,
    updated_at: new Date().toISOString(),
  });
}

export async function POST(req: Request) {
  const auth = req.headers.get("X-MCP-Account") ?? req.headers.get("Authorization");
  if (!auth) return paymentRequiredResponse(PAYMENT_CHALLENGE);
  if (!(await isValidToken(auth))) return UNAUTHORIZED;

  const body = await req.json().catch(() => ({}));
  const beach: string = body.beach ?? "waikiki";

  return Response.json({
    beach,
    flag_color: "Yellow",
    flag_meaning: "Caution — moderate surf or currents",
    rip_current_risk: "Moderate",
    jellyfish_advisory: false,
    shark_advisory: false,
    swimming_conditions: "Caution advised",
    lifeguard_on_duty: true,
    updated_at: new Date().toISOString(),
  });
}
