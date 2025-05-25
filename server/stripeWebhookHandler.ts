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
        const orderDataString = session.metadata?.orderData;

        console.log(
          `[Webhook] Stripe plaćanje uspješno! UserId: ${userId}`,
        );

        if (userId && orderDataString) {
          try {
            // Parsiraj podatke o narudžbi iz metadata
            const orderData = JSON.parse(orderDataString);
            console.log(`[Webhook] Podaci o narudžbi:`, orderData);

            // Kreiraj narudžbu tek sada kada je plaćanje potvrđeno
            const newOrder = await db.insert(orders).values({
              userId: parseInt(userId),
              total: orderData.total,
              subtotal: orderData.subtotal,
              discountAmount: orderData.discountAmount,
              shippingCost: orderData.shippingCost,
              paymentMethod: orderData.paymentMethod,
              status: "completed", // Odmah postaviti na completed jer je plaćanje potvrđeno
              paymentStatus: "paid",
              shippingAddress: orderData.shippingAddress,
              shippingCity: orderData.shippingCity,
              shippingPostalCode: orderData.shippingPostalCode,
              shippingCountry: orderData.shippingCountry,
              customerNote: orderData.customerNote,
              createdAt: new Date(),
              updatedAt: new Date(),
            }).returning();

            const orderId = newOrder[0].id;
            console.log(`[Webhook] Nova narudžba kreirana sa ID: ${orderId}`);

            // Dodaj stavke narudžbe
            if (orderData.items && orderData.items.length > 0) {
              const { orderItems } = await import('./dbStorage');
              for (const item of orderData.items) {
                await orderItems.addOrderItem({
                  orderId: orderId,
                  productId: item.productId,
                  quantity: item.quantity,
                  price: item.price,
                  productName: item.productName,
                  scentId: item.scentId,
                  colorId: item.colorId,
                  colorIds: item.colorIds,
                  colorName: item.colorName,
                  hasMultipleColors: item.hasMultipleColors,
                  scentName: item.scentName,
                });
              }
              console.log(`[Webhook] Dodane stavke narudžbe za narudžbu ${orderId}`);
            }

            // Obriši košaricu
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
            }

            console.log(`[Webhook SUCCESS] Narudžba ${orderId} uspješno kreirana i obrađena.`);

          } catch (error: any) {
            console.error(
              `[Webhook ERROR] Greška pri kreiranju narudžbe:`,
              error.message || error,
            );
          }
        } else {
          console.warn(
            "[Webhook WARN] Nedostaju podaci o narudžbi u metadata Stripe sesije.",
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
