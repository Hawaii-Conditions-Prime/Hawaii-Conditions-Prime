import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

export async function createStripeCustomer(opts: {
  displayName?: string;
  agentId?: string;
  apiKey: string;
}): Promise<Stripe.Customer> {
  return stripe.customers.create({
    name: opts.displayName ?? `MCP Agent ${opts.agentId ?? "unknown"}`,
    metadata: {
      api_key: opts.apiKey,
      agent_id: opts.agentId ?? "",
      mcp_server: process.env.MCP_SERVER_NAME ?? "hawaii-conditions",
    },
  });
}

export async function createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
  return stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
    usage: "off_session",
  });
}

export async function attachPaymentMethod(
  customerId: string,
  paymentMethodId: string
): Promise<void> {
  await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });
}

export async function chargeOffSession(opts: {
  customerId: string;
  paymentMethodId: string;
  amountCents: number;
  description: string;
  metadata?: Record<string, string>;
}): Promise<{ status: "charged" | "requires_3ds" | "failed"; paymentIntentId: string }> {
  try {
    const pi = await stripe.paymentIntents.create({
      amount: opts.amountCents,
      currency: "usd",
      customer: opts.customerId,
      payment_method: opts.paymentMethodId,
      description: opts.description,
      confirm: true,
      off_session: true,
      metadata: opts.metadata ?? {},
    });
    if (pi.status === "succeeded") return { status: "charged", paymentIntentId: pi.id };
    if (pi.status === "requires_action") return { status: "requires_3ds", paymentIntentId: pi.id };
    return { status: "failed", paymentIntentId: pi.id };
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "authentication_required") {
      return { status: "requires_3ds", paymentIntentId: "" };
    }
    throw err;
  }
}

export async function createPaymentChallenge(opts: {
  amount: number;
  description: string;
  toolName: string;
  callerId?: string;
}) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: opts.amount,
    currency: "usd",
    description: opts.description,
    metadata: {
      tool: opts.toolName,
      caller_id: opts.callerId ?? "",
    },
    automatic_payment_methods: {
      enabled: true,
    },
  });

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: opts.description,
            metadata: {
              tool: opts.toolName,
            },
          },
          unit_amount: opts.amount,
        },
        quantity: 1,
      },
    ],
    metadata: {
      tool: opts.toolName,
      caller_id: opts.callerId ?? "",
      payment_intent_id: paymentIntent.id,
    },
    success_url: `${process.env.SERVER_URL ?? "https://hawaii-conditions.vercel.app"}/payment/success`,
    cancel_url: `${process.env.SERVER_URL ?? "https://hawaii-conditions.vercel.app"}/payment/cancel`,
  });

  return { paymentIntent, checkoutSession };
}
