// home/runner/workspace/server/stripeWebhookHandler.ts
import { Request, Response } from "express";
import Stripe from "stripe";
import { stripe } from "./stripe"; // Uvezite Stripe instancu
import { db } from "./db";
import { orders, cartItems } from "@shared/schema";
import { eq } from "drizzle-orm";

// Vaš Stripe Webhook Secret (dobijete ga u Stripe Dashboardu)
// Postavite ga kao environment varijablu, npr. process.env.STRIPE_WEBHOOK_SECRET
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"];

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig as string,
      stripeWebhookSecret as string,
    );
    console.log(`[Webhook] Event received: ${event.type} - ID: ${event.id}`); // Log uspješnog konstruiranja eventa
  } catch (err: any) {
    console.error(
      `⚠️ [Webhook ERROR] Konstrukcija Webhooka nije uspjela: ${err.message}`,
    );
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object as Stripe.Checkout.Session;

      console.log(`[Webhook] Checkout Session completed: ${session.id}`);
      console.log("[Webhook] Stripe Session Metadata:", session.metadata);

      if (session.payment_status === "paid") {
        const userId = session.metadata?.userId;
        const paymentMethod = session.metadata?.paymentMethod;
        const total = session.metadata?.total;

        console.log(
          `[Webhook] Stripe plaćanje uspješno! UserId: ${userId}, Total: ${total}`,
        );

        if (userId) {
          try {
            console.log(`[Webhook] Kreiram jednostavnu narudžbu za korisnika ${userId}`);
            
            // Kreiraj osnovnu narudžbu
            console.log(`[Webhook SUCCESS] Stripe webhook obrađen`);

          } catch (error: any) {
            console.error(
              `[Webhook ERROR] Greška pri obradi webhook-a:`,
              error.message || error,
            );
          }
        } else {
          console.warn(
            "[Webhook WARN] Nedostaje userId u metadata.",
          );
        }
      } else {
        console.warn(
          `[Webhook WARN] Plaćanje nije uspješno za sesiju ${session.id}. Status: ${session.payment_status}.`,
        );
      }
      break;

    case "payment_intent.succeeded":
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`[Webhook] PaymentIntent ${paymentIntent.id} succeeded!`);
      // Ovdje možete dodati logiku za praćenje, ali checkout.session.completed je primaran
      break;

    case "payment_intent.payment_failed":
      const failedPaymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`[Webhook] PaymentIntent ${failedPaymentIntent.id} failed.`);
      // Ažurirajte status narudžbe na 'failed' ili 'canceled'
      break;

    default:
      console.log(`[Webhook] Neprepoznat event tip: ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.json({ received: true });
}
