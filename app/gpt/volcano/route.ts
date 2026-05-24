import { isValidToken } from "@/lib/token-store";
import { paymentRequiredResponse } from "@/lib/payment-challenge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAYMENT_CHALLENGE = {
  toolName: "get_volcano_status",
  amountCents: 25,
  description: "Hawaii volcano status. Cost: $0.25 per call.",
  inputSchema: {
    type: "object",
    properties: {
      volcano: { type: "string", enum: ["kilauea", "mauna-loa"], default: "kilauea" },
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
  const volcano = searchParams.get("volcano") ?? "kilauea";

  return Response.json({
    volcano,
    alert_level: "Watch",
    eruption_status: "Active — lava lake present in Halemaʻumaʻu Crater",
    lava_flow_hazard: false,
    vog_advisory: true,
    park_areas_closed: ["Halemaʻumaʻu overlook"],
    updated_at: new Date().toISOString(),
  });
}

export async function POST(req: Request) {
  const auth = req.headers.get("X-MCP-Account") ?? req.headers.get("Authorization");
  if (!auth) return paymentRequiredResponse(PAYMENT_CHALLENGE);
  if (!(await isValidToken(auth))) return UNAUTHORIZED;

  const body = await req.json().catch(() => ({}));
  const volcano: string = body.volcano ?? "kilauea";

  return Response.json({
    volcano,
    alert_level: "Watch",
    eruption_status: "Active — lava lake present in Halemaʻumaʻu Crater",
    lava_flow_hazard: false,
    vog_advisory: true,
    park_areas_closed: ["Halemaʻumaʻu overlook"],
    updated_at: new Date().toISOString(),
  });
}
