import { NextResponse } from "next/server";
import { buildX402Catalog } from "@/lib/x402-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=300",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// Conventional x402 discovery path — mirrors /api/x402 (no ?tool=) for
// crawlers/marketplaces (e.g. AgentCash, the Coinbase x402 Bazaar) that
// look at /.well-known/x402 rather than a service-specific catalog route.
export async function GET() {
  return NextResponse.json(buildX402Catalog(), { headers: CORS_HEADERS });
}
