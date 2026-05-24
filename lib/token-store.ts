import { getAccountByKey } from "./ledger";

export async function isValidToken(authHeader: string): Promise<boolean> {
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token.startsWith("mcp_live_")) return false;
  const account = await getAccountByKey(token);
  return account !== null;
}

// Kept for webhook compatibility — token provisioning now goes through
// registerAgent() in lib/ledger.ts and is stored in Neon Postgres.
export async function addToken(_token: string, _credits: number): Promise<void> {
  console.log(`[ledger] addToken called but no-op — use registerAgent() instead`);
}
