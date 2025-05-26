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
  console.log(`[Webhook] Processing event type: "${event.type}"`);
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
            console.log(`[Webhook] Session payment_intent:`, session.payment_intent ? 'EXISTS' : 'NULL');
            console.log(`[Webhook] Session payment_method_types:`, session.payment_method_types);
            
            // Declare payment method variable once
            let actualPaymentMethod = "Online Payment"; // Default fallback
            
            // First try to get from payment_method_types in the session
            if (session.payment_method_types && session.payment_method_types.length > 0) {
              const primaryPaymentMethod = session.payment_method_types[0]; // Usually the one used
              console.log(`[Webhook] Primary payment method type: ${primaryPaymentMethod}`);
              
              switch (primaryPaymentMethod) {
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
                  actualPaymentMethod = primaryPaymentMethod.charAt(0).toUpperCase() + primaryPaymentMethod.slice(1);
              }
              
              console.log(`[Webhook] Payment method from session types: ${primaryPaymentMethod} -> ${actualPaymentMethod}`);
            }
            
            // Fallback: Try payment intent if session types didn't work
            else if (session.payment_intent) {
              try {
                const paymentIntentId = typeof session.payment_intent === 'string' 
                  ? session.payment_intent 
                  : session.payment_intent.id;
                
                console.log(`[Webhook] Retrieving payment intent: ${paymentIntentId}`);
                
                // Try to get the payment intent with charges expanded
                const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
                  expand: ['payment_method', 'charges', 'charges.data.payment_method_details']
                });
                
                console.log(`[Webhook] PaymentIntent retrieved successfully`);
                
                // Try multiple ways to get the payment method type
                let paymentMethodType = null;
                
                // Method 1: From payment_method directly
                if (paymentIntent.payment_method) {
                  if (typeof paymentIntent.payment_method === 'object' && paymentIntent.payment_method.type) {
                    paymentMethodType = paymentIntent.payment_method.type;
                    console.log(`[Webhook] Payment method from payment_method object: ${paymentMethodType}`);
                  } else if (typeof paymentIntent.payment_method === 'string') {
                    // If it's a string ID, retrieve the payment method
                    try {
                      const pm = await stripe.paymentMethods.retrieve(paymentIntent.payment_method);
                      paymentMethodType = pm.type;
                      console.log(`[Webhook] Payment method from retrieved PM: ${paymentMethodType}`);
                    } catch (pmError) {
                      console.warn(`[Webhook] Could not retrieve payment method details: ${pmError}`);
                    }
                  }
                }
                
                // Method 2: From charges if payment method not found
                if (!paymentMethodType && paymentIntent.charges?.data?.length > 0) {
                  const charge = paymentIntent.charges.data[0];
                  if (charge.payment_method_details?.type) {
                    paymentMethodType = charge.payment_method_details.type;
                    console.log(`[Webhook] Payment method from charge details: ${paymentMethodType}`);
                  }
                }
                
                console.log(`[Webhook] Final detected payment method type: ${paymentMethodType}`);
                
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
              } catch (paymentIntentError) {
                console.error(`[Webhook] Error retrieving payment method details:`, paymentIntentError);
                actualPaymentMethod = "Online Payment";
              }
            } else {
              console.warn(`[Webhook] No payment_intent found in session`);
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
            
            // Reset payment method detection for this path
            let actualPaymentMethodForCart = "Online Payment"; // Reset to default for cart path
            console.log(`[Webhook] Session payment_method_types:`, session.payment_method_types);
            
            // Try to get the actual payment method used from payment_intent
            let actualPaymentMethodUsed = null;
            
            if (session.payment_intent) {
              try {
                const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string);
                console.log(`[Webhook] Payment intent retrieved, status: ${paymentIntent.status}`);
                
                if (paymentIntent.latest_charge) {
                  const charge = await stripe.charges.retrieve(paymentIntent.latest_charge as string);
                  actualPaymentMethodUsed = charge.payment_method_details?.type;
                  console.log(`[Webhook] Actual payment method used: ${actualPaymentMethodUsed}`);
                }
              } catch (error) {
                console.log(`[Webhook] Error retrieving payment intent: ${error}`);
              }
            }
            
            // Use the actual payment method if found, otherwise fall back to first available
            const primaryPaymentMethod = actualPaymentMethodUsed || (session.payment_method_types && session.payment_method_types[0]);
            console.log(`[Webhook] Using payment method: ${primaryPaymentMethod}`);
            
            if (primaryPaymentMethod) {
              switch (primaryPaymentMethod) {
                case 'card':
                  actualPaymentMethodForCart = "Kreditkarte";
                  break;
                case 'klarna':
                  actualPaymentMethodForCart = "Klarna";
                  break;
                case 'eps':
                  actualPaymentMethodForCart = "EPS";
                  break;
                case 'sofort':
                  actualPaymentMethodForCart = "Sofort";
                  break;
                case 'bancontact':
                  actualPaymentMethodForCart = "Bancontact";
                  break;
                case 'ideal':
                  actualPaymentMethodForCart = "iDEAL";
                  break;
                case 'giropay':
                  actualPaymentMethodForCart = "Giropay";
                  break;
                case 'sepa_debit':
                  actualPaymentMethodForCart = "SEPA Lastschrift";
                  break;
                default:
                  actualPaymentMethodForCart = primaryPaymentMethod.charAt(0).toUpperCase() + primaryPaymentMethod.slice(1);
              }
              
              console.log(`[Webhook] Payment method from actual usage: ${primaryPaymentMethod} -> ${actualPaymentMethodForCart}`);
            } else {
              console.log(`[Webhook] No payment method found, using default`);
            }

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
              paymentMethod: actualPaymentMethodForCart || "Online Payment",
              status: "pending",
              paymentStatus: "paid",
              shippingAddress: user.address || "",
              shippingCity: user.city || "",
              shippingPostalCode: user.postalCode || "",
              shippingCountry: user.country || "",
              customerNote: "",
            }, orderItemsData);

            console.log(`[Webhook] Nova narudžba kreirana sa ID: ${newOrder.id}`);

            // AUTOMATSKI KREIRAJ RAČUN za novu narudžbu - isti pristup kao u /api/orders
            try {
              console.log(`[Webhook] Kreiram automatski račun za narudžbu ${newOrder.id}`);
              
              // Koristi istu funkciju kao u /api/orders endpoint-u
              const { generateInvoiceFromOrder } = await import('./invoiceService.js');
              
              // Generiraj račun s njemačkim jezikom (kao u Selbstabholung)
              const invoiceId = await generateInvoiceFromOrder(newOrder.id, {
                language: "de"
              });

              if (invoiceId) {
                console.log(`[Webhook SUCCESS] Račun automatski kreiran sa ID: ${invoiceId} za narudžbu ${newOrder.id}`);
              } else {
                console.error(`[Webhook ERROR] Neuspjelo generiranje računa za narudžbu ${newOrder.id}`);
              }
            } catch (invoiceError) {
              console.error(`[Webhook ERROR] Greška pri automatskom kreiranju računa:`, invoiceError);
            }

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
      // Orders are created with correct payment method in checkout.session.completed
      break;

    case "charge.succeeded":
      console.log(`[Webhook] Event received: charge.succeeded - ID: ${event.id}`);
      // Orders are created with correct payment method in checkout.session.completed
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
