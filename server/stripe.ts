import { Request, Response } from "express";
import Stripe from "stripe";
import { storage } from "./storage";

// Initialize Stripe with the secret key from environment variables
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing required Stripe secret: STRIPE_SECRET_KEY");
}

// Inicijalizacija Stripe sa tajnim ključem
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
export { stripe };

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
 * With product information and images
 */
/**
 * Process a Stripe session and create an order
 * @param sessionId Stripe session ID
 * @param userId User ID
 * @returns Created order and order items
 */
export async function processStripeSession(sessionId: string, userId: number) {
  try {
    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'payment_intent', 'customer']
    });
    
    // Check if the session is complete and paid
    if (session.status !== 'complete' || session.payment_status !== 'paid') {
      throw new Error(`Plaćanje nije uspješno završeno. Status: ${session.status}, Payment status: ${session.payment_status}`);
    }
    
    // Get cart items
    const cartItems = await storage.getCartItems(userId);
    
    if (!cartItems || cartItems.length === 0) {
      throw new Error("Košarica je prazna");
    }
    
    // Calculate total amount
    let totalProductAmount = 0;
    for (const item of cartItems) {
      totalProductAmount += parseFloat(String(item.product.price)) * item.quantity;
    }
    
    // Add shipping cost if necessary
    let shippingCost = 0;
    const freeShippingThresholdSetting = await storage.getSetting("freeShippingThreshold");
    const standardShippingRateSetting = await storage.getSetting("standardShippingRate");
    
    if (freeShippingThresholdSetting && standardShippingRateSetting) {
      const freeShippingThreshold = parseFloat(freeShippingThresholdSetting.value);
      const standardShippingRate = parseFloat(standardShippingRateSetting.value);
      
      if (totalProductAmount < freeShippingThreshold && standardShippingRate > 0) {
        shippingCost = standardShippingRate;
      }
    }
    
    const orderTotal = totalProductAmount + shippingCost;

    // Pripremamo podatke za dostavu iz Stripe sesije - koristimo customer_details umjesto shipping
    // jer Stripe.js tipovi ne prepoznaju shipping polje u sesiji, iako je dostupno u podacima
    const shippingData = {
      address: session.customer_details?.address?.line1 || "",
      city: session.customer_details?.address?.city || "",
      postalCode: session.customer_details?.address?.postal_code || "",
      country: session.customer_details?.address?.country || ""
    };
    
    // Create a new order
    const newOrder = await storage.createOrder({
      userId: userId,
      status: "processing", // Order is paid, so it's already in processing
      paymentMethod: "stripe", // Payment with Stripe
      paymentStatus: "paid", // Payment is already complete
      email: session.customer_details?.email || "",
      phone: session.customer_details?.phone || "",
      shippingAddress: shippingData.address,
      shippingCity: shippingData.city,
      shippingPostalCode: shippingData.postalCode,
      shippingCountry: shippingData.country,
      billingAddress: session.customer_details?.address?.line1 || "",
      billingCity: session.customer_details?.address?.city || "",
      billingPostalCode: session.customer_details?.address?.postal_code || "",
      billingCountry: session.customer_details?.address?.country || "",
      total: orderTotal.toString(),
      subtotal: totalProductAmount.toString(),
      shippingCost: shippingCost.toString(),
      customerNote: session.metadata?.note || "",
      discountAmount: "0",
    });
    
    // Add order items
    const orderItems = [];
    for (const item of cartItems) {
      const orderItem = await storage.addOrderItem({
        orderId: newOrder.id,
        productId: item.productId,
        quantity: item.quantity,
        price: String(item.product.price),
        scentId: item.scentId || null,
        colorId: item.colorId || null,
        colorIds: item.colorIds || null,
        colorName: item.colorName || null,
        hasMultipleColors: Boolean(item.hasMultipleColors),
        productName: item.product.name,
        scentName: item.scent?.name || null,
      });
      
      orderItems.push({
        ...orderItem,
        product: item.product,
        scent: item.scent,
        color: item.color,
      });
    }
    
    // Clear user's cart
    await storage.clearCart(userId);
    
    // Return order data
    return {
      success: true,
      orderId: newOrder.id,
      order: newOrder,
      orderItems
    };
  } catch (error) {
    console.error("Greška pri obradi Stripe sesije:", error);
    throw error;
  }
}

export async function createCheckoutSession(req: Request, res: Response) {
  try {
    const { amount, orderId, userId, language, paymentMethod, successUrl, cancelUrl } = req.body;

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
    
    // Dodajemo ID korisnika u metapodatke
    if (userId) {
      metadata.userId = userId.toString();
    }
    
    // Dodajemo informaciju o jeziku u metapodatke
    if (language) {
      metadata.language = language;
    }

    // Kreiramo listu podržanih metoda plaćanja
    // VAŽNO: Ove metode moraju biti aktivirane u Stripe Dashboard-u
    // (https://dashboard.stripe.com/account/payments/settings)
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

    // Pripremamo line items za Stripe Checkout
    let lineItems: any[] = [];
    
    // Dohvaćamo stavke košarice i računamo ukupan iznos proizvoda
    let totalProductAmount = 0;
    let shippingCost = 0;
    let totalAmount = 0;
    let userCartItems: any[] = [];
    
    // Ako je korisnik prijavljen, dohvaćamo podatke o košarici
    if (userId) {
      try {
        userCartItems = await storage.getCartItems(userId);
        console.log("Dohvaćene stavke košarice:", userCartItems);
        
        // Ako imamo stavke u košarici, kreiramo line items
        if (userCartItems && userCartItems.length > 0) {
          // Računamo ukupan iznos proizvoda (bez dostave)
          totalProductAmount = userCartItems.reduce((sum: number, item: any) => {
            return sum + parseFloat(String(item.product.price)) * item.quantity;
          }, 0);
          
          // Mapiranje svih stavki u košarici
          for (const item of userCartItems) {
            // Oblikujemo naziv proizvoda s informacijama o boji i mirisu
            let productName = item.product.name;
            
            // Dodajemo boju ako postoji
            if (item.colorName) {
              productName += ` - ${item.colorName}`;
            }
            
            // Dohvaćamo naziv mirisa ako postoji ID mirisa
            if (item.scentId) {
              try {
                const scent = await storage.getScent(Number(item.scentId));
                if (scent && scent.name) {
                  productName += ` - Duft: ${scent.name}`;
                }
              } catch (error) {
                console.error(`Greška pri dohvaćanju mirisa ${item.scentId}:`, error);
              }
            }
            
            // Pripremamo URL slike
            const baseUrl = `${req.protocol}://${req.get("host")}`;
            let imageUrl = null;
            
            if (item.product.imageUrl) {
              imageUrl = item.product.imageUrl.startsWith("http") 
                ? item.product.imageUrl 
                : `${baseUrl}${item.product.imageUrl}`;
            }
            
            // Kreiramo Stripe line item za ovu stavku
            lineItems.push({
              price_data: {
                currency: "eur",
                product_data: {
                  name: productName,
                  description: item.product.description 
                    ? (item.product.description.length > 100 
                       ? item.product.description.substring(0, 97) + "..." 
                       : item.product.description)
                    : "",
                  images: imageUrl ? [imageUrl] : undefined,
                },
                unit_amount: Math.round(parseFloat(String(item.product.price)) * 100), // cijena u centima
              },
              quantity: item.quantity,
            });
          }
        }
      } catch (error) {
        console.error("Greška pri dohvaćanju stavki košarice:", error);
      }
    }
    
    // Ako nismo uspjeli dohvatiti stavke iz košarice, koristimo generički line item
    if (lineItems.length === 0) {
      totalProductAmount = parseFloat(amount);
      
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
            unit_amount: Math.round(parseFloat(amount) * 100), // Convert to cents
          },
          quantity: 1,
        },
      ];
    }

    // Dohvaćamo postavke za dostavu i dodajemo troškove dostave ako je potrebno
    try {
      const freeShippingThresholdSetting = await storage.getSetting(
        "freeShippingThreshold"
      );
      const standardShippingRateSetting = await storage.getSetting(
        "standardShippingRate"
      );

      if (freeShippingThresholdSetting && standardShippingRateSetting) {
        const freeShippingThreshold = parseFloat(
          freeShippingThresholdSetting.value
        );
        const standardShippingRate = parseFloat(
          standardShippingRateSetting.value
        );

        // Dodajemo troškove dostave ako je potrebno
        if (
          totalProductAmount < freeShippingThreshold &&
          standardShippingRate > 0
        ) {
          shippingCost = standardShippingRate;
          
          // Dodajemo dostavu kao zasebnu stavku u Stripe Checkout
          lineItems.push({
            price_data: {
              currency: "eur",
              product_data: {
                name: "Versandkosten",
                description: "Standardversand",
              },
              unit_amount: Math.round(standardShippingRate * 100), // cijena u centima
            },
            quantity: 1,
          });
        }
        
        // Ukupan iznos je zbroj proizvoda i dostave
        totalAmount = totalProductAmount + shippingCost;
        
        console.log(`Ukupno košarica (server): ${totalAmount}€ (proizvodi: ${totalProductAmount}€ + dostava: ${shippingCost}€)`);
      }
    } catch (error) {
      console.error("Greška pri dohvaćanju postavki za dostavu:", error);
    }

    // Kreiramo sesiju za naplatu s detaljima za prikaz
    const session = await stripe.checkout.sessions.create({
      payment_method_types: paymentMethodTypes as any,
      line_items: lineItems,
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Dodajemo metapodatke za prikaz detalja na desnoj strani
      metadata: {
        ...metadata,
        subtotal: `${totalProductAmount.toFixed(2)} €`,
        shipping: shippingCost > 0 ? `${shippingCost.toFixed(2)} €` : "Kostenlos",
        total: `${totalAmount.toFixed(2)} €`,
      },
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