import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

// Simple in-memory cache; use Redis in production
const usedPaymentIntents = new Set<string>();

export async function verifyPayment(
  paymentIntentId: string,
  toolName: string
): Promise<boolean> {
  // Prevent replay attacks
  if (usedPaymentIntents.has(paymentIntentId)) {
    return false;
  }

  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

    const isValid =
      pi.status === "succeeded" &&
      pi.metadata?.tool === toolName &&
      // Ensure it's recent (within 1 hour)
      pi.created > Math.floor(Date.now() / 1000) - 3600;

    if (isValid) {
      usedPaymentIntents.add(paymentIntentId); // Mark as consumed
    }

    return isValid;
  } catch {
    return false;
  }
}
