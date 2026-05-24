import { isValidToken } from "@/lib/token-store";
import { paymentRequiredResponse } from "@/lib/payment-challenge";
import { TOOL_INPUT_SCHEMAS } from "@/lib/tool-schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAYMENT_CHALLENGE = {
  toolName: "get_surf_conditions",
  amountCents: 10,
  inputSchema: TOOL_INPUT_SCHEMAS.get_surf_conditions,
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
    wave_height_ft: { min: 4, max: 8 },
    swell_direction: "NNW",
    swell_period_s: 14,
    wind: "Light offshores",
    rating: "Good",
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
    wave_height_ft: { min: 4, max: 8 },
    swell_direction: "NNW",
    swell_period_s: 14,
    wind: "Light offshores",
    rating: "Good",
    updated_at: new Date().toISOString(),
  });
}
