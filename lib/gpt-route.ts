// Shared handler factory for the /gpt/* REST surface.
//
// These routes previously validated an API key but never debited the prepaid
// balance, so every "paid" endpoint served for free. Billing now runs through
// the same ledger the MCP rail uses: debit, execute, refund on upstream
// failure — so a tool costs the same no matter which surface an agent calls.

import { isValidToken } from "./token-store";
import { paymentRequiredResponse, TOOL_PRICES } from "./payment-challenge";
import { creditBalance, deductBalance, getAccountByKey } from "./ledger";
import { TOOL_INPUT_SCHEMAS } from "./tool-schemas";
import { executeTool } from "./data";

const UNAUTHORIZED = () =>
  Response.json(
    { error: "unauthorized", message: "Invalid API key. Register with register_agent at /api/mcp." },
    { status: 401 },
  );

function authOf(req: Request): string | null {
  return req.headers.get("X-MCP-Account") ?? req.headers.get("Authorization");
}

async function paramsOf(req: Request): Promise<Record<string, unknown>> {
  if (req.method === "POST") {
    return (await req.json().catch(() => ({}))) as Record<string, unknown>;
  }
  return Object.fromEntries(new URL(req.url).searchParams);
}

async function refund(auth: string, cents: number, tool: string): Promise<void> {
  try {
    const account = await getAccountByKey(auth);
    if (account) await creditBalance(account.id, cents, `refund: ${tool} upstream failure`);
  } catch (err) {
    console.error(`refund failed for ${tool}:`, err);
  }
}

export function freeToolRoute(tool: string) {
  const handler = async (req: Request) => {
    try {
      return Response.json(await executeTool(tool, await paramsOf(req)));
    } catch (err) {
      return Response.json(
        { error: "upstream_unavailable", tool, message: (err as Error).message },
        { status: 502 },
      );
    }
  };
  return { GET: handler, POST: handler };
}

export function paidToolRoute(tool: string) {
  const amountCents = Math.round((TOOL_PRICES[tool] ?? 0.1) * 100);

  const handler = async (req: Request) => {
    const auth = authOf(req);
    if (!auth) {
      return paymentRequiredResponse({ toolName: tool, amountCents, inputSchema: TOOL_INPUT_SCHEMAS[tool] });
    }
    if (!(await isValidToken(auth))) return UNAUTHORIZED();

    try {
      await deductBalance(auth, amountCents, tool);
    } catch (err) {
      if (err instanceof Error && err.message === "insufficient_balance") {
        return paymentRequiredResponse({ toolName: tool, amountCents, inputSchema: TOOL_INPUT_SCHEMAS[tool] });
      }
      return Response.json({ error: "billing_error", tool }, { status: 500 });
    }

    try {
      return Response.json(await executeTool(tool, await paramsOf(req)));
    } catch (err) {
      await refund(auth, amountCents, tool);
      return Response.json(
        {
          error: "upstream_unavailable",
          tool,
          message: (err as Error).message,
          refunded_cents: amountCents,
        },
        { status: 502 },
      );
    }
  };

  return { GET: handler, POST: handler };
}
