// x402 protocol v2 resource server — built on the official `@x402/core` +
// `@coinbase/cdp-sdk` packages, so the payable tool endpoints under
// `/api/x402/<tool>` speak the wire format (PAYMENT-REQUIRED header, CAIP-2
// networks, Bazaar discovery extension) that Coinbase's x402 Bazaar and
// marketplaces built on it (e.g. agentic.market) validate and index.
//
// This is deliberately separate from `lib/x402.ts`, which stays on the
// legacy v1 shape for the MCP tool-call payment rail (`X-PAYMENT` header,
// mixed in with the Stripe-prepaid challenge body) — that rail isn't crawled
// by the Bazaar and migrating it is out of scope here.

import { createX402Server, type CdpRouteConfig, type X402Server } from "@coinbase/cdp-sdk/x402";
import type { HTTPAdapter } from "@x402/core/server";
import type { NextRequest } from "next/server";

import { TOOL_PRICES } from "./payment-challenge";
import { bazaarExtensionFor } from "./x402-discovery";
import { TOOL_DESCRIPTIONS } from "./x402-catalog";
import { X402_ENABLED, X402_NETWORK, X402_PAY_TO } from "./x402";

export { X402_ENABLED };

let serverPromise: Promise<X402Server> | null = null;

// Lazily builds and initializes the resource server once per runtime
// instance (initialize() does a facilitator round-trip), then reuses it.
export function getX402Server(): Promise<X402Server> {
  if (!X402_ENABLED) {
    throw new Error("x402_not_configured: Set X402_PAY_TO to enable on-chain payments.");
  }

  if (!serverPromise) {
    const routes: Record<string, CdpRouteConfig> = {};
    for (const [tool, priceUsd] of Object.entries(TOOL_PRICES)) {
      routes[`GET /api/x402/${tool}`] = {
        price: `$${priceUsd.toFixed(2)}`,
        description: TOOL_DESCRIPTIONS[tool] ?? `Hawaii Conditions tool: ${tool}.`,
        // Overrides the SDK's minimal auto-generated bazaar declaration with
        // per-tool input/output examples.
        extensions: bazaarExtensionFor(tool, priceUsd),
      };
    }

    serverPromise = createX402Server({
      routes,
      environment: X402_NETWORK === "base" ? "production" : "development",
      payToConfig: { type: "address", evm: X402_PAY_TO as `0x${string}` },
    }).catch((err) => {
      serverPromise = null;
      throw err;
    });
  }

  return serverPromise;
}

// Bridges a Next.js Route Handler request into the framework-agnostic
// HTTPAdapter interface @x402/core expects.
export function nextRequestAdapter(req: NextRequest): HTTPAdapter {
  return {
    getHeader: (name) => req.headers.get(name) ?? undefined,
    getMethod: () => req.method,
    getPath: () => req.nextUrl.pathname,
    getUrl: () => req.url,
    getAcceptHeader: () => req.headers.get("accept") ?? "",
    getUserAgent: () => req.headers.get("user-agent") ?? "",
    getQueryParams: () => Object.fromEntries(req.nextUrl.searchParams),
    getQueryParam: (name) => req.nextUrl.searchParams.get(name) ?? undefined,
  };
}
