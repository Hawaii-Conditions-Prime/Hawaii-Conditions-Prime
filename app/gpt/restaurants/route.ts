import { isValidToken } from "@/lib/token-store";
import { paymentRequiredResponse } from "@/lib/payment-challenge";
import { TOOL_INPUT_SCHEMAS } from "@/lib/tool-schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAYMENT_CHALLENGE = {
  toolName: "search_restaurants",
  amountCents: 25,
  inputSchema: TOOL_INPUT_SCHEMAS.search_restaurants,
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
  const location = searchParams.get("location") ?? "Waikiki";
  const cuisine  = searchParams.get("cuisine") ?? null;
  const price    = searchParams.get("price") ?? null;

  return Response.json({
    location,
    cuisine,
    price,
    restaurants: [
      { name: "The Pig and the Lady", cuisine: "Local-Asian fusion", area: "Chinatown", rating: 4.5 },
      { name: "Ono Seafood", cuisine: "Hawaiian poke", area: "Kapahulu", rating: 4.7 },
      { name: "Rainbow Drive-In", cuisine: "Plate lunch", area: "Kapahulu", rating: 4.4 },
    ],
    updated_at: new Date().toISOString(),
  });
}

export async function POST(req: Request) {
  const auth = req.headers.get("X-MCP-Account") ?? req.headers.get("Authorization");
  if (!auth) return paymentRequiredResponse(PAYMENT_CHALLENGE);
  if (!(await isValidToken(auth))) return UNAUTHORIZED;

  const body = await req.json().catch(() => ({}));
  const location: string       = body.location ?? "Waikiki";
  const cuisine: string | null = body.cuisine ?? null;
  const price: string | null   = body.price ?? null;

  return Response.json({
    location,
    cuisine,
    price,
    restaurants: [
      { name: "The Pig and the Lady", cuisine: "Local-Asian fusion", area: "Chinatown", rating: 4.5 },
      { name: "Ono Seafood", cuisine: "Hawaiian poke", area: "Kapahulu", rating: 4.7 },
      { name: "Rainbow Drive-In", cuisine: "Plate lunch", area: "Kapahulu", rating: 4.4 },
    ],
    updated_at: new Date().toISOString(),
  });
}
