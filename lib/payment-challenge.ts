const PAYMENT_REALM = process.env.PAYMENT_REALM ?? "hawaii-conditions.vercel.app";
const PAYMENT_RECIPIENT = process.env.PAYMENT_RECIPIENT ?? process.env.STRIPE_ACCOUNT_ID ?? "stripe-card-prepaid";
const CHALLENGE_TTL_SECONDS = Number(process.env.PAYMENT_CHALLENGE_TTL_SECONDS ?? 300);

export const TOOL_PRICES: Record<string, number> = {
  get_weather:            0.10,
  get_surf_conditions:    0.10,
  get_trail_status:       0.25,
  get_volcano_status:     0.25,
  get_ocean_safety:       0.50,
  get_full_briefing:      2.00,
  search_restaurants:     0.25,
  get_restaurant_details: 0.15,
};

export type PaymentChallengeOptions = {
  toolName?: string;
  amountCents?: number;
  inputSchema?: Record<string, unknown>;
};

function base64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function challengeFor(toolName: string, amountCents: number) {
  const expires = new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000).toISOString();
  const id = `mpp_${toolName}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const requestObject = {
    currency: "USD",
    amount: String(amountCents),
    recipient: PAYMENT_RECIPIENT,
    payment_model: "stripe-card-prepaid",
    provider: "stripe",
    tool: toolName,
    top_up_options: ["add_funds_5", "add_funds_10", "add_funds_20"],
  };

  return {
    id,
    expires,
    method: "stripe-card-prepaid",
    intent: "fund",
    realm: PAYMENT_REALM,
    request: base64url(requestObject),
    request_object: requestObject,
  };
}

export function paymentHeaders(toolName = "paid_tool", amountCents = 10): Record<string, string> {
  const challenge = challengeFor(toolName, amountCents);

  return {
    "WWW-Authenticate": `Payment method="stripe-card-prepaid" intent="fund" realm="${PAYMENT_REALM}" id="${challenge.id}" expires="${challenge.expires}" request="${challenge.request}"`,
    "Content-Type": "application/json",
    "X-Payment-Provider": "stripe",
    "X-Payment-Protocol": "stripe-card-prepaid",
    "X-Payment-Info": JSON.stringify({
      price: (amountCents / 100).toFixed(2),
      currency: "USD",
      protocols: ["stripe-card-prepaid"],
      billing: "prepaid_balance",
      accountHeader: "X-MCP-Account",
    }),
  };
}

// Accepts either the new options object or a legacy URL string for older route compatibility.
export function paymentRequiredResponse(opts: string | PaymentChallengeOptions = {}): Response {
  const {
    toolName = "paid_tool",
    amountCents,
    inputSchema,
  } = typeof opts === "string" ? {} : opts;

  const resolvedAmountCents = amountCents ?? Math.round((TOOL_PRICES[toolName] ?? 0.10) * 100);
  const challenge = challengeFor(toolName, resolvedAmountCents);
  const costUsd = resolvedAmountCents / 100;
  const costStr = `$${costUsd.toFixed(2)}`;

  const body = {
    error: "payment_required",
    message: `This tool requires a prepaid balance. Cost per call: ${costStr}.`,
    payment_options: [challenge],
    challenges: [challenge],
    input_schema: inputSchema ?? { type: "object", properties: {}, required: [] },
    payment: {
      model: "prepaid_ledger",
      provider: "stripe",
      payment_method: "card",
      currency: "USD",
      cost_per_call_usd: costStr,
      cost_per_call_cents: resolvedAmountCents,
      protocol: "stripe-card-prepaid",
      challenge_id: challenge.id,
      expires: challenge.expires,
      request: challenge.request,
      how_to_pay: {
        step_1: "Call register_agent to create an account and receive your api_key (format: mcp_live_…)",
        step_2: "Call create_wallet_setup to initialise a Stripe SetupIntent — returns a client_secret for saving a card",
        step_3: "Use the client_secret with Stripe.js or the Stripe API to save your card (payment_method_id)",
        step_4: "Call save_payment_method with the returned payment_method_id to attach your card",
        step_5: "Call add_funds_5, add_funds_10, or add_funds_20 to charge your card and top up",
        step_6: "Pass your key on every request via X-MCP-Account: mcp_live_<your_api_key>",
      },
      top_up_options: [
        { tool: "add_funds_5",  amount: "$5.00",  description: "Charge $5.00 to your saved card" },
        { tool: "add_funds_10", amount: "$10.00", description: "Charge $10.00 to your saved card" },
        { tool: "add_funds_20", amount: "$20.00", description: "Charge $20.00 to your saved card" },
      ],
      low_balance_warning: "When your balance drops below $0.50, low_balance: true is returned so your agent can self-top-up before running out.",
    },
  };

  return new Response(JSON.stringify(body), {
    status: 402,
    headers: paymentHeaders(toolName, resolvedAmountCents),
  });
}
