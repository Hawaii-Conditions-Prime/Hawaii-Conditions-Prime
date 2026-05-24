import { NextRequest, NextResponse } from "next/server";
import { TOOL_PRICES } from "@/lib/payment-challenge";
import { TOOL_INPUT_SCHEMAS } from "@/lib/tool-schemas";
import {
  X402_ENABLED,
  buildPaymentRequirements,
  facilitatorInfo,
  settleFromHeader,
} from "@/lib/x402";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVER_URL = (process.env.SERVER_URL ?? "https://hawaii-conditions.vercel.app").replace(/\/+$/, "");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-PAYMENT",
  "Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE",
  "Access-Control-Max-Age": "86400",
};

const TOOL_DESCRIPTIONS: Record<string, string> = {
  get_weather: "5-day Hawaii forecast, UV index, wind, sunrise/sunset.",
  get_surf_conditions: "Wave height, period, direction + 3-day surf forecast.",
  get_trail_status: "NPS alerts and state trail closures.",
  get_volcano_status: "Live Kīlauea status from USGS HVO.",
  get_ocean_safety: "Box jellyfish, rip currents, NOAA marine alerts.",
  get_full_briefing: "All five data sources combined — best value.",
  search_restaurants: "Find restaurants by location, cuisine, price, open-now.",
  get_restaurant_details: "Full hours, reviews, photos for a restaurant.",
};

function resourceUrl(tool: string) {
  return `${SERVER_URL}/api/x402?tool=${tool}`;
}

function requirementsFor(tool: string) {
  return buildPaymentRequirements({
    priceUsd: TOOL_PRICES[tool],
    resource: resourceUrl(tool),
    description: TOOL_DESCRIPTIONS[tool] ?? `Hawaii Conditions tool: ${tool}.`,
    outputSchema: TOOL_INPUT_SCHEMAS[tool],
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// Catalog of every paid tool as an x402 resource (for marketplace discovery /
// "generate integration code"), or — with ?tool=<name> — a single payable
// resource that returns 402 until an `X-PAYMENT` header settles.
export async function GET(req: NextRequest) {
  const tool = req.nextUrl.searchParams.get("tool");
  if (tool) return handlePayableResource(req, tool);

  return NextResponse.json(
    {
      x402Version: 1,
      service: "Hawaii Conditions",
      mcp_endpoint: `${SERVER_URL}/api/mcp`,
      x402: facilitatorInfo(),
      enabled: X402_ENABLED,
      resources: Object.keys(TOOL_PRICES).map((t) => ({
        tool: t,
        endpoint: resourceUrl(t),
        priceUsd: TOOL_PRICES[t],
        description: TOOL_DESCRIPTIONS[t] ?? null,
        accepts: X402_ENABLED ? [requirementsFor(t)] : [],
      })),
      ...(X402_ENABLED
        ? {}
        : { notice: "x402 is not yet configured. Set X402_PAY_TO (recipient wallet) to enable on-chain payments." }),
    },
    { headers: CORS_HEADERS },
  );
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
    requirements: requirementsFor(tool),
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
