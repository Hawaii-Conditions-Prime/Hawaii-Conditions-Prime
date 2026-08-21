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

// Informational index of every payable x402 resource (marketplace discovery /
// "generate integration code"). Each tool is its own payable resource at
// /api/x402/<tool> — see app/api/x402/[tool]/route.ts — this route does not
// process payments itself.
export async function GET() {
  return NextResponse.json(buildX402Catalog(), { headers: CORS_HEADERS });
}
