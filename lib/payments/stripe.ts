'use client';

import type { Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;

/** Lazily loads Stripe.js. Returns null when no publishable key is configured (mock mode). */
export function getStripe(): Promise<Stripe | null> | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return null;
  stripePromise ??= import('@stripe/stripe-js').then(({ loadStripe }) => loadStripe(key));
  return stripePromise;
}

/**
 * Runs the card issuer's 3-D Secure challenge for a PaymentIntent in `requires_action`.
 * Resolves on success; throws with the issuer's message on failure or cancel.
 */
export async function handleCardAction(clientSecret: string): Promise<void> {
  const stripe = await getStripe();
  if (!stripe) throw new Error('Card verification is unavailable: Stripe is not configured.');
  const { error } = await stripe.handleNextAction({ clientSecret });
  if (error) throw new Error(error.message ?? 'Your bank could not verify this card.');
}
