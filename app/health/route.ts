import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      server: "HawaiiConditions",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      endpoint: `${process.env.SERVER_URL ?? "https://hawaii-conditions.vercel.app"}/mcp`,
      transport: "streamable-http",
    },
    {
      headers: { "Access-Control-Allow-Origin": "*" },
    }
  );
}
