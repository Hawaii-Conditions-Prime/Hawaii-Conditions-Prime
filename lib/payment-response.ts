import { createPaymentChallenge } from "./stripe";
import type { PaymentChallenge } from "../types/payment";

export async function build402Response(opts: {
  toolName: string;
  amount: number;
  description: string;
  callerId?: string;
}): Promise<{ status: 402; body: PaymentChallenge }> {
  const { paymentIntent, checkoutSession } = await createPaymentChallenge({
    amount: opts.amount,
    description: opts.description,
    toolName: opts.toolName,
    callerId: opts.callerId,
  });

  const challenge: PaymentChallenge = {
    error: "payment_required",
    payment_required: {
      amount: opts.amount,
      currency: "usd",
      description: opts.description,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
      payment_methods: [
        {
          type: "stripe_card",
          publishable_key: process.env.STRIPE_PUBLISHABLE_KEY!,
          // Provide BOTH — client picks what it supports
          checkout_session_id: checkoutSession.id,
          checkout_url: checkoutSession.url!,
        },
      ],
      // Also expose the PaymentIntent client_secret for embedded flows
      client_secret: paymentIntent.client_secret!,
      payment_intent_id: paymentIntent.id,
      metadata: {
        tool: opts.toolName,
      },
    },
  };

  return { status: 402, body: challenge };
}
