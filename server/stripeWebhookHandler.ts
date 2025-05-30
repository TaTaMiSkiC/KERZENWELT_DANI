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

      if (session.payment_status === "paid") {
        const userId = session.metadata?.userId;
        const language = session.metadata?.language || "de"; // Füge language hier hinzu, falls es noch nicht da ist

        // ---- NEUER KOD: Hier werden die reizračunate vrijednosti iz metadate dohvaćene ----
        const metadataCalculatedTotal = parseFloat(
          session.metadata?.calculated_total || "0",
        );
        const metadataCalculatedSubtotal = parseFloat(
          session.metadata?.calculated_subtotal || "0",
        );
        const metadataCalculatedShipping = parseFloat(
          session.metadata?.calculated_shipping || "0",
        );
        const metadataCalculatedDiscount = parseFloat(
          session.metadata?.calculated_discount || "0",
        );

        // Definiraj originalne varijable za korištenje u createOrder
        const cartTotalOriginal = metadataCalculatedSubtotal;
        const shippingCostOriginal = metadataCalculatedShipping;
        // ---- KRAJ NOVOG KODA ----

        if (userId) {
          try {
            // Declare payment method variable once
            let actualPaymentMethod = "Online Payment"; // Default fallback

            // First try to get from payment_method_types in the session
            if (
              session.payment_method_types &&
              session.payment_method_types.length > 0
            ) {
              const primaryPaymentMethod = session.payment_method_types[0]; // Usually the one used

              switch (primaryPaymentMethod) {
                case "card":
                  actualPaymentMethod = "Kreditkarte";
                  break;
                case "klarna":
                  actualPaymentMethod = "Klarna";
                  break;
                case "eps":
                  actualPaymentMethod = "EPS";
                  break;
                case "sofort":
                  actualPaymentMethod = "Sofort";
                  break;
                case "bancontact":
                  actualPaymentMethod = "Bancontact";
                  break;
                case "ideal":
                  actualPaymentMethod = "iDEAL";
                  break;
                case "giropay":
                  actualPaymentMethod = "Giropay";
                  break;
                case "sepa_debit":
                  actualPaymentMethod = "SEPA Lastschrift";
                  break;
                default:
                  actualPaymentMethod =
                    primaryPaymentMethod.charAt(0).toUpperCase() +
                    primaryPaymentMethod.slice(1);
              }
            }

            // Fallback: Try payment intent if session types didn't work
            else if (session.payment_intent) {
              try {
                const paymentIntentId =
                  typeof session.payment_intent === "string"
                    ? session.payment_intent
                    : session.payment_intent.id;

                // Try to get the payment intent with charges expanded
                const paymentIntent = await stripe.paymentIntents.retrieve(
                  paymentIntentId,
                  {
                    expand: [
                      "payment_method",
                      "charges",
                      "charges.data.payment_method_details",
                    ],
                  },
                );

                // Try multiple ways to get the payment method type
                let paymentMethodType = null;

                // Method 1: From payment_method directly
                if (paymentIntent.payment_method) {
                  if (
                    typeof paymentIntent.payment_method === "object" &&
                    paymentIntent.payment_method.type
                  ) {
                    paymentMethodType = paymentIntent.payment_method.type;
                  } else if (typeof paymentIntent.payment_method === "string") {
                    // If it's a string ID, retrieve the payment method
                    try {
                      const pm = await stripe.paymentMethods.retrieve(
                        paymentIntent.payment_method,
                      );
                      paymentMethodType = pm.type;
                    } catch (pmError) {}
                  }
                }

                // Method 2: From charges if payment method not found
                if (
                  !paymentMethodType &&
                  paymentIntent.charges?.data?.length > 0
                ) {
                  const charge = paymentIntent.charges.data[0];
                  if (charge.payment_method_details?.type) {
                    paymentMethodType = charge.payment_method_details.type;
                  }
                }

                // Map Stripe payment method types to user-friendly names
                switch (paymentMethodType) {
                  case "card":
                    actualPaymentMethod = "Kreditkarte";
                    break;
                  case "klarna":
                    actualPaymentMethod = "Klarna";
                    break;
                  case "eps":
                    actualPaymentMethod = "EPS";
                    break;
                  case "sofort":
                    actualPaymentMethod = "Sofort";
                    break;
                  case "bancontact":
                    actualPaymentMethod = "Bancontact";
                    break;
                  case "ideal":
                    actualPaymentMethod = "iDEAL";
                    break;
                  case "giropay":
                    actualPaymentMethod = "Giropay";
                    break;
                  case "sepa_debit":
                    actualPaymentMethod = "SEPA Lastschrift";
                    break;
                  default:
                    actualPaymentMethod = paymentMethodType
                      ? paymentMethodType.charAt(0).toUpperCase() +
                        paymentMethodType.slice(1)
                      : "Online Payment";
                }
              } catch (paymentIntentError) {
                actualPaymentMethod = "Online Payment";
              }
            } else {
            }

            // Dohvati podatke iz korisničke košarice
            const { storage } = await import("./storage");
            const cartItems = await storage.getCartItems(parseInt(userId));
            const user = await storage.getUser(parseInt(userId));

            if (!cartItems || cartItems.length === 0) {
              return;
            }

            if (!user) {
              return;
            }

            // Izračunaj ukupan iznos iz košarice
            const cartTotal = cartItems.reduce(
              (sum: number, item: any) =>
                sum + item.product.price * item.quantity,
              0,
            );

            // Process discount for this user
            let appliedDiscount = 0;
            try {
              const userForDiscount = await storage.getUser(parseInt(userId));
              if (userForDiscount) {
                const discountType =
                  (userForDiscount as any).discountType || "fixed";
                const discountUsageType =
                  (userForDiscount as any).discountUsageType || "permanent";
                const discountAmount = parseFloat(
                  userForDiscount.discountAmount || "0",
                );

                if (discountType === "percentage" && discountAmount > 0) {
                  // For percentage discounts, calculate based on cart total
                  appliedDiscount = (cartTotal * discountAmount) / 100;

                  // Remove one-time percentage discounts after use
                  if (discountUsageType === "one_time") {
                    await storage.updateUser(parseInt(userId), {
                      discountAmount: "0",
                      discountType: "fixed",
                      discountUsageType: "permanent",
                      discountExpiryDate: null,
                    });
                  }
                } else if (discountType === "fixed" && discountAmount > 0) {
                  // For fixed discounts, use discount balance system
                  const currentBalance = parseFloat(
                    userForDiscount.discountBalance ||
                      userForDiscount.discountAmount ||
                      "0",
                  );
                  appliedDiscount = Math.min(currentBalance, cartTotal);
                  const newBalance = currentBalance - appliedDiscount;

                  // For one-time fixed discounts, remove after use regardless of remaining balance
                  if (discountUsageType === "one_time") {
                    await storage.updateUser(parseInt(userId), {
                      discountAmount: "0",
                      discountBalance: "0",
                      discountType: "fixed",
                      discountUsageType: "permanent",
                      discountExpiryDate: null,
                    });
                  } else {
                    // For permanent discounts, update balance and remove if it reaches 0
                    await storage.updateUser(parseInt(userId), {
                      discountBalance: newBalance.toString(),
                      // Remove discount if balance reaches 0
                      ...(newBalance <= 0 && {
                        discountAmount: "0",
                        discountType: "fixed",
                        discountExpiryDate: null,
                      }),
                    });
                  }
                }
              }
            } catch (discountError) {}

            // Try to get the actual payment method used from payment_intent
            let actualPaymentMethodUsed = null; // Ovo neka ostane lokalno

            if (session.payment_intent) {
              try {
                const paymentIntent = await stripe.paymentIntents.retrieve(
                  session.payment_intent as string,
                );

                if (paymentIntent.latest_charge) {
                  const charge = await stripe.charges.retrieve(
                    paymentIntent.latest_charge as string,
                  );
                  actualPaymentMethodUsed = charge.payment_method_details?.type;
                }
              } catch (error) {}
            }

            // Use the actual payment method if found, otherwise fall back to first available
            const primaryPaymentMethod =
              actualPaymentMethodUsed ||
              (session.payment_method_types && session.payment_method_types[0]);

            if (primaryPaymentMethod) {
              switch (primaryPaymentMethod) {
                case "card":
                  actualPaymentMethod = "Kreditkarte"; // <--- PROMIJENJENO OVDJE
                  break;
                case "klarna":
                  actualPaymentMethod = "Klarna"; // <--- PROMIJENJENO OVDJE
                  break;
                case "eps":
                  actualPaymentMethod = "EPS"; // <--- PROMIJENJENO OVDJE
                  break;
                case "sofort":
                  actualPaymentMethod = "Sofort"; // <--- PROMIJENJENO OVDJE
                  break;
                case "bancontact":
                  actualPaymentMethod = "Bancontact"; // <--- PROMIJENJENO OVDJE
                  break;
                case "ideal":
                  actualPaymentMethod = "iDEAL"; // <--- PROMIJENJENO OVDJE
                  break;
                case "giropay":
                  actualPaymentMethod = "Giropay"; // <--- PROMIJENJENO OVDJE
                  break;
                case "sepa_debit":
                  actualPaymentMethod = "SEPA Lastschrift"; // <--- PROMIJENJENO OVDJE
                  break;
                default:
                  actualPaymentMethod = // <--- PROMIJENJENO OVDJE
                    primaryPaymentMethod.charAt(0).toUpperCase() +
                    primaryPaymentMethod.slice(1);
              }
            } else {
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

            // Calculate final total after discount
            const finalTotal = Math.max(0, cartTotal - appliedDiscount);

            // Get discount info for order
            const userForDiscount = await storage.getUser(parseInt(userId));
            const discountType =
              (userForDiscount as any)?.discountType || "fixed";
            const discountPercentage =
              discountType === "percentage"
                ? parseFloat(userForDiscount?.discountAmount || "0")
                : 0;

            // Kreiraj narudžbu s ispravno formatiranim podacima
            const newOrder = await storage.createOrder(
              {
                userId: parseInt(userId),
                total: metadataCalculatedTotal.toFixed(2),
                subtotal: metadataCalculatedSubtotal.toFixed(2),
                discountAmount:
                  metadataCalculatedDiscount > 0
                    ? metadataCalculatedDiscount.toFixed(2)
                    : null,
                discountType:
                  metadataCalculatedDiscount > 0 && user?.discountType
                    ? user.discountType
                    : null,
                discountPercentage:
                  metadataCalculatedDiscount > 0 &&
                  user?.discountType === "percentage"
                    ? parseFloat(user.discountAmount || "0").toFixed(2)
                    : null,
                shippingCost: shippingCostOriginal.toFixed(2),
                paymentMethod: actualPaymentMethod, // Dodano
                status: "processing", // Dodano
                paymentStatus: "paid", // Dodano
                shippingAddress: user.address || "", // Dodano
                shippingCity: user.city || "", // Dodano
                shippingPostalCode: user.postalCode || "", // Dodano
                shippingCountry: user.country || "", // Dodano
                customerNote: "", // Dodano
                // Ovdje trebaš dodati SVA OSTALA polja koja je storage.createOrder očekivao
                // iz originalnog 'orderData' objekta, a koja dolaze iz req.body
                // kao npr. firstName, lastName, email, phone, saveAddress, itd.
                firstName: user.firstName || "",
                lastName: user.lastName || "",
                email: user.email || "",
                phone: user.phone || "",
                saveAddress: user.saveAddress || false, // Prilagodi prema user objektu
              },
              orderItemsData,
            );

            console.log(
              `[🕯️KERZENWELT LOG🕯️] Nova narudžba kreirana sa ID: ${newOrder.id}`,
            );
            try {
              const { generateInvoiceFromOrder } = await import(
                "./invoiceService.js"
              );

              const invoiceId = await generateInvoiceFromOrder(newOrder.id, {
                language: "de",
              });

              if (invoiceId) {
                console.log(
                  `[🕯️KERZENWELT LOG🕯️] Račun kreiran ID: ${invoiceId} za narudžbu ${newOrder.id}`,
                );
              } else {
              }
            } catch (err) {
              console.error(`[🕯️KERZENWELT LOG🕯️] Greška račun:`, err);
            }

            // Obriši košaricu
            await storage.clearCart(parseInt(userId));
            console.log(
              `[🕯️KERZENWELT LOG🕯️] Košarica očišćena za korisnika ${userId}`,
            );
          } catch (error: any) {}
        } else {
        }
      } else {
      }
      break;

    case "payment_intent.succeeded":
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(
        `[🕯️KERZENWELT LOG🕯️] PaymentIntent ${paymentIntent.id} succeeded!`,
      );
      // Orders are created with correct payment method in checkout.session.completed
      break;

    case "charge.succeeded":
      // Orders are created with correct payment method in checkout.session.completed
      break;

    case "payment_intent.payment_failed":
      const failedPaymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(
        `[🕯️KERZENWELT LOG🕯️] PaymentIntent ${failedPaymentIntent.id} failed.`,
      );
      // Ažurirajte status narudžbe na 'failed' ili 'canceled'
      break;

    default:
  }

  // Return a 200 response to acknowledge receipt of the event
  if (!res.headersSent) {
    res.json({ received: true });
  }
}
