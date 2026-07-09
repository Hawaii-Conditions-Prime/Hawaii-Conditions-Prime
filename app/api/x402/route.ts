import { NextRequest, NextResponse } from "next/server";
import { TOOL_PRICES } from "@/lib/payment-challenge";
import { X402_ENABLED, settleFromHeader } from "@/lib/x402";
import { buildX402Catalog, x402RequirementsFor } from "@/lib/x402-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-PAYMENT",
  "Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE",
  "Access-Control-Max-Age": "86400",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// Catalog of every paid tool as an x402 resource (for marketplace discovery /
// "generate integration code"), or — with ?tool=<name> — a single payable
// resource that returns 402 until an `X-PAYMENT` header settles.
// The same catalog is also mirrored at /.well-known/x402 for crawlers that
// look there instead (see app/.well-known/x402/route.ts).
export async function GET(req: NextRequest) {
  const tool = req.nextUrl.searchParams.get("tool");
  if (tool) return handlePayableResource(req, tool);

  return NextResponse.json(buildX402Catalog(), { headers: CORS_HEADERS });
}

export function POST(req: NextRequest) {
  const tool = req.nextUrl.searchParams.get("tool");
  if (!tool) {
    return NextResponse.json({ error: "missing_tool", message: "Specify ?tool=<name>." }, { status: 400, headers: CORS_HEADERS });
  }
  return handlePayableResource(req, tool);
}

async function handlePayableResource(req: NextRequest, tool: string) {
  if (!(tool in TOOL_PRICES)) {
    return NextResponse.json({ error: "unknown_tool", tool }, { status: 404, headers: CORS_HEADERS });
  }

  if (!X402_ENABLED) {
    return NextResponse.json(
      { error: "x402_not_configured", message: "Set X402_PAY_TO to enable on-chain payments." },
      { status: 503, headers: CORS_HEADERS },
    );
  }

  const outcome = await settleFromHeader({
    paymentHeader: req.headers.get("X-PAYMENT"),
    requirements: x402RequirementsFor(tool),
  });

  if (!outcome.paid) {
    return NextResponse.json(outcome.body, { status: 402, headers: CORS_HEADERS });
  }

  return NextResponse.json(
    {
      ok: true,
      tool,
      paid_usd: TOOL_PRICES[tool],
      payer: outcome.payer ?? null,
      note: "Payment settled via x402. Replace this placeholder with live data fetching for the tool.",
    },
    { headers: { ...CORS_HEADERS, "X-PAYMENT-RESPONSE": outcome.settlementHeader } },
  );
}
