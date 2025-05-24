import { Request, Response } from "express";
import Stripe from "stripe";
import { storage } from "./storage";

// Initialize Stripe with the secret key from environment variables
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing required Stripe secret: STRIPE_SECRET_KEY");
}

// Inicijalizacija Stripe sa tajnim ključem
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create a payment intent for a checkout transaction
 */
export async function createPaymentIntent(req: Request, res: Response) {
  try {
    const { amount } = req.body;

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        error: "Invalid amount. Amount must be a positive number.",
      });
    }

    // Get order ID if available
    const { orderId } = req.body;
    const metadata: Record<string, string> = {};
    if (orderId) {
      metadata.order_id = orderId.toString();
    }

    // Create a payment intent with the amount in cents (Stripe requires amounts in the smallest currency unit)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(parseFloat(amount) * 100), // Convert to cents
      currency: "eur",
      metadata,
      payment_method_types: ['card'] as any,
    });

    // Return the client secret to the client
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({
      error: "Failed to create payment intent",
      message: error.message,
    });
  }
}

/**
 * Create a Stripe Checkout Session for a cart
 */
export async function createCheckoutSession(req: Request, res: Response) {
  try {
    const { amount, orderId, paymentMethod, successUrl, cancelUrl } = req.body;

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        error: "Invalid amount. Amount must be a positive number.",
      });
    }

    if (!successUrl || !cancelUrl) {
      return res.status(400).json({
        error: "Missing success or cancel URL",
      });
    }

    // Get user information if logged in
    const userId = req.user?.id;
    let customerEmail = "";

    if (userId) {
      const user = await storage.getUser(userId);
      if (user?.email) {
        customerEmail = user.email;
      }
    }

    // Prepare metadata
    const metadata: Record<string, string> = {};
    if (orderId) {
      metadata.order_id = orderId.toString();
    }

    // Kreiramo listu podržanih metoda plaćanja
    // VAŽNO: Ove metode moraju biti aktivirane u Stripe Dashboard-u
    // (https://dashboard.stripe.com/account/payments/settings)

    // ✅ Validne metode koje Stripe podržava – moraš ih imati aktivirane u dashboardu
    const supportedMethods = ["card", "paypal", "klarna", "eps"];

    // 🎯 Odredi koje metode koristiti u ovom checkoutu
    let paymentMethodTypes: string[] = [];

    if (paymentMethod && supportedMethods.includes(paymentMethod)) {
      // Ako klijent traži određenu metodu, pošalji samo nju + 'card' kao backup
      paymentMethodTypes = ["card"];
      if (paymentMethod !== "card") {
        paymentMethodTypes.push(paymentMethod);
      }
    } else {
      // Ako klijent ništa nije odabrao ili metoda nije podržana, koristi sve metode
      paymentMethodTypes = supportedMethods;
    }

    console.log("⚡ Stripe payment_method_types:", paymentMethodTypes);

    // Dohvaćamo proizvode iz košarice ako je korisnik prijavljen
    let lineItems = [];
    
    if (userId) {
      try {
        // Dohvaćamo stavke košarice za korisnika
        const cartItems = await storage.getCartItems(userId);
        
        // Kreiramo line items za svaki proizvod u košarici
        if (cartItems && cartItems.length > 0) {
          lineItems = cartItems.map(item => {
            // Pripremamo naziv proizvoda (s bojom i mirisom ako postoje)
            let productName = item.product.name;
            
            // Dodaj informacije o boji ako postoji
            if (item.colorName) {
              productName += ` - ${item.colorName}`;
            }
            
            // Dodaj informacije o mirisu ako postoji
            if (item.scentName) {
              productName += ` - ${item.scentName}`;
            }
            
            return {
              price_data: {
                currency: 'eur',
                product_data: {
                  name: productName,
                  description: item.product.description ? item.product.description.substring(0, 100) + '...' : '',
                },
                unit_amount: Math.round(item.product.price * 100), // cijena u centima
              },
              quantity: item.quantity,
            };
          });
        }
      } catch (error) {
        console.error("Greška pri dohvaćanju proizvoda iz košarice:", error);
      }
    }
    
    // Ako nismo uspjeli dohvatiti proizvode iz košarice, koristimo ukupan iznos
    if (!lineItems.length) {
      lineItems = [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Bestellung aus Kerzenwelt by Dani",
              description: orderId
                ? `Bestellnummer: ${orderId}`
                : "Online-Bestellung",
            },
            unit_amount: Math.round(parseFloat(amount) * 100),
          },
          quantity: 1,
        },
      ];
    }
    
    // Kreiramo sesiju za naplatu
    // Napomena: tipovi i opcije prilagođeni prema Stripe dokumentaciji
    const session = await stripe.checkout.sessions.create({
      payment_method_types: paymentMethodTypes as any,
      line_items: lineItems,
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      customer_email: customerEmail || undefined,
      locale: "de",
      billing_address_collection: "required" as any,
      phone_number_collection: {
        enabled: true,
      },
    } as any);

    // Return the session ID to the client
    res.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({
      error: "Failed to create checkout session",
      message: error.message,
    });
  }
}
