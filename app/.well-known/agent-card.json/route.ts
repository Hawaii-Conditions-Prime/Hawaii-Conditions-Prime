import { NextResponse } from "next/server";
import { TOOL_PRICES } from "@/lib/payment-challenge";
import { facilitatorInfo, X402_ENABLED } from "@/lib/x402";
import { TOOL_DESCRIPTIONS } from "@/lib/x402-catalog";
import serverJson from "@/server.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVER_URL = (process.env.SERVER_URL ?? "https://hawaii-conditions-prime.vercel.app").replace(/\/+$/, "");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=300",
};

const FREE_TOOLS = [
  { name: "ping", description: "Health check, server info, and setup instructions." },
  { name: "get_sun_times", description: "Sunrise, sunset, daylight duration (HST)." },
  { name: "get_moon_phase", description: "Moon phase, illumination, moonrise/moonset times." },
  { name: "register_agent", description: "Create a prepaid account; returns an API key." },
  { name: "get_balance", description: "Current balance and recent transactions." },
];

// Agent card — a self-describing manifest at the conventional discovery
// path used by agent directories and marketplaces (AgentCash, x402 Bazaar,
// A2A-style agent catalogs) to identify this service, its skills, and how
// to pay for them, without a human first reading the README.
export async function GET() {
  const card = {
    name: serverJson.title,
    description: serverJson.description,
    url: `${SERVER_URL}/api/mcp`,
    version: serverJson.version,
    provider: {
      organization: "Hawaii-Conditions-Prime",
      url: SERVER_URL,
    },
    documentationUrl: `${SERVER_URL}/skill.md`,
    capabilities: {
      mcp: true,
      streaming: true,
      payments: X402_ENABLED ? ["x402", "stripe-card-prepaid"] : ["stripe-card-prepaid"],
    },
    payment: {
      x402: X402_ENABLED ? facilitatorInfo() : { enabled: false },
      discovery: `${SERVER_URL}/.well-known/x402`,
      prepaidLedger: {
        accountHeader: "X-MCP-Account",
        registerTool: "register_agent",
      },
    },
    skills: [
      ...FREE_TOOLS.map((t) => ({
        id: t.name,
        name: t.name,
        description: t.description,
        priceUsd: 0,
      })),
      ...Object.entries(TOOL_PRICES).map(([tool, price]) => ({
        id: tool,
        name: tool,
        description: TOOL_DESCRIPTIONS[tool] ?? tool,
        priceUsd: price,
      })),
    ],
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
  };

  return NextResponse.json(card, { headers: CORS_HEADERS });
}
