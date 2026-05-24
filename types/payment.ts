// MPP Tempo payment challenge — format required by the MPP compliance scanner
export interface TempoPaymentChallenge {
  error: "payment_required";
  input_schema?: Record<string, unknown>;
  payment: {
    version: string;
    challenges: TempoChallenge[];
    payment_options: PaymentOption[];
  };
}

export interface TempoChallenge {
  id: string;
  method: string;  // e.g. "prepaid_balance"
  intent: string;  // e.g. "debit"
  expires: string; // ISO 8601
  request: string; // base64url-encoded payload
}

export interface PaymentOption {
  label: string;
  amount_cents: number;
  currency: string;
  checkout_url: string;
  tool?: string; // MCP tool name for autonomous top-up (e.g. "add_funds_5")
}

// Stripe prepaid balance challenge — used by lib/payment-challenge.ts
export interface StripePrepaidChallenge {
  error: "payment_required";
  reason: "missing_or_insufficient_prepaid_balance";
  payment_provider: "stripe";
  payment_method: "card";
  protocol: "stripe-card-prepaid";
  price: string;           // decimal USD string, e.g. "0.10"
  currency: "USD";
  description?: string;
  required_header: "X-MCP-Account";
  setup_instructions: Record<string, string>;
  funding_options: Array<{ amount: string; label: string; tool: string }>;
  input_schema: Record<string, unknown>;
}

// Legacy Stripe challenge — used by lib/payment-response.ts / tools/premium-tool.ts
export interface PaymentChallenge {
  error: "payment_required";
  payment_required: {
    amount: number;
    currency: string;
    description: string;
    payment_methods: PaymentMethod[];
    checkout_url?: string;
    client_secret?: string;
    payment_intent_id?: string;
    expires_at: string;
    metadata?: Record<string, string>;
  };
}

export interface PaymentMethod {
  type: "stripe_card";
  publishable_key: string;
  checkout_session_id?: string;
  checkout_url?: string;
}
