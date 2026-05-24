import type Stripe from "stripe";
import { randomUUID } from "crypto";
import { addToken } from "@/lib/token-store";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[Stripe] Webhook signature verification failed:", err);
    return new Response(`Webhook error: ${String(err)}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const credits = parseInt(process.env.CREDITS_PER_PURCHASE ?? "100", 10);
    const token = randomUUID();

    await addToken(token, credits);

    // TODO: deliver the token to the customer.
    // Options:
    //   • Email via Resend/SendGrid using session.customer_email
    //   • Store in your DB indexed by session.customer_email for a dashboard
    //   • Return from a /api/token?session_id=xxx lookup endpoint
    console.log(
      `[MPP] Issued token for ${session.customer_email}: ${token} (${credits} credits)`
    );
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
