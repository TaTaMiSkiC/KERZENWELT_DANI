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
        const orderId = session.metadata?.order_id;
        const userId = session.metadata?.userId;

        console.log(
          `[Webhook] Primljen orderId iz metadate: ${orderId}, userId: ${userId}`,
        );

        if (orderId) {
          try {
            console.log(
              `[Webhook] Pokušavam pronaći narudžbu ID: ${orderId} za ažuriranje.`,
            );
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
                  status: "completed", // Ažurira status
                  paymentIntentId: session.payment_intent?.id as string, // Sprema Payment Intent ID
                  updatedAt: new Date(), // Ažurira datum
                })
                .where(eq(orders.id, parseInt(orderId)));

              console.log(
                `[Webhook SUCCESS] Narudžba ${orderId} uspješno ažurirana na 'completed' status.`,
              );

              if (userId) {
                console.log(
                  `[Webhook] Pokušavam obrisati košaricu za korisnika ID: ${userId}.`,
                );
                await db
                  .delete(cartItems)
                  .where(eq(cartItems.userId, parseInt(userId)));
                console.log(
                  `[Webhook SUCCESS] Košarica očišćena za korisnika ${userId}.`,
                );
              } else {
                console.warn(
                  "[Webhook WARN] Nedostaje userId u metadata, ne mogu obrisati košaricu.",
                );
              }

              // Ovdje možete poslati potvrdu e-poštom korisniku
              // if (sendNewOrderNotification) {
              //   await sendNewOrderNotification(orderToUpdate.id);
              // }
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
