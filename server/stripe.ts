import { Request, Response } from "express";
import Stripe from "stripe";
import { storage } from "./storage";

// Initialize Stripe with the secret key from environment variables
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
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
      payment_method_types: ['card'], // Only use card payments for now
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
    let customerEmail = '';
    
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
    
    // Koristimo samo 'card' kao metodu plaćanja jer druge metode nisu aktivirane u Stripe računu
    // VAŽNO: Kada aktivirate druge metode plaćanja u Stripe Dashboard-u
    // (https://dashboard.stripe.com/account/payments/settings),
    // možete odkomentirati donji kod za podršku više metoda plaćanja
    
    const paymentMethodTypes = ['card'];
    
    /* 
    // Ovaj kod se može koristiti kad su sve metode plaćanja aktivirane
    const paymentMethodTypes = ['card']; // Uvijek imamo karticu kao opciju
    
    // Dodajemo specifičnu metodu plaćanja ako je tražena i validna
    if (paymentMethod && paymentMethod !== 'card' && paymentMethod !== 'stripe') {
      try {
        // Podržane metode plaćanja - trebaju biti aktivirane u Stripe Dashboard-u
        const supportedMethods = ['card', 'paypal', 'klarna', 'eps', 'sofort', 'giropay', 'ideal', 'sepa_debit'];
        
        if (supportedMethods.includes(paymentMethod)) {
          paymentMethodTypes.push(paymentMethod);
        }
      } catch (error) {
        console.error("Error adding payment method:", error);
        // U slučaju greške, nastavljamo samo s 'card' opcijom
      }
    }
    */
      
    // Kreiramo sesiju za naplatu
    // Napomena: tipovi i opcije prilagođeni prema Stripe dokumentaciji
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'] as any, // Zasad samo kartice
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Bestellung aus Kerzenwelt by Dani',
              description: orderId ? `Bestellnummer: ${orderId}` : 'Online-Bestellung',
            },
            unit_amount: Math.round(parseFloat(amount) * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      customer_email: customerEmail || undefined,
      locale: 'de',
      billing_address_collection: 'required' as any,
      phone_number_collection: {
        enabled: true
      }
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