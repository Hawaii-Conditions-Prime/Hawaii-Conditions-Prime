# Hawaii Conditions MCP Server — SKILL.md

  Use this skill when an AI agent needs real-time Hawaiian island data or wants to register, fund, and manage a prepaid billing account on this server.

  ## MCP Endpoint

  ```
  https://hawaii-conditions-prime.vercel.app/mcp
  ```

  Streamable HTTP transport. Stateless — every request is self-contained.

  ---

  ## How payment works (prepaid ledger)

  This server uses a **prepaid credit model**. Agents register once, receive an API key, fund their account via Stripe, and balance is deducted per data call. No per-call payment prompts.

  ### Onboarding flow

  1. Call `register_agent` → receive `api_key` (format: `mcp_live_…`)
  2. Call `create_wallet_setup` → returns `client_secret` for saving a card via Stripe
  3. Call `save_payment_method` with the returned `payment_method_id`
  4. Call `add_funds_5`, `add_funds_10`, or `add_funds_20` to top up
  5. Pass `api_key` on every subsequent request via the `X-MCP-Account` header

  ### Authenticating requests

  ```
  X-MCP-Account: mcp_live_<your_api_key>
  ```

  Also accepted as `Authorization: Bearer mcp_live_…`.

  ### Balance fields (`get_balance` response)

  | Field | Description |
  |---|---|
  | `balance_cents` | Current spendable balance — decreases with each paid tool call |
  | `balance_usd` | Formatted string, e.g. `"$3.80"` |
  | `original_balance_cents` | Amount loaded on the first ever top-up — locked forever |
  | `original_balance_usd` | Formatted string, e.g. `"$5.00"` |
  | `low_balance` | `true` when balance is near zero — agent should top up |
  | `threshold_usd` | The low-balance threshold |

  ---

  ## Tools

  ### Billing & account management (free)

  | Tool | Description |
  |---|---|
  | `register_agent` | Create account — returns `api_key` (store immediately, shown only once) |
  | `get_balance` | Current balance, original load amount, low-balance flag |
  | `create_wallet_setup` | Returns Stripe SetupIntent `client_secret` for collecting card details |
  | `save_payment_method` | Attach a Stripe `pm_…` payment method to the account |
  | `link_stripe_customer` | Link an existing Stripe `cus_…` customer ID |
  | `recent_transactions` | View recent credits and debits (default 20, max 50) |

  ### Top-up (charged to saved card)

  | Tool | Amount |
  |---|---|
  | `add_funds_5` | $5.00 |
  | `add_funds_10` | $10.00 |
  | `add_funds_20` | $20.00 |

  ### Data tools (deducted from balance)

  | Tool | Cost | Description |
  |---|---|---|
  | `ping` | Free | Health check |
  | `get_sun_times` | Free | Sunrise, sunset, daylight duration by island (HST) |
  | `get_weather` | $0.10 | 5-day forecast, UV index, wind, sunrise/sunset |
  | `get_surf_conditions` | $0.10 | Wave height, period, direction + 3-day forecast |
  | `get_trail_status` | $0.25 | NPS alerts and state trail closures |
  | `get_volcano_status` | $0.25 | Live Kīlauea status from USGS HVO |
  | `get_ocean_safety` | $0.50 | Box jellyfish, rip currents, NOAA marine alerts |
  | `get_full_briefing` | $2.00 | All five data sources in one call — best value |
  | `search_restaurants` | $0.25 | Find restaurants by location, cuisine, price, open hours |
  | `get_restaurant_details` | $0.15 | Full hours, reviews, photos by `place_id` |

  ---

  ## Supported islands

  `oahu` · `maui` · `big island` · `kauai` · `molokai` · `lanai`

  ---

  ## Quick-start code example

  ```javascript
  // Step 1 — Register
  const reg = await fetch("https://hawaii-conditions-prime.vercel.app/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", method: "tools/call",
      params: { name: "register_agent", arguments: { agent_id: "my-agent-001", display_name: "My Agent" } },
      id: 1
    })
  });
  const { api_key } = await reg.json(); // store this permanently

  // Step 2 — Call a data tool
  const weather = await fetch("https://hawaii-conditions-prime.vercel.app/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-MCP-Account": api_key },
    body: JSON.stringify({
      jsonrpc: "2.0", method: "tools/call",
      params: { name: "get_weather", arguments: { island: "maui" } },
      id: 2
    })
  });
  ```

  ---

  ## When to use this MCP

  - Planning a Hawaii trip or day itinerary
  - Checking if it's safe to swim, surf, or hike
  - Advising on beach or outdoor activities
  - Checking volcano / lava conditions
  - Building a food or restaurant guide
  - Any question about real-time Hawaii conditions

  ---

  ## Discovery URLs

  | URL | Purpose |
  |---|---|
  | `/mcp` | MCP endpoint |
  | `/skill.md` | This skill in raw markdown |
  | `/skill.html` | This skill as a styled page |
  | `/llms.txt` | LLM system prompt instructions |
  | `/agents.txt` | Agent directives |
  | `/.well-known/mcp/server-card.json` | MCP server card |
  | `/.well-known/agent-card.json` | Agent card |
  | `/health` | Health check |
  