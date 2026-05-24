import { stripe } from "@/lib/stripe";
import { creditBalance } from "@/lib/ledger";
import sql from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as any;

    const customerId = intent.customer;
    const amount = intent.amount;

    const result = await sql`
      SELECT api_key FROM mcp_accounts
      WHERE stripe_customer_id = ${customerId}
      LIMIT 1
    `;

    if (result.length > 0) {
      const apiKey = result[0].api_key;

      await creditBalance(apiKey, amount, "stripe_topup");
    }
  }

  return new Response("ok");
}
