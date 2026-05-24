import { isValidToken } from "@/lib/token-store";
import { paymentRequiredResponse } from "@/lib/payment-challenge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAYMENT_CHALLENGE = {
  toolName: "get_trail_status",
  amountCents: 25,
  description: "Hawaii trail status. Cost: $0.25 per call.",
  inputSchema: {
    type: "object",
    properties: {
      island: { type: "string", enum: ["oahu", "maui", "big island", "kauai", "molokai", "lanai"], default: "oahu" },
      trail: { type: "string", description: "Trail name (optional)" },
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
  const trail = searchParams.get("trail") ?? "diamond-head";

  return Response.json({
    island,
    trail,
    status: "Open",
    difficulty: "Moderate",
    length_miles: 1.6,
    conditions: "Dry, good footing",
    alerts: [],
    updated_at: new Date().toISOString(),
  });
}

export async function POST(req: Request) {
  const auth = req.headers.get("X-MCP-Account") ?? req.headers.get("Authorization");
  if (!auth) return paymentRequiredResponse(PAYMENT_CHALLENGE);
  if (!(await isValidToken(auth))) return UNAUTHORIZED;

  const body = await req.json().catch(() => ({}));
  const island: string = body.island ?? "oahu";
  const trail: string = body.trail ?? "diamond-head";

  return Response.json({
    island,
    trail,
    status: "Open",
    difficulty: "Moderate",
    length_miles: 1.6,
    conditions: "Dry, good footing",
    alerts: [],
    updated_at: new Date().toISOString(),
  });
}
