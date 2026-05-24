// x402 payment protocol (v1) — server-side helpers.
//
// Lets AI agents pay for tools on-chain with USDC using the `exact` EVM scheme,
// so this API is discoverable and payable on agentic marketplaces (e.g. the
// Coinbase x402 Bazaar). Runs alongside the existing Stripe prepaid rail.
//
// Flow: client requests a paid resource → server replies 402 with an `accepts`
// list of PaymentRequirements → client signs a payment and resends it in the
// `X-PAYMENT` header → server verifies + settles via a facilitator and serves
// the resource, echoing settlement in the `X-PAYMENT-RESPONSE` header.

export type X402Network = "base" | "base-sepolia";

// USDC token config per network (address + EIP-712 domain used by the `exact` scheme).
const USDC: Record<X402Network, { address: string; name: string; version: string }> = {
  base: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", name: "USD Coin", version: "2" },
  "base-sepolia": { address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", name: "USDC", version: "2" },
};

const USDC_DECIMALS = 6;

import { createCdpAuthHeaders } from "@coinbase/x402";

export const X402_VERSION = 1;
export const X402_NETWORK = ((process.env.X402_NETWORK as X402Network) || "base-sepolia") as X402Network;
export const X402_PAY_TO = process.env.X402_PAY_TO ?? "";
// x402 is advertised/accepted only once a recipient wallet is configured.
export const X402_ENABLED = X402_PAY_TO.length > 0;

// Facilitator selection:
//   1. An explicit X402_FACILITATOR_URL always wins (no auth attached).
//   2. Otherwise, when CDP API keys are present, settle through Coinbase's
//      authenticated CDP facilitator — required for Base mainnet.
//   3. Otherwise fall back to the public testnet facilitator (Base Sepolia).
const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID ?? "";
const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET ?? "";
const CDP_FACILITATOR_URL = "https://api.cdp.coinbase.com/platform/v2/x402";
const FACILITATOR_OVERRIDE = process.env.X402_FACILITATOR_URL?.replace(/\/+$/, "");
const CDP_KEYS_PRESENT = CDP_API_KEY_ID.length > 0 && CDP_API_KEY_SECRET.length > 0;

const USE_CDP = !FACILITATOR_OVERRIDE && CDP_KEYS_PRESENT;
export const X402_FACILITATOR_URL = FACILITATOR_OVERRIDE ?? (USE_CDP ? CDP_FACILITATOR_URL : "https://x402.org/facilitator");

// Generates fresh, request-bound CDP auth headers (Bearer JWT + correlation) per call.
const cdpAuthHeaders = USE_CDP ? createCdpAuthHeaders(CDP_API_KEY_ID, CDP_API_KEY_SECRET) : undefined;
// Base mainnet can only settle through the authenticated CDP facilitator.
const SETTLEMENT_READY = X402_NETWORK === "base" ? USE_CDP : true;

export interface PaymentRequirements {
  scheme: "exact";
  network: X402Network;
  maxAmountRequired: string; // atomic units of `asset`
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  outputSchema?: unknown;
  extra: { name: string; version: string };
}

export interface VerifyResult {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
}

export interface SettleResult {
  success: boolean;
  errorReason?: string;
  transaction?: string;
  network?: string;
  payer?: string;
}

export function usdToAtomic(usd: number): string {
  return BigInt(Math.round(usd * 10 ** USDC_DECIMALS)).toString();
}

export function buildPaymentRequirements(opts: {
  priceUsd: number;
  resource: string;
  description: string;
  mimeType?: string;
  outputSchema?: unknown;
}): PaymentRequirements {
  const usdc = USDC[X402_NETWORK];
  return {
    scheme: "exact",
    network: X402_NETWORK,
    maxAmountRequired: usdToAtomic(opts.priceUsd),
    resource: opts.resource,
    description: opts.description,
    mimeType: opts.mimeType ?? "application/json",
    payTo: X402_PAY_TO,
    maxTimeoutSeconds: 60,
    asset: usdc.address,
    ...(opts.outputSchema ? { outputSchema: opts.outputSchema } : {}),
    extra: { name: usdc.name, version: usdc.version },
  };
}

export function build402Body(accepts: PaymentRequirements[], error = "X-PAYMENT header is required to access this resource.") {
  return { x402Version: X402_VERSION, error, accepts };
}

export function decodePaymentHeader(header: string): unknown | null {
  try {
    return JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export function encodeSettlementHeader(settle: SettleResult): string {
  return Buffer.from(JSON.stringify(settle), "utf8").toString("base64");
}

async function facilitatorPost<T>(endpoint: "verify" | "settle", payload: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cdpAuthHeaders) {
    const authed = await cdpAuthHeaders();
    Object.assign(headers, authed[endpoint]);
  }
  const res = await fetch(`${X402_FACILITATOR_URL}/${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`x402 facilitator /${endpoint} returned ${res.status}: ${detail}`);
  }
  return (await res.json()) as T;
}

export function verifyPayment(paymentPayload: unknown, requirements: PaymentRequirements): Promise<VerifyResult> {
  return facilitatorPost<VerifyResult>("verify", {
    x402Version: X402_VERSION,
    paymentPayload,
    paymentRequirements: requirements,
  });
}

export function settlePayment(paymentPayload: unknown, requirements: PaymentRequirements): Promise<SettleResult> {
  return facilitatorPost<SettleResult>("settle", {
    x402Version: X402_VERSION,
    paymentPayload,
    paymentRequirements: requirements,
  });
}

export type SettleOutcome =
  | { paid: true; settlementHeader: string; payer?: string }
  | { paid: false; status: 402; body: ReturnType<typeof build402Body>; reason: string };

// Verify + settle a single paid request from its `X-PAYMENT` header.
// Returns a `paid: true` outcome (with the X-PAYMENT-RESPONSE header value) on
// success, or a `paid: false` outcome carrying a ready-to-send 402 body.
export async function settleFromHeader(opts: {
  paymentHeader: string | null;
  requirements: PaymentRequirements;
}): Promise<SettleOutcome> {
  const accepts = [opts.requirements];

  if (!opts.paymentHeader) {
    return { paid: false, status: 402, body: build402Body(accepts), reason: "missing_payment_header" };
  }

  const payload = decodePaymentHeader(opts.paymentHeader);
  if (!payload) {
    return { paid: false, status: 402, body: build402Body(accepts, "X-PAYMENT header is malformed (expected base64-encoded JSON)."), reason: "malformed_payment_header" };
  }

  let verification: VerifyResult;
  try {
    verification = await verifyPayment(payload, opts.requirements);
  } catch (err) {
    return { paid: false, status: 402, body: build402Body(accepts, `Payment verification failed: ${(err as Error).message}`), reason: "verify_error" };
  }

  if (!verification.isValid) {
    return { paid: false, status: 402, body: build402Body(accepts, `Payment invalid: ${verification.invalidReason ?? "unknown"}`), reason: "invalid_payment" };
  }

  let settlement: SettleResult;
  try {
    settlement = await settlePayment(payload, opts.requirements);
  } catch (err) {
    return { paid: false, status: 402, body: build402Body(accepts, `Payment settlement failed: ${(err as Error).message}`), reason: "settle_error" };
  }

  if (!settlement.success) {
    return { paid: false, status: 402, body: build402Body(accepts, `Payment settlement rejected: ${settlement.errorReason ?? "unknown"}`), reason: "settlement_rejected" };
  }

  return { paid: true, settlementHeader: encodeSettlementHeader(settlement), payer: settlement.payer ?? verification.payer };
}

export function facilitatorInfo() {
  return {
    enabled: X402_ENABLED,
    version: X402_VERSION,
    scheme: "exact" as const,
    network: X402_NETWORK,
    payTo: X402_PAY_TO || null,
    asset: USDC[X402_NETWORK].address,
    assetName: USDC[X402_NETWORK].name,
    facilitator: X402_FACILITATOR_URL,
    facilitatorMode: USE_CDP ? "cdp" : "public",
    // false on Base mainnet until CDP API keys are configured (settlement would fail).
    settlementReady: SETTLEMENT_READY,
  };
}
