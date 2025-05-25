import { Request, Response } from "express";
import Stripe from "stripe";
import { storage } from "./storage"; // Pretpostavljam da je ovo putanja do vašeg storage modula

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
      payment_method_types: ["card"] as any,
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

export async function processStripeSession(
  sessionId: string,
  userId: number,
  language?: string,
) {
  try {
    console.log(
      `Verarbeite Stripe-Sitzung ${sessionId} für Benutzer ${userId}, Sprache: ${language || "nicht angegeben"}`,
    );

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items", "payment_intent", "customer", "customer_details"],
    });

    console.log("Stripe-Sitzung erfolgreich abgerufen:", {
      sessionId,
      customerEmail: session.customer_details?.email,
      amount: session.amount_total,
      paymentStatus: session.payment_status,
    });

    // Check if the session is complete and paid
    if (session.status !== "complete" && session.payment_status !== "paid") {
      console.log(
        `Warnung: Sitzungsstatus ist ${session.status}, Zahlungsstatus ist ${session.payment_status}`,
      );
    }

    // Get cart items
    console.log(`Versuche, Warenkorbeinträge für Benutzer ${userId} abzurufen`);
    let cartItems = [];

    try {
      cartItems = await storage.getCartItems(userId);
      console.log(`${cartItems.length} Artikel im Warenkorb gefunden`);
    } catch (cartError) {
      console.error("Fehler beim Abrufen der Warenkorbeinträge:", cartError);
    }

    // Erstelle trotzdem eine Bestellung, auch wenn der Warenkorb leer ist
    console.log(
      `Erstelle Bestellung aus Stripe-Sitzung, Warenkorbgröße: ${cartItems?.length || 0}`,
    );

    // Calculate total amount
    let totalProductAmount = 0;
    if (cartItems && cartItems.length > 0) {
      for (const item of cartItems) {
        totalProductAmount +=
          parseFloat(String(item.product.price)) * item.quantity;
      }
    } else if (session.amount_total) {
      // Wenn keine Artikel im Warenkorb sind, verwenden wir den Gesamtbetrag aus der Stripe-Sitzung
      totalProductAmount = session.amount_total / 100; // Stripe gibt Beträge in Cent zurück
    }

    // Add shipping cost if necessary
    let shippingCost = 0;
    const freeShippingThresholdSetting = await storage.getSetting(
      "freeShippingThreshold",
    );
    const standardShippingRateSetting = await storage.getSetting(
      "standardShippingRate",
    );

    if (freeShippingThresholdSetting && standardShippingRateSetting) {
      const freeShippingThreshold = parseFloat(
        freeShippingThresholdSetting.value,
      );
      const standardShippingRate = parseFloat(
        standardShippingRateSetting.value,
      );

      if (
        totalProductAmount < freeShippingThreshold &&
        standardShippingRate > 0
      ) {
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
      country: session.customer_details?.address?.country || "",
    };

    // Create a new order with minimal required fields
    const orderData = {
      userId: userId,
      status: "processing", // Order is paid, so it's already in processing
      paymentMethod: "stripe", // Payment with Stripe
      paymentStatus: "paid", // Payment is already complete
      total: orderTotal.toString(),
      subtotal: totalProductAmount.toString(),
      shippingCost: shippingCost.toString(),
      // Add optional fields only if they exist in the schema
      customerNote: session.metadata?.note || "",
    };

    // Add shipping/billing info if available in session
    if (session.customer_details?.address) {
      Object.assign(orderData, {
        shippingAddress: shippingData.address,
        shippingCity: shippingData.city,
        shippingPostalCode: shippingData.postalCode,
        shippingCountry: shippingData.country,
        billingAddress: session.customer_details?.address?.line1 || "",
        billingCity: session.customer_details?.address?.city || "",
        billingPostalCode: session.customer_details?.address?.postal_code || "",
        billingCountry: session.customer_details?.address?.country || "",
      });
    }

    console.log("Creating order with data:", orderData);
    const newOrder = await storage.createOrder(orderData, []);

    // Add order items
    const processedItems = [];

    // Stelle sicher, dass wir Artikel im Warenkorb haben, bevor wir versuchen, sie zu verarbeiten
    if (cartItems && cartItems.length > 0) {
      console.log("Verarbeite Warenkorbeinträge für Bestellung:", newOrder.id);

      for (const item of cartItems) {
        try {
          if (!item.product) {
            console.error("Produkt fehlt in Warenkorbposition:", item);
            continue;
          }

          console.log(
            `Verarbeite Artikelposition: ${item.productId}, Menge: ${item.quantity}`,
          );

          const orderItemData = {
            orderId: newOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            price: String(item.product.price),
            productName: item.product.name,
          };

          // Optionale Felder nur hinzufügen, wenn sie existieren
          if (item.scentId) orderItemData.scentId = item.scentId;
          if (item.colorId) orderItemData.colorId = item.colorId;
          if (item.colorIds) orderItemData.colorIds = item.colorIds;
          if (item.colorName) orderItemData.colorName = item.colorName;
          if (item.hasMultipleColors !== undefined)
            orderItemData.hasMultipleColors = Boolean(item.hasMultipleColors);
          if (item.scent?.name) orderItemData.scentName = item.scent.name;

          const orderItem = await storage.addOrderItem(orderItemData);

          processedItems.push({
            ...orderItem,
            product: item.product,
            scent: item.scent || null,
            color: item.color || null,
          });
        } catch (itemError) {
          console.error(
            "Fehler beim Hinzufügen eines Bestellprodukts:",
            itemError,
          );
        }
      }
    } else {
      console.log(
        "Keine Artikel im Warenkorb gefunden oder Warenkorb bereits geleert.",
      );
    }

    // Clear user's cart
    await storage.clearCart(userId);

    // Return order data
    return {
      success: true,
      orderId: newOrder.id,
      order: newOrder,
      orderItems,
    };
  } catch (error) {
    console.error("Greška pri obradi Stripe sesije:", error);
    throw error;
  }
}

export async function createCheckoutSession(req: Request, res: Response) {
  try {
    // Provjerite da 'orderId' dolazi u req.body
    const { amount, orderId, language, paymentMethod, successUrl, cancelUrl } =
      req.body;

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
    const userIdFromReq = req.user?.id; // Pretpostavljam da req.user postoji iz auth middlewarea
    let customerEmail = "";

    if (userIdFromReq) {
      const user = await storage.getUser(userIdFromReq);
      if (user?.email) {
        customerEmail = user.email;
      }
    }

    // PRIPREMA METADATA OBJEKTA:
    const metadataForStripeSession: Record<string, string> = {}; // Inicijaliziramo prazan objekt

    if (orderId) {
      // AKO IMAMO orderId (trebali bismo ga uvijek imati iz CheckoutForm.tsx)
      metadataForStripeSession.order_id = orderId.toString(); // <--- OVDJE DODAJEMO order_id!
    }
    if (userIdFromReq) {
      // Dodajemo userId ako postoji
      metadataForStripeSession.userId = userIdFromReq.toString();
    }
    if (language) {
      // Dodajemo jezik ako postoji
      metadataForStripeSession.language = language;
    }

    // KRAJ PRIPREME METADATA OBJEKTA. OVDJE SE SVI PODACI SKUPLJAJU.

    // --- OSTATAK KODA ZA LINE ITEMS I DOSTAVU ---

    // Kreiramo listu podržanih metoda plaćanja
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
    if (userIdFromReq) {
      try {
        userCartItems = await storage.getCartItems(userIdFromReq);
        console.log("Dohvaćene stavke košarice:", userCartItems);

        // Ako imamo stavke u košarici, kreiramo line items
        if (userCartItems && userCartItems.length > 0) {
          // Računamo ukupan iznos proizvoda (bez dostave)
          totalProductAmount = userCartItems.reduce(
            (sum: number, item: any) => {
              return (
                sum + parseFloat(String(item.product.price)) * item.quantity
              );
            },
            0,
          );

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
                console.error(
                  `Greška pri dohvaćanju mirisa ${item.scentId}:`,
                  error,
                );
              }
            }

            // Pripremamo URL slike - ISPRAVLJENO RJEŠENJE ZA APSOLUTNU PUTANJU
            let imageUrl = null;
            const currentHost = req.get("host"); // Dohvaća host (npr. your-replit-name.repl.co)
            const currentProtocol = req.protocol; // Dohvaća protokol (http ili https)
            const baseUrl = `${currentProtocol}://${currentHost}`; // Konstruira bazni URL

            if (item.product.imageUrl) {
              console.log(`Original image URL: ${item.product.imageUrl}`);
              console.log(`Base URL: ${baseUrl}`);

              if (
                item.product.imageUrl.startsWith("http://") ||
                item.product.imageUrl.startsWith("https://")
              ) {
                imageUrl = item.product.imageUrl;
                console.log(`Image URL is already absolute: ${imageUrl}`);
              } else {
                // Provjerite da li URL počinje sa '/'
                const relativePath = item.product.imageUrl.startsWith("/")
                  ? item.product.imageUrl
                  : `/${item.product.imageUrl}`;
                // Ovdje je ključna ispravka: koristite BACKTICKOVE za template literal string
                imageUrl = `${baseUrl}${relativePath}`; // <<-- ISPRAVLJENO! Bez span tagova!
                console.log(`Constructed absolute image URL: ${imageUrl}`);
              }
            } else {
              console.log("Product image URL is null or empty.");
            }

            // Kreiramo Stripe line item za ovu stavku
            lineItems.push({
              price_data: {
                currency: "eur",
                product_data: {
                  name: productName,
                  description: item.product.description
                    ? item.product.description.length > 100
                      ? item.product.description.substring(0, 97) + "..."
                      : item.product.description
                    : "",
                  images: imageUrl ? [imageUrl] : undefined,
                },
                unit_amount: Math.round(
                  parseFloat(String(item.product.price)) * 100,
                ), // cijena u centima
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
      totalProductAmount = parseFloat(amount); // Koristi se količina iz req.body.amount ako nema stavki u košarici

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
        "freeShippingThreshold",
      );
      const standardShippingRateSetting = await storage.getSetting(
        "standardShippingRate",
      );

      if (freeShippingThresholdSetting && standardShippingRateSetting) {
        const freeShippingThreshold = parseFloat(
          freeShippingThresholdSetting.value,
        );
        const standardShippingRate = parseFloat(
          standardShippingRateSetting.value,
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

        console.log(
          `Ukupno košarica (server): ${totalAmount}€ (proizvodi: ${totalProductAmount}€ + dostava: ${shippingCost}€)`,
        );
      }
    } catch (error) {
      console.error("Greška pri dohvaćanju postavki za dostavu:", error);
    }

    // KREIRANJE STRIPE SESIJE:
    const session = await stripe.checkout.sessions.create({
      payment_method_types: paymentMethodTypes as any,
      line_items: lineItems,
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      // OVDJE SE ŠALJU SVI SKUPLJENI METADATA PODACI:
      metadata: {
        ...metadataForStripeSession, // <-- OVO ĆE UKLJUČITI 'order_id', 'userId', 'language'
        subtotal: `${totalProductAmount.toFixed(2)} €`,
        shipping:
          shippingCost > 0 ? `${shippingCost.toFixed(2)} €` : "Kostenlos",
        total: `${totalAmount.toFixed(2)} €`,
      },
      customer_email: customerEmail || undefined,
      locale: "de", // Jezik Checkout stranice
      billing_address_collection: "required" as any,
      phone_number_collection: {
        enabled: true,
      },
    } as any);

    // Return the session ID to the client
    res.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error("Error creating checkout session:", error); // Log greške
    res.status(500).json({
      error: "Failed to create checkout session",
      message: error.message,
    });
  }
}
