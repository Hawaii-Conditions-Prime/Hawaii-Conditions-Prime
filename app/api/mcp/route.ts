import { NextRequest, NextResponse } from "next/server";
import { isValidToken } from "@/lib/token-store";
import { paymentRequiredResponse } from "@/lib/payment-challenge";
import { TOOL_INPUT_SCHEMAS } from "@/lib/tool-schemas";
import { stripe } from "@/lib/stripe";
import sql from "@/lib/db";
import {
  creditBalance,
  deductBalance,
  getAccountByKey,
  getTransactions,
  registerAgent,
  toBalanceResponse,
} from "@/lib/ledger";
import { executeTool } from "@/lib/data";
import {
  X402_ENABLED,
  buildPaymentRequirements,
  facilitatorInfo,
  settleFromHeader,
} from "@/lib/x402";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SERVER_URL = process.env.SERVER_URL ?? "https://hawaii-conditions-prime.vercel.app";
const PAYMENT_PROTOCOLS = X402_ENABLED ? ["x402", "stripe-card-prepaid"] : ["stripe-card-prepaid"];

const TOOL_COSTS: Record<string, number> = {
  ping: 0,
  get_sun_times: 0,
  get_moon_phase: 0,
  register_agent: 0,
  get_balance: 0,
  create_wallet_setup: 0,
  save_payment_method: 0,
  link_stripe_customer: 0,
  recent_transactions: 0,
  add_funds_5: 0,
  add_funds_10: 0,
  add_funds_20: 0,
  get_weather: 10,
  get_surf_conditions: 10,
  get_trail_status: 25,
  get_volcano_status: 25,
  get_ocean_safety: 50,
  get_full_briefing: 200,
  search_restaurants: 25,
  get_restaurant_details: 15,
};

const FREE_ANNOTATION = {
  "x-payment-info": {
    price: 0,
    currency: "USD",
    protocols: PAYMENT_PROTOCOLS,
    billing: "free",
  },
};

const paidAnnotation = (amount: string, inputSchema: Record<string, unknown>) => ({
  "x-payment-info": {
    price: Number(amount),
    currency: "USD",
    protocols: PAYMENT_PROTOCOLS,
    billing: "prepaid_balance",
    accountHeader: "X-MCP-Account",
  },
  input_schema: inputSchema,
  inputSchema,
});

const topupAnnotation = (topup_amount_usd: string) => ({
  "x-payment-info": {
    price: 0,
    currency: "USD",
    protocols: PAYMENT_PROTOCOLS,
    billing: "free",
  },
  topup_amount_usd,
});

const ALL_TOOLS = [
  { name: "ping",                  annotations: FREE_ANNOTATION,            description: "Health check — returns server status. Free.",                                                                    inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "register_agent",        annotations: FREE_ANNOTATION,            description: "Create a prepaid account. Returns api_key (format: mcp_live_…). Store it immediately — shown only once. Free.", inputSchema: { type: "object", properties: { agent_id: { type: "string", description: "Optional unique identifier for this agent" }, display_name: { type: "string", description: "Human-readable name for this agent" } } } },
  { name: "get_balance",           annotations: FREE_ANNOTATION,            description: "Returns current balance, original load amount, and low-balance flag. Free.",                                    inputSchema: { type: "object", properties: { api_key: { type: "string", description: "Optional api key. Prefer X-MCP-Account header." } }, required: [] } },
  { name: "create_wallet_setup",   annotations: FREE_ANNOTATION,            description: "Initialise Stripe SetupIntent — returns client_secret for saving a card. Free.",                                inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "save_payment_method",   annotations: FREE_ANNOTATION,            description: "Attach a Stripe payment method (pm_…) to your account for autonomous top-ups. Free.",                          inputSchema: { type: "object", required: ["payment_method_id"], properties: { payment_method_id: { type: "string", description: "Stripe payment method ID (pm_…)" } } } },
  { name: "link_stripe_customer",  annotations: FREE_ANNOTATION,            description: "Link an existing Stripe customer ID (cus_…) to your account. Free.",                                            inputSchema: { type: "object", required: ["customer_id"], properties: { customer_id: { type: "string", description: "Stripe customer ID (cus_…)" } } } },
  { name: "recent_transactions",   annotations: FREE_ANNOTATION,            description: "View recent credits and debits (default 20, max 50). Free.",                                                    inputSchema: { type: "object", properties: { api_key: { type: "string", description: "Optional api key. Prefer X-MCP-Account header." }, limit: { type: "number", description: "Number of transactions to return (max 50)", default: 20 } } } },
  { name: "add_funds_5",           annotations: topupAnnotation("5.00"),    description: "Charge your saved card $5 — balance credited after Stripe payment confirmation. Free to call.",                  inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "add_funds_10",          annotations: topupAnnotation("10.00"),   description: "Charge your saved card $10 — balance credited after Stripe payment confirmation. Free to call.",                 inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "add_funds_20",          annotations: topupAnnotation("20.00"),   description: "Charge your saved card $20 — balance credited after Stripe payment confirmation. Free to call.",                 inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "get_sun_times",         annotations: FREE_ANNOTATION,            description: "Sunrise, sunset, and daylight duration by island (HST). Free.",                                                  inputSchema: { type: "object", properties: { island: { type: "string", enum: ["oahu", "maui", "kauai", "big-island", "molokai", "lanai"], default: "oahu" }, date: { type: "string", description: "Date in YYYY-MM-DD format (defaults to today)" } } } },
  { name: "get_moon_phase",        annotations: FREE_ANNOTATION,            description: "Current moon phase, illumination percentage, moonrise/moonset times, and days to next full/new moon. Free.",     inputSchema: { type: "object", properties: { date: { type: "string", description: "Date in YYYY-MM-DD format (defaults to today)" } } } },
  { name: "get_weather",           annotations: paidAnnotation("0.10", TOOL_INPUT_SCHEMAS.get_weather),              description: "5-day forecast, UV index, wind, sunrise/sunset. Cost: $0.10.",                                      inputSchema: TOOL_INPUT_SCHEMAS.get_weather,           input_schema: TOOL_INPUT_SCHEMAS.get_weather },
  { name: "get_surf_conditions",   annotations: paidAnnotation("0.10", TOOL_INPUT_SCHEMAS.get_surf_conditions),      description: "Wave height, period, direction + 3-day forecast. Cost: $0.10.",                                     inputSchema: TOOL_INPUT_SCHEMAS.get_surf_conditions,   input_schema: TOOL_INPUT_SCHEMAS.get_surf_conditions },
  { name: "get_trail_status",      annotations: paidAnnotation("0.25", TOOL_INPUT_SCHEMAS.get_trail_status),         description: "NPS alerts and state trail closures. Cost: $0.25.",                                                  inputSchema: TOOL_INPUT_SCHEMAS.get_trail_status,      input_schema: TOOL_INPUT_SCHEMAS.get_trail_status },
  { name: "get_volcano_status",    annotations: paidAnnotation("0.25", TOOL_INPUT_SCHEMAS.get_volcano_status),       description: "Live Kīlauea status from USGS HVO. Cost: $0.25.",                                                   inputSchema: TOOL_INPUT_SCHEMAS.get_volcano_status,    input_schema: TOOL_INPUT_SCHEMAS.get_volcano_status },
  { name: "get_ocean_safety",      annotations: paidAnnotation("0.50", TOOL_INPUT_SCHEMAS.get_ocean_safety),         description: "Box jellyfish, rip currents, NOAA marine alerts. Cost: $0.50.",                                     inputSchema: TOOL_INPUT_SCHEMAS.get_ocean_safety,      input_schema: TOOL_INPUT_SCHEMAS.get_ocean_safety },
  { name: "get_full_briefing",     annotations: paidAnnotation("2.00", TOOL_INPUT_SCHEMAS.get_full_briefing),        description: "All five data sources combined — weather, surf, trails, volcano, ocean safety. Best value at $2.00.", inputSchema: TOOL_INPUT_SCHEMAS.get_full_briefing,     input_schema: TOOL_INPUT_SCHEMAS.get_full_briefing },
  { name: "search_restaurants",    annotations: paidAnnotation("0.25", TOOL_INPUT_SCHEMAS.search_restaurants),       description: "Find restaurants by location, cuisine, price range, open-now filter. Cost: $0.25.",                   inputSchema: TOOL_INPUT_SCHEMAS.search_restaurants,    input_schema: TOOL_INPUT_SCHEMAS.search_restaurants },
  { name: "get_restaurant_details",annotations: paidAnnotation("0.15", TOOL_INPUT_SCHEMAS.get_restaurant_details),   description: "Full hours, reviews, photos for a restaurant by place_id. Cost: $0.15.",                            inputSchema: TOOL_INPUT_SCHEMAS.get_restaurant_details,input_schema: TOOL_INPUT_SCHEMAS.get_restaurant_details },
];

const MCP_GET_PAYMENT_INFO = {
  price: 0,
  currency: "USD",
  protocols: PAYMENT_PROTOCOLS,
  billing: "free",
  ...(X402_ENABLED ? { x402: facilitatorInfo() } : {}),
};

const MCP_POST_PAYMENT_INFO = {
  price: null,
  minPrice: 0,
  maxPrice: 2,
  currency: "USD",
  protocols: PAYMENT_PROTOCOLS,
  billing: X402_ENABLED ? "x402_or_prepaid_balance" : "mixed_prepaid_balance",
  accountHeader: "X-MCP-Account",
  paymentHeader: X402_ENABLED ? "X-PAYMENT" : undefined,
  ...(X402_ENABLED ? { x402: facilitatorInfo() } : {}),
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-MCP-Account, MCP-Session-Id, X-PAYMENT",
  "Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE, X-Payment-Info, X-Payment-Protocols, X-Payment-Price",
  "Access-Control-Max-Age": "86400",
};

function paymentMetadataHeaders(info: Record<string, unknown>) {
  return {
    "X-Payment-Info": JSON.stringify(info),
    "X-Payment-Protocols": PAYMENT_PROTOCOLS.join(","),
    "X-Payment-Price": typeof info.price === "number" ? String(info.price) : "mixed",
  };
}

function json(data: unknown, status = 200, paymentInfo?: Record<string, unknown>, extraHeaders?: Record<string, string>) {
  return NextResponse.json(data, {
    status,
    headers: {
      ...CORS_HEADERS,
      ...(paymentInfo ? paymentMetadataHeaders(paymentInfo) : {}),
      ...(extraHeaders ?? {}),
    },
  });
}

function text(t: string) {
  return { content: [{ type: "text", text: t }] };
}

function getAuth(req: NextRequest, args?: Record<string, unknown>): string | null {
  return req.headers.get("X-MCP-Account") ?? req.headers.get("Authorization") ?? (args?.api_key as string | undefined) ?? null;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  if ((req.headers.get("Accept") ?? "").includes("text/event-stream")) {
    return new Response("SSE not supported in this stateless deployment. Use POST for all MCP JSON-RPC requests.", { status: 405, headers: { ...CORS_HEADERS, ...paymentMetadataHeaders(MCP_GET_PAYMENT_INFO), "Content-Type": "text/plain", Allow: "POST, OPTIONS" } });
  }

  return json({
    name: "HawaiiConditions",
    version: "1.0.0",
    description: "Real-time Hawaii conditions — surf, weather, trails, volcano, ocean safety, restaurants.",
    endpoint: `${SERVER_URL}/mcp`,
    transport: "streamable-http",
    auth: "X-MCP-Account: mcp_live_<api_key>  |  Authorization: Bearer mcp_live_<api_key>",
    register: `${SERVER_URL}/mcp (call register_agent tool — free, no credentials needed)`,
    skill: `${SERVER_URL}/skill.md`,
    "x-payment-info": MCP_GET_PAYMENT_INFO,
    tools: ALL_TOOLS,
  }, 200, MCP_GET_PAYMENT_INFO);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400, MCP_POST_PAYMENT_INFO);
  }

  const method = body?.method as string | undefined;
  const id = body?.id ?? null;

  if (method === "initialize") {
    return json({ jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "HawaiiConditions", version: "1.0.0" }, "x-payment-info": MCP_POST_PAYMENT_INFO } }, 200, MCP_POST_PAYMENT_INFO);
  }

  if (method === "tools/list") {
    return json({ jsonrpc: "2.0", id, result: { tools: ALL_TOOLS, "x-payment-info": MCP_POST_PAYMENT_INFO } }, 200, MCP_POST_PAYMENT_INFO);
  }

  if (method === "tools/call") {
    const params = (body?.params ?? {}) as Record<string, unknown>;
    const toolName = params.name as string;
    const args = (params.arguments ?? {}) as Record<string, unknown>;

    if (!toolName || !(toolName in TOOL_COSTS)) {
      return json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${toolName}` } }, 200, MCP_POST_PAYMENT_INFO);
    }

    const cost = TOOL_COSTS[toolName];
    const auth = getAuth(req, args);
    let settlementHeader: string | undefined;

    if (cost > 0) {
      const paymentHeader = req.headers.get("X-PAYMENT");

      // Rail 1: on-chain x402 payment (no account required).
      if (X402_ENABLED && paymentHeader) {
        const outcome = await settleFromHeader({
          paymentHeader,
          requirements: buildPaymentRequirements({
            priceUsd: cost / 100,
            resource: `${SERVER_URL}/api/mcp`,
            description: `Hawaii Conditions tool: ${toolName} ($${(cost / 100).toFixed(2)} per call).`,
            outputSchema: TOOL_INPUT_SCHEMAS[toolName],
          }),
        });

        if (!outcome.paid) {
          return json(outcome.body, 402, MCP_POST_PAYMENT_INFO);
        }
        settlementHeader = outcome.settlementHeader;
      } else {
        // Rail 2: prepaid Stripe balance (X-MCP-Account / api_key).
        if (!auth) {
          return paymentRequiredResponse({ toolName, amountCents: cost, inputSchema: TOOL_INPUT_SCHEMAS[toolName] });
        }

        if (!(await isValidToken(auth))) {
          return json({ jsonrpc: "2.0", id, error: { code: -32001, message: "Unauthorized: invalid API key. Pay on-chain via the X-PAYMENT (x402) header, or call register_agent to create a free prepaid account." } }, 401, MCP_POST_PAYMENT_INFO);
        }

        try {
          await deductBalance(auth, cost, toolName);
        } catch (error) {
          if (error instanceof Error && error.message === "insufficient_balance") {
            return paymentRequiredResponse({ toolName, amountCents: cost, inputSchema: TOOL_INPUT_SCHEMAS[toolName] });
          }

          return json({ jsonrpc: "2.0", id, error: { code: -32000, message: "Billing error while deducting prepaid balance." } }, 500, MCP_POST_PAYMENT_INFO);
        }
      }
    }

    let result: { content: Array<{ type: string; text: string }> };
    try {
      result = await callTool(toolName, args, auth);
    } catch (error) {
      // The prepaid rail debits before the tool runs, so an upstream failure
      // would otherwise charge for nothing — put the money back.
      if (cost > 0 && !settlementHeader && auth) {
        await refundPrepaid(auth, cost, toolName);
      }
      return json(
        {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32002,
            message: `Upstream data source failed for ${toolName}: ${(error as Error).message}`,
            data: { refunded: cost > 0 && !settlementHeader ? cost : 0 },
          },
        },
        200,
        MCP_POST_PAYMENT_INFO,
      );
    }

    return json({ jsonrpc: "2.0", id, result }, 200, MCP_POST_PAYMENT_INFO, settlementHeader ? { "X-PAYMENT-RESPONSE": settlementHeader } : undefined);
  }

  return json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unsupported method: ${method}` } }, 200, MCP_POST_PAYMENT_INFO);
}

// Best-effort reversal of a prepaid debit when the tool itself failed.
// A failed refund must not mask the original upstream error, so it is logged
// rather than thrown.
async function refundPrepaid(auth: string, cents: number, tool: string): Promise<void> {
  try {
    const account = await getAccountByKey(auth);
    if (account) await creditBalance(account.id, cents, `refund: ${tool} upstream failure`);
  } catch (err) {
    console.error(`refund failed for ${tool}:`, err);
  }
}

async function callTool(tool: string, args: Record<string, unknown>, auth: string | null): Promise<{ content: Array<{ type: string; text: string }> }> {
  switch (tool) {
    case "ping":
      return text(JSON.stringify({ status: "ok", server: "HawaiiConditions", version: "1.0.0", timestamp: new Date().toISOString() }));

    case "register_agent": {
      const result = await registerAgent(args.agent_id as string | undefined, args.display_name as string | undefined);
      return text(JSON.stringify({ api_key: result.api_key, account: toBalanceResponse(result.account), instructions: "Send this key as X-MCP-Account on future paid calls." }));
    }

    case "get_balance": {
      if (!auth) return text(JSON.stringify({ error: "api_key_required", message: "Send X-MCP-Account, Authorization Bearer, or api_key." }));
      const account = await getAccountByKey(auth);
      if (!account) return text(JSON.stringify({ error: "account_not_found" }));
      return text(JSON.stringify(toBalanceResponse(account)));
    }

    case "recent_transactions": {
      if (!auth) return text(JSON.stringify({ error: "api_key_required", message: "Send X-MCP-Account, Authorization Bearer, or api_key." }));
      const transactions = await getTransactions(auth, Number(args.limit ?? 20));
      return text(JSON.stringify({ transactions }));
    }

    case "create_wallet_setup": {
      if (!auth) return text(JSON.stringify({ error: "api_key_required" }));

      const account = await getAccountByKey(auth);
      if (!account) return text(JSON.stringify({ error: "account_not_found" }));

      let customerId = account.stripe_customer_id;

      if (!customerId) {
        const customer = await stripe.customers.create({ metadata: { api_key: account.api_key } });
        customerId = customer.id;
        await sql`UPDATE mcp_accounts SET stripe_customer_id = ${customerId} WHERE id = ${account.id}`;
      }

      const setupIntent = await stripe.setupIntents.create({ customer: customerId, payment_method_types: ["card"] });
      return text(JSON.stringify({ client_secret: setupIntent.client_secret, customer_id: customerId }));
    }

    case "save_payment_method": {
      const payment_method_id = args.payment_method_id as string;
      if (!auth || !payment_method_id) return text(JSON.stringify({ error: "missing_params" }));
      const account = await getAccountByKey(auth);
      if (!account) return text(JSON.stringify({ error: "account_not_found" }));
      await stripe.paymentMethods.attach(payment_method_id, { customer: account.stripe_customer_id! });
      await sql`UPDATE mcp_accounts SET stripe_payment_method_id = ${payment_method_id} WHERE id = ${account.id}`;
      return text(JSON.stringify({ success: true }));
    }

    case "link_stripe_customer":
      return text(JSON.stringify({ error: "stripe_not_wired", message: `${tool} requires Stripe PaymentIntent/SetupIntent wiring before production crediting. Do not credit balances without Stripe confirmation.`, tool }));

    case "add_funds_5":
    case "add_funds_10":
    case "add_funds_20": {
      if (!auth) return text(JSON.stringify({ error: "api_key_required" }));
      const account = await getAccountByKey(auth);
      if (!account) return text(JSON.stringify({ error: "account_not_found" }));
      if (!account.stripe_payment_method_id) return text(JSON.stringify({ error: "no_payment_method", message: "Save a payment method first." }));
      const amountMap: Record<string, number> = { add_funds_5: 500, add_funds_10: 1000, add_funds_20: 2000 };
      const amount = amountMap[tool];
      const intent = await stripe.paymentIntents.create({ amount, currency: "usd", customer: account.stripe_customer_id!, payment_method: account.stripe_payment_method_id!, off_session: true, confirm: true });
      return text(JSON.stringify({ success: true, payment_intent: intent.id, amount }));
    }

    case "get_sun_times":
    case "get_moon_phase":
    case "get_weather":
    case "get_surf_conditions":
    case "get_trail_status":
    case "get_volcano_status":
    case "get_ocean_safety":
    case "get_full_briefing":
    case "search_restaurants":
    case "get_restaurant_details":
      return text(JSON.stringify(await executeTool(tool, args)));

    default:
      return text(JSON.stringify({ error: `Unknown tool: ${tool}` }));
  }
}
