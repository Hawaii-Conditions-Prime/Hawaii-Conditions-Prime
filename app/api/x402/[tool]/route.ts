import { NextRequest, NextResponse } from "next/server";
import { executeTool } from "@/lib/data";
import { TOOL_PRICES } from "@/lib/payment-challenge";
import { missingX402Env } from "@/lib/x402-catalog";
import { X402_ENABLED, getX402Server, nextRequestAdapter } from "@/lib/x402-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, PAYMENT-SIGNATURE",
  "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
  "Access-Control-Max-Age": "86400",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// A single payable x402 v2 resource per tool — e.g. GET /api/x402/get_weather.
// Returns 402 (with a PAYMENT-REQUIRED header + Bazaar discovery extension)
// until a valid `PAYMENT-SIGNATURE` header settles the price via the CDP
// facilitator, then serves the resource.
export async function GET(req: NextRequest, { params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;

  if (!(tool in TOOL_PRICES)) {
    return NextResponse.json({ error: "unknown_tool", tool }, { status: 404, headers: CORS_HEADERS });
  }

  if (!X402_ENABLED) {
    const missing = missingX402Env();
    return NextResponse.json(
      {
        error: "x402_not_configured",
        message: missing.length
          ? `This deployment cannot see: ${missing.join(", ")}. Set them for the Production environment in Vercel and redeploy.`
          : "X402_PAY_TO is set but empty.",
        missing_env: missing,
      },
      { status: 503, headers: CORS_HEADERS },
    );
  }

  let server;
  try {
    server = await getX402Server();
  } catch (err) {
    return NextResponse.json(
      { error: "x402_misconfigured", message: (err as Error).message },
      { status: 503, headers: CORS_HEADERS },
    );
  }

  const context = {
    adapter: nextRequestAdapter(req),
    path: `/api/x402/${tool}`,
    method: "GET",
    paymentHeader: req.headers.get("PAYMENT-SIGNATURE") ?? undefined,
  };

  const result = await server.processHTTPRequest(context);

  if (result.type === "payment-error") {
    return NextResponse.json(result.response.body, {
      status: result.response.status,
      headers: { ...CORS_HEADERS, ...result.response.headers },
    });
  }

  if (result.type === "no-payment-required") {
    return NextResponse.json({ error: "route_not_payment_protected", tool }, { status: 500, headers: CORS_HEADERS });
  }

  // Payment is verified but NOT yet settled. Fetch the data first so an
  // upstream failure returns an error without charging the agent — settle
  // only once there is something to hand back.
  let data: unknown;
  try {
    data = await executeTool(tool, Object.fromEntries(req.nextUrl.searchParams));
  } catch (err) {
    return NextResponse.json(
      {
        error: "upstream_unavailable",
        tool,
        message: (err as Error).message,
        note: "No payment was settled for this request.",
      },
      { status: 502, headers: CORS_HEADERS },
    );
  }

  const settlement = await server.processSettlement(result.paymentPayload, result.paymentRequirements, result.declaredExtensions);

  if (!settlement.success) {
    return NextResponse.json(settlement.response.body, {
      status: settlement.response.status,
      headers: { ...CORS_HEADERS, ...settlement.response.headers },
    });
  }

  return NextResponse.json(
    {
      ok: true,
      tool,
      paid_usd: TOOL_PRICES[tool],
      payer: settlement.payer ?? null,
      data,
    },
    { headers: { ...CORS_HEADERS, ...settlement.headers } },
  );
}
