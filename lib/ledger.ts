import { randomUUID } from "crypto";
import sql from "./db";

const LOW_BALANCE_THRESHOLD_CENTS = 50;

export interface Account {
  id: string;
  api_key: string;
  agent_id: string | null;
  display_name: string | null;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  balance_cents: number;
  original_balance_cents: number;
  created_at: string;
}

export interface BalanceResponse {
  balance_cents: number;
  balance_usd: string;
  original_balance_cents: number;
  original_balance_usd: string;
  low_balance: boolean;
  threshold_usd: string;
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function toBalanceResponse(account: Account): BalanceResponse {
  return {
    balance_cents: account.balance_cents,
    balance_usd: formatUsd(account.balance_cents),
    original_balance_cents: account.original_balance_cents,
    original_balance_usd: formatUsd(account.original_balance_cents),
    low_balance: account.balance_cents < LOW_BALANCE_THRESHOLD_CENTS,
    threshold_usd: formatUsd(LOW_BALANCE_THRESHOLD_CENTS),
  };
}

export function normaliseKey(raw: string): string {
  return raw.replace(/^Bearer\s+/i, "").trim();
}

export async function registerAgent(
  agentId?: string,
  displayName?: string
): Promise<{ account: Account; api_key: string }> {
  const apiKey = `mcp_live_${randomUUID().replace(/-/g, "")}`;
  const rows = await sql`
    INSERT INTO mcp_accounts (api_key, agent_id, display_name)
    VALUES (${apiKey}, ${agentId ?? null}, ${displayName ?? null})
    RETURNING *
  `;
  return { account: rows[0] as Account, api_key: apiKey };
}

export async function getAccountByKey(raw: string): Promise<Account | null> {
  const key = normaliseKey(raw);
  const rows = await sql`SELECT * FROM mcp_accounts WHERE api_key = ${key} LIMIT 1`;
  return rows.length > 0 ? (rows[0] as Account) : null;
}

// Atomically deduct balance. Throws "insufficient_balance" if balance < cost.
export async function deductBalance(
  raw: string,
  amountCents: number,
  tool: string
): Promise<Account> {
  const key = normaliseKey(raw);
  const rows = await sql`
    UPDATE mcp_accounts
    SET balance_cents = balance_cents - ${amountCents}
    WHERE api_key = ${key} AND balance_cents >= ${amountCents}
    RETURNING *
  `;
  if (rows.length === 0) throw new Error("insufficient_balance");
  const account = rows[0] as Account;
  await sql`
    INSERT INTO mcp_transactions (account_id, type, amount_cents, description, tool)
    VALUES (${account.id}, 'debit', ${amountCents}, ${`Tool: ${tool}`}, ${tool})
  `;
  return account;
}

export async function creditBalance(
  accountId: string,
  amountCents: number,
  description: string
): Promise<Account> {
  const rows = await sql`
    UPDATE mcp_accounts
    SET
      balance_cents          = balance_cents + ${amountCents},
      original_balance_cents = CASE
        WHEN original_balance_cents = 0 THEN ${amountCents}
        ELSE original_balance_cents
      END
    WHERE id = ${accountId}
    RETURNING *
  `;
  if (rows.length === 0) throw new Error("account_not_found");
  const account = rows[0] as Account;
  await sql`
    INSERT INTO mcp_transactions (account_id, type, amount_cents, description, tool)
    VALUES (${account.id}, 'credit', ${amountCents}, ${description}, NULL)
  `;
  return account;
}

export async function updateStripeCustomer(raw: string, customerId: string): Promise<void> {
  const key = normaliseKey(raw);
  await sql`UPDATE mcp_accounts SET stripe_customer_id = ${customerId} WHERE api_key = ${key}`;
}

export async function updatePaymentMethod(raw: string, paymentMethodId: string): Promise<void> {
  const key = normaliseKey(raw);
  await sql`UPDATE mcp_accounts SET stripe_payment_method_id = ${paymentMethodId} WHERE api_key = ${key}`;
}

export async function getTransactions(raw: string, limit = 20): Promise<unknown[]> {
  const key = normaliseKey(raw);
  const rows = await sql`
    SELECT t.type, t.amount_cents, t.description, t.tool, t.created_at
    FROM mcp_transactions t
    JOIN mcp_accounts a ON a.id = t.account_id
    WHERE a.api_key = ${key}
    ORDER BY t.created_at DESC
    LIMIT ${Math.min(limit, 50)}
  `;
  return rows as unknown[];
}
