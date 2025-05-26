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
            console.log(`[Webhook] Kreiram narudžbu za korisnika ${userId}`);
            
            // Get actual payment method from payment intent
            let actualPaymentMethod = "Online Payment"; // Default fallback
            if (session.payment_intent) {
              try {
                const paymentIntentId = typeof session.payment_intent === 'string' 
                  ? session.payment_intent 
                  : session.payment_intent.id;
                
                console.log(`[Webhook] Retrieving payment intent: ${paymentIntentId}`);
                
                const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
                  expand: ['payment_method', 'charges.data.payment_method_details']
                });
                
                // Try multiple ways to get the payment method type
                let paymentMethodType = null;
                
                if (paymentIntent.payment_method) {
                  if (typeof paymentIntent.payment_method === 'object') {
                    paymentMethodType = paymentIntent.payment_method.type;
                  }
                }
                
                if (!paymentMethodType && paymentIntent.charges?.data?.[0]?.payment_method_details) {
                  paymentMethodType = paymentIntent.charges.data[0].payment_method_details.type;
                }
                
                console.log(`[Webhook] Raw payment method type: ${paymentMethodType}`);
                
                // Map Stripe payment method types to user-friendly names
                switch (paymentMethodType) {
                  case 'card':
                    actualPaymentMethod = "Kreditkarte";
                    break;
                  case 'klarna':
                    actualPaymentMethod = "Klarna";
                    break;
                  case 'eps':
                    actualPaymentMethod = "EPS";
                    break;
                  case 'sofort':
                    actualPaymentMethod = "Sofort";
                    break;
                  case 'bancontact':
                    actualPaymentMethod = "Bancontact";
                    break;
                  case 'ideal':
                    actualPaymentMethod = "iDEAL";
                    break;
                  case 'giropay':
                    actualPaymentMethod = "Giropay";
                    break;
                  case 'sepa_debit':
                    actualPaymentMethod = "SEPA Lastschrift";
                    break;
                  default:
                    actualPaymentMethod = paymentMethodType ? paymentMethodType.charAt(0).toUpperCase() + paymentMethodType.slice(1) : "Online Payment";
                }
                
                console.log(`[Webhook] Detected payment method: ${paymentMethodType} -> ${actualPaymentMethod}`);
              } catch (paymentIntentError) {
                console.warn(`[Webhook] Could not retrieve payment method details:`, paymentIntentError);
                actualPaymentMethod = "Online Payment";
              }
            }
            
            // Dohvati podatke iz korisničke košarice
            const { storage } = await import('./storage');
            const cartItems = await storage.getCartItems(parseInt(userId));
            const user = await storage.getUser(parseInt(userId));

            if (!cartItems || cartItems.length === 0) {
              console.error(`[Webhook] Nema stavki u košarici za korisnika ${userId}`);
              return;
            }

            if (!user) {
              console.error(`[Webhook] Korisnik ${userId} nije pronađen`);
              return;
            }

            // Izračunaj ukupan iznos iz košarice
            const cartTotal = cartItems.reduce((sum: number, item: any) => sum + (item.product.price * item.quantity), 0);
            
            console.log(`[Webhook] Kreiram narudžbu iz košarice, cartTotal: ${cartTotal}`);

            // Transformiraj cartItems u order items format
            const orderItemsData = cartItems.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.product.price.toString(),
              productName: item.product.name,
              scentId: item.scentId || null,
              colorId: item.colorId || null,
              colorIds: item.colorIds || null,
              colorName: item.colorName || null,
              hasMultipleColors: item.hasMultipleColors || false,
              scentName: item.scent?.name || null,
            }));

            // Kreiraj narudžbu
            const newOrder = await storage.createOrder({
              userId: parseInt(userId),
              total: cartTotal.toString(),
              subtotal: cartTotal.toString(),
              discountAmount: "0",
              shippingCost: "0",
              paymentMethod: actualPaymentMethod,
              status: "pending",
              paymentStatus: "paid",
              shippingAddress: user.address || "",
              shippingCity: user.city || "",
              shippingPostalCode: user.postalCode || "",
              shippingCountry: user.country || "",
              customerNote: "",
            }, orderItemsData);

            console.log(`[Webhook] Nova narudžba kreirana sa ID: ${newOrder.id}`);

            // Obriši košaricu
            await storage.clearCart(parseInt(userId));
            console.log(`[Webhook SUCCESS] Košarica očišćena za korisnika ${userId}`);

          } catch (error: any) {
            console.error(
              `[Webhook ERROR] Greška pri kreiranju narudžbe:`,
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
      
      // Update the payment method for the order
      try {
        const { storage } = await import('./storage');
        
        // Get payment method details
        let actualPaymentMethod = "Online Payment";
        let paymentMethodType = null;
        
        if (paymentIntent.payment_method) {
          if (typeof paymentIntent.payment_method === 'object') {
            paymentMethodType = paymentIntent.payment_method.type;
          } else if (typeof paymentIntent.payment_method === 'string') {
            // Retrieve the payment method details
            try {
              const pm = await stripe.paymentMethods.retrieve(paymentIntent.payment_method);
              paymentMethodType = pm.type;
            } catch (pmError) {
              console.warn(`[Webhook] Could not retrieve payment method: ${pmError}`);
            }
          }
        }
        
        if (!paymentMethodType && paymentIntent.charges?.data?.[0]?.payment_method_details) {
          paymentMethodType = paymentIntent.charges.data[0].payment_method_details.type;
        }
        
        console.log(`[Webhook] Payment Intent payment method type: ${paymentMethodType}`);
        
        // Map Stripe payment method types to user-friendly names
        switch (paymentMethodType) {
          case 'card':
            actualPaymentMethod = "Kreditkarte";
            break;
          case 'klarna':
            actualPaymentMethod = "Klarna";
            break;
          case 'eps':
            actualPaymentMethod = "EPS";
            break;
          case 'sofort':
            actualPaymentMethod = "Sofort";
            break;
          case 'bancontact':
            actualPaymentMethod = "Bancontact";
            break;
          case 'ideal':
            actualPaymentMethod = "iDEAL";
            break;
          case 'giropay':
            actualPaymentMethod = "Giropay";
            break;
          case 'sepa_debit':
            actualPaymentMethod = "SEPA Lastschrift";
            break;
          default:
            actualPaymentMethod = paymentMethodType ? paymentMethodType.charAt(0).toUpperCase() + paymentMethodType.slice(1) : "Online Payment";
        }
        
        console.log(`[Webhook] Final payment method: ${paymentMethodType} -> ${actualPaymentMethod}`);
        
        // Find and update the most recent pending order for this payment intent
        const allOrders = await storage.getAllOrders();
        const recentOrder = allOrders
          .filter(order => order.paymentStatus === 'paid' && order.status === 'pending')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        
        if (recentOrder) {
          console.log(`[Webhook] Updating payment method for order ${recentOrder.id} to: ${actualPaymentMethod}`);
          await storage.updateOrder(recentOrder.id, {
            paymentMethod: actualPaymentMethod
          });
          console.log(`[Webhook] Order ${recentOrder.id} payment method updated successfully`);
        } else {
          console.warn(`[Webhook] No recent order found to update payment method`);
        }
        
      } catch (updateError) {
        console.error(`[Webhook] Error updating payment method:`, updateError);
      }
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
  if (!res.headersSent) {
    res.json({ received: true });
  }
}
