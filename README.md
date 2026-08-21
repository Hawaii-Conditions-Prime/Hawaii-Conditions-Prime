# 🌺 Hawaii Conditions MCP Server

  [![Add to Replit](https://replit.com/badge?caption=Add%20to%20Replit)](https://replit.com/integrations?mcp=eyJkaXNwbGF5TmFtZSI6Ikhhd2FpaSBDb25kaXRpb25zIE1DUCBTZXJ2ZXIiLCJiYXNlVXJsIjoiaHR0cHM6Ly9oYXdhaWktY29uZGl0aW9ucy1wcmltZS52ZXJjZWwuYXBwL2FwaS9tY3AifQ==)
  [![Publish to MCP Registry](https://github.com/Hawaii-Conditions-Prime/Hawaii-Conditions-Prime/actions/workflows/publish-mcp.yml/badge.svg)](https://github.com/Hawaii-Conditions-Prime/Hawaii-Conditions-Prime/actions/workflows/publish-mcp.yml)

  Real-time surf conditions, trail status, volcano activity, ocean safety alerts, hyperlocal weather, and restaurant discovery for all Hawaiian islands — built for AI agents.

  Powered by NOAA, USGS Hawaiian Volcano Observatory, NPS, Open-Meteo, and Google Places.

  ---

  ## 🚀 What this is

  A **Model Context Protocol (MCP) server** that gives AI agents structured, real-time data about Hawaii.

  Agents can use it to:
  - Plan trips and build itineraries
  - Check safety conditions (ocean, trails, volcano)
  - Recommend restaurants and food
  - Generate full daily briefings

  ---

  ## 🌐 MCP Endpoint

  ```
  https://hawaii-conditions-prime.vercel.app/api/mcp
  ```

  Listed on the [MCP Registry](https://registry.modelcontextprotocol.io) as
  **`io.github.Hawaii-Conditions-Prime/hawaii-conditions`** (streamable-http transport).

  ---

  ## 💳 Payment

  Paid tools accept **two** rails — agents pick whichever they support:

  1. **x402 (on-chain USDC, no account)** — pay per call with a signed `X-PAYMENT`
     header. Discoverable on agentic marketplaces (e.g. the Coinbase x402 Bazaar).
     See [Selling to agents via x402](#-selling-to-agents-via-x402).
  2. **Stripe prepaid balance** — register an account, save a card, and let the
     agent top itself up autonomously (described below).

  ### Autonomous Prepaid Balance

  Agents maintain a prepaid balance and can top it up entirely on their own — no human interaction required.

  ### One-time setup (agent does this once)

  ```
  1. register_agent           → mcp_… API key
  2. create_wallet_setup      → returns client_secret for saving a Stripe card
  3. save_payment_method      → attach a credit card to the account
  4. add_funds_5/10/20        → card is charged immediately, balance credited
  ```

  ### Every call

  Send the API key in the header on every paid call:
  ```
  X-MCP-Account: mcp_live_xxx
  ```
  (`Authorization: Bearer mcp_live_xxx` is also accepted.)

  ### Autonomous top-up loop

  When balance runs low, the server returns HTTP 402 with `top_up_tools: ["add_funds_5", "add_funds_10", "add_funds_20"]`. The agent calls one of those tools — the saved card is charged off-session instantly and balance is credited in the same response. No human confirmation needed.

  **Top-up response statuses:**

  | Status | Meaning |
  |---|---|
  | `charged` | Card auto-charged, balance ready — keep going |
  | `no_saved_card` | Call `save_payment_method` first |
  | `requires_3ds` | Card requires 3D Secure — use a different card |

  ### Balance headers on paid responses

  ```
  X-MCP-Balance-Cents:   175
  X-MCP-Balance-USD:     $1.75
  X-MCP-Balance-Warning: low     (only when below $2.00)
  ```

  ---

  ## 🧠 Tools

  ### Free tools (no balance required)

  | Tool | Description |
  |---|---|
  | `ping` | Health check, server info, and setup instructions |
  | `get_sun_times` | Sunrise, sunset, daylight duration (HST) |
  | `get_moon_phase` | Current moon phase, illumination, moonrise/moonset times |
  | `register_agent` | Create prepaid account; returns API key |
  | `get_balance` | Current balance + recent transactions |
  | `create_wallet_setup` | Initialise Stripe SetupIntent — returns client_secret for saving a card |
  | `save_payment_method` | Attach a credit card for autonomous top-ups |
  | `link_stripe_customer` | Link an existing Stripe customer ID to your account |
  | `recent_transactions` | Transaction history (debits and credits) |
  | `add_funds_5` | Charge saved card $5 — balance credited instantly |
  | `add_funds_10` | Charge saved card $10 — balance credited instantly |
  | `add_funds_20` | Charge saved card $20 — balance credited instantly |

  ### Paid data tools

  | Tool | Price | Description |
  |---|---|---|
  | `get_weather` | $0.10 | 5-day forecast, UV, wind, sunrise/sunset |
  | `get_surf_conditions` | $0.10 | Wave height, period, direction + forecast |
  | `get_trail_status` | $0.25 | Trail closures, alerts, NPS + DLNR |
  | `get_volcano_status` | $0.25 | Kīlauea eruption status (USGS HVO) |
  | `search_restaurants` | $0.25 | Find restaurants by location, cuisine, price |
  | `get_restaurant_details` | $0.15 | Full details, hours, reviews, photos |
  | `get_ocean_safety` | $0.50 | Jellyfish warnings, rip currents, NOAA alerts |
  | `get_full_briefing` | $2.00 | All data combined — best value |

  ---

  ## 🏝 Supported islands

  ```
  oahu · maui · big-island · kauai · molokai · lanai
  ```

  ---

  ## 🤖 Agent integration example

  ```bash
  # 1. Register (one time)
  curl -X POST https://hawaii-conditions-prime.vercel.app/mcp \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"register_agent","arguments":{"display_name":"My Travel Agent"}}}'

  # 2. Save a card (test mode: pm_card_visa)
  curl -X POST https://hawaii-conditions-prime.vercel.app/mcp \
    -H "Content-Type: application/json" \
    -H "X-MCP-Account: mcp_live_xxx" \
    -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"save_payment_method","arguments":{"payment_method_id":"pm_card_visa"}}}'

  # 3. Top up (card auto-charged, balance credited immediately)
  curl -X POST https://hawaii-conditions-prime.vercel.app/mcp \
    -H "Content-Type: application/json" \
    -H "X-MCP-Account: mcp_live_xxx" \
    -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"add_funds_5","arguments":{}}}'

  # 4. Call a paid tool
  curl -X POST https://hawaii-conditions-prime.vercel.app/mcp \
    -H "Content-Type: application/json" \
    -H "X-MCP-Account: mcp_live_xxx" \
    -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_surf_conditions","arguments":{"island":"oahu"}}}'
  ```

  ---

  ## 🍽 Restaurant intelligence

  - Neighborhood targeting (Waikiki, North Shore, Lahaina, Hilo, etc.)
  - Cuisine filters (poke, sushi, vegan, seafood, etc.)
  - Price filtering ($ → $$$$)
  - Open-now filtering

  Two-step flow: `search_restaurants` → `get_restaurant_details` with the returned `place_id`

  ---

  ## 🔍 Discovery

  | Resource | URL |
  |---|---|
  | x402 catalog | [/api/x402](https://hawaii-conditions-prime.vercel.app/api/x402) |
  | x402 discovery manifest | [/.well-known/x402](https://hawaii-conditions-prime.vercel.app/.well-known/x402) (mirrors the catalog above at the conventional path crawlers/marketplaces check first) |
  | Server card | [/.well-known/mcp/server-card.json](https://hawaii-conditions-prime.vercel.app/.well-known/mcp/server-card.json) |
  | Agent card | [/.well-known/agent-card.json](https://hawaii-conditions-prime.vercel.app/.well-known/agent-card.json) |
  | LLM instructions | [/llms.txt](https://hawaii-conditions-prime.vercel.app/llms.txt) |
  | Health check | [/health](https://hawaii-conditions-prime.vercel.app/health) |

  ---

  ## 🛠 Deploy your own

  1. Connect this repo to Vercel.
  2. Set env vars in **Project Settings → Environment Variables**:

  | Variable | Required | Purpose |
  |---|---|---|
  | `STRIPE_SECRET_KEY` | Yes | Server-side Stripe calls |
  | `STRIPE_PUBLISHABLE_KEY` | Yes | Echoed to agents for client-side Stripe use |
  | `STRIPE_WEBHOOK_SECRET` | Yes | Verifies Stripe webhook signatures |
  | `DATABASE_URL` | Yes | Neon Postgres connection string |
  | `NPS_API_KEY` | Yes | Free at [nps.gov/subjects/developer](https://www.nps.gov/subjects/developer/get-started.htm) |
  | `GOOGLE_MAPS_API_KEY` | Yes | Required for restaurant tools |
  | `SERVER_URL` | Yes | Your Vercel URL, no trailing slash |
  | `X402_PAY_TO` | No | EVM wallet address that receives x402 USDC payments. Setting this enables the on-chain x402 rail. |
  | `X402_NETWORK` | No | `base` (mainnet) or `base-sepolia` (testnet, default) |
  | `CDP_API_KEY_ID` | For `/api/x402/<name>`; mainnet-only on the MCP rail | Coinbase Developer Platform API key ID. The per-tool `/api/x402/<name>` resources always settle through the CDP facilitator (testnet and mainnet alike); the legacy MCP `X-PAYMENT` rail only needs this for mainnet. |
  | `CDP_API_KEY_SECRET` | Same as above | CDP API key secret (PEM EC or base64 Ed25519) |
  | `X402_FACILITATOR_URL` | No | Override the facilitator base URL (defaults: CDP when keys present, else `https://x402.org/facilitator`) |

  3. Push to `main`. Vercel auto-deploys.

  ### 💳 Selling to agents via x402

  Paid tools accept **two** payment rails. Agents can either top up a Stripe
  prepaid balance (`X-MCP-Account`) **or** pay per-call on-chain with USDC using
  the [x402](https://x402.org) protocol (v2 transport) — no account or
  registration required.

  Once `X402_PAY_TO`, `CDP_API_KEY_ID`, and `CDP_API_KEY_SECRET` are set, each
  tool is its own payable x402 v2 resource, built on the official
  [`@x402/core`](https://www.npmjs.com/package/@x402/core) +
  [`@coinbase/cdp-sdk`](https://www.npmjs.com/package/@coinbase/cdp-sdk)
  packages. Every paid endpoint returns a standards-compliant `402` (with the
  requirements also base64-encoded in a `PAYMENT-REQUIRED` header); the agent
  resigns the request with a `PAYMENT-SIGNATURE` header, which the server
  verifies and settles via the Coinbase CDP facilitator and echoes back in
  `PAYMENT-RESPONSE`. Each resource also advertises a Bazaar discovery
  extension, so the API is automatically indexed on x402 marketplaces (e.g.
  the Coinbase x402 Bazaar and directories built on it, like
  [agentic.market](https://agentic.market)) once it has processed its first
  real payment — check compliance any time with
  [agentic.market/validate](https://agentic.market/validate).

  - Discovery / resource catalog: `GET /api/x402`
  - Per-tool payable resource: `GET /api/x402/<name>` (e.g. `/api/x402/get_weather`)
  - MCP endpoint (`POST /api/mcp`) has its own, separate on-chain rail: it
    still accepts the legacy x402 v1 `X-PAYMENT` header on paid `tools/call`.

  **CDP credentials are required for both networks** — the CDP facilitator
  handles settlement on `base-sepolia` (testnet) and `base` (mainnet, real
  USDC) alike, so `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` (from the Coinbase
  Developer Platform) must be set before any `/api/x402/<name>` resource will
  return a real `402` instead of `503 x402_misconfigured`.

  ---

  ## ⚡ Why this exists

  Most travel data is fragmented, outdated, and not usable by AI agents. This server fixes that with structured real-time data, agent-ready APIs, and autonomous payments — on-chain via x402 (USDC) or a self-serve Stripe prepaid balance.

  ---

  ## 🧩 Built for

  - AI travel agents and itinerary builders
  - Concierge and hospitality bots
  - Surf and ocean safety apps
  - Tourism and food recommendation platforms

  ---

  ## 📜 License

  MIT
  