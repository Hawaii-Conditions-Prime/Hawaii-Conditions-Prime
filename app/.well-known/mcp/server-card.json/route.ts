import { NextResponse } from "next/server";
import serverJson from "@/server.json";

export const dynamic = "force-static";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=300",
};

// MCP server card — same identity/metadata published to the MCP Registry
// (server.json), served at the conventional discovery path so agents can
// find it without already knowing the registry entry.
export async function GET() {
  return NextResponse.json(serverJson, { headers: CORS_HEADERS });
}
