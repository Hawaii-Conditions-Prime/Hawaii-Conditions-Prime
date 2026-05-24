-- Hawaii Conditions MCP Server — Neon Postgres schema
-- Run once: npm run db:migrate
-- Or manually: psql $DATABASE_URL -f scripts/db-migrate.sql

CREATE TABLE IF NOT EXISTS mcp_accounts (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key                  TEXT        UNIQUE NOT NULL,
  agent_id                 TEXT,
  display_name             TEXT,
  stripe_customer_id       TEXT,
  stripe_payment_method_id TEXT,
  balance_cents            INTEGER     NOT NULL DEFAULT 0,
  original_balance_cents   INTEGER     NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mcp_transactions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID        NOT NULL REFERENCES mcp_accounts(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL CHECK (type IN ('credit', 'debit')),
  amount_cents INTEGER     NOT NULL,
  description  TEXT,
  tool         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_accounts_api_key
  ON mcp_accounts(api_key);

CREATE INDEX IF NOT EXISTS idx_mcp_transactions_account_id
  ON mcp_transactions(account_id, created_at DESC);
