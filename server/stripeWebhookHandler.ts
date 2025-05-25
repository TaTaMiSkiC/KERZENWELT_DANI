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
  } catch (err: any) {
    console.error(`⚠️  Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object as Stripe.Checkout.Session;

      console.log(`[Webhook] Checkout Session completed: ${session.id}`);
      console.log("[Webhook] Stripe Session Metadata:", session.metadata);

      if (session.payment_status === "paid") {
        const orderId = session.metadata?.order_id;
        const userId = session.metadata?.userId;

        console.log(
          `[Webhook] Primljen orderId: ${orderId}, userId: ${userId}`,
        );

        if (orderId) {
          try {
            console.log(`[Webhook] Pokušavam pronaći narudžbu ID: ${orderId}`);
            const orderToUpdate = await db.query.orders.findFirst({
              where: eq(orders.id, parseInt(orderId)),
            });

            if (orderToUpdate) {
              console.log(
                `[Webhook] Pronađena narudžba ID: ${orderToUpdate.id}. Trenutni status: ${orderToUpdate.status}`,
              );

              await db
                .update(orders)
                .set({
                  status: "completed",
                  paymentIntentId: session.payment_intent?.id as string,
                  updatedAt: new Date(),
                })
                .where(eq(orders.id, parseInt(orderId)));

              console.log(
                `[Webhook] Narudžba ${orderId} uspješno ažurirana na 'completed' status.`,
              );

              if (userId) {
                console.log(
                  `[Webhook] Pokušavam obrisati košaricu za korisnika ID: ${userId}`,
                );
                await db
                  .delete(cartItems)
                  .where(eq(cartItems.userId, parseInt(userId)));
                console.log(
                  `[Webhook] Košarica očišćena za korisnika ${userId}.`,
                );
              } else {
                console.warn(
                  "[Webhook] Nedostaje userId u metadata, ne mogu obrisati košaricu.",
                );
              }

              // Ovdje možete poslati potvrdu e-poštom korisniku
              // sendNewOrderNotification(orderToUpdate.id);
            } else {
              console.error(
                `[Webhook ERROR] Narudžba s ID-om ${orderId} NIJE pronađena za ažuriranje.`,
              );
            }
          } catch (updateError: any) {
            console.error(
              `[Webhook ERROR] Greška pri ažuriranju narudžbe ili brisanju košarice:`,
              updateError.message || updateError,
            );
          }
        } else {
          console.warn(
            "[Webhook WARN] Nedostaje 'order_id' u metadata Stripe sesije. Ne mogu ažurirati narudžbu.",
          );
        }
      } else {
        console.warn(
          `[Webhook WARN] Plaćanje nije uspješno za sesiju ${session.id}. Status: ${session.payment_status}`,
        );
      }
      break;

    case "payment_intent.succeeded":
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`PaymentIntent ${paymentIntent.id} succeeded!`);
      // Ovdje možete ažurirati narudžbu ako ste je kreirali s paymentIntentId
      // Imajte na umu da 'checkout.session.completed' je obično dovoljan za narudžbe
      break;

    case "payment_intent.payment_failed":
      const failedPaymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`PaymentIntent ${failedPaymentIntent.id} failed.`);
      // Ovdje možete ažurirati narudžbu na 'failed' ili 'canceled' status
      break;

    // ... handle other event types
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.json({ received: true });
}
