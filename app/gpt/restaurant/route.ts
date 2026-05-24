import { isValidToken } from "@/lib/token-store";
import { paymentRequiredResponse } from "@/lib/payment-challenge";
import { TOOL_INPUT_SCHEMAS } from "@/lib/tool-schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAYMENT_CHALLENGE = {
  toolName: "get_restaurant_details",
  amountCents: 15,
  inputSchema: TOOL_INPUT_SCHEMAS.get_restaurant_details,
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
  const place_id = searchParams.get("place_id") ?? "";
  if (!place_id) return Response.json({ error: "place_id query parameter is required" }, { status: 400 });

  return Response.json({
    place_id,
    island: "Oahu",
    cuisine: "Hawaiian",
    address: "123 Aloha St, Honolulu, HI 96815",
    phone: "+1-808-555-0100",
    hours: "Mon–Sun 11:00–21:00",
    rating: 4.5,
    price_range: "$$",
    reservations: true,
    updated_at: new Date().toISOString(),
  });
}

export async function POST(req: Request) {
  const auth = req.headers.get("X-MCP-Account") ?? req.headers.get("Authorization");
  if (!auth) return paymentRequiredResponse(PAYMENT_CHALLENGE);
  if (!(await isValidToken(auth))) return UNAUTHORIZED;

  const body = await req.json().catch(() => ({}));
  const place_id: string = body.place_id ?? "";
  if (!place_id) return Response.json({ error: "place_id is required" }, { status: 400 });

  return Response.json({
    place_id,
    island: "Oahu",
    cuisine: "Hawaiian",
    address: "123 Aloha St, Honolulu, HI 96815",
    phone: "+1-808-555-0100",
    hours: "Mon–Sun 11:00–21:00",
    rating: 4.5,
    price_range: "$$",
    reservations: true,
    updated_at: new Date().toISOString(),
  });
}
