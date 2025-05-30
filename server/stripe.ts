import { Request, Response } from "express";
import Stripe from "stripe";
import { storage } from "./storage"; // Überprüfe, ob dieser Pfad zu deinem 'storage' Modul korrekt ist
import {
  sendNewOrderNotification,
  sendInvoiceGeneratedNotification,
} from "./notificationService"; // Importiere Benachrichtigungsfunktionen
import { generateInvoiceFromOrder } from "./invoiceService"; // Importiere Rechnungsgenerierungsfunktion

// Stripe mit dem geheimen Schlüssel aus den Umgebungsvariablen initialisieren
// if (!process.env.STRIPE_SECRET_KEY_TEST) {
//   throw new Error("Missing required Stripe secret: STRIPE_SECRET_KEY_TEST");
// }

// // Initialisierung der Stripe-Instanz
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY_TEST);
// export { stripe };

// Stripe mit dem geheimen Schlüssel aus den Umgebungsvariablen initialisieren
if (!process.env.STRIPE_SECRET_KEY_TEST) {
  throw new Error("Missing required Stripe secret: STRIPE_SECRET_KEY");
}

// Initialisierung der Stripe-Instanz
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
export { stripe };

/**
 * Erstellt einen Payment Intent für eine Checkout-Transaktion. Wird für die Zahlung direkt auf der Seite (PaymentElement) verwendet.
 * Der Betrag wird hier sicher auf dem Server neu berechnet.
 */
export async function createPaymentIntent(req: Request, res: Response) {
  try {
    // Der Client sendet 'amount' und 'userId'. 'amount' wird zur Anzeige verwendet, aber der tatsächliche Betrag
    // für die Zahlung wird sicher auf dem Server basierend auf dem Warenkorb neu berechnet.
    const { amount: clientAmount, userId, orderId } = req.body;

    let finalCalculatedAmount = 0; // Endgültiger Betrag für Stripe
    let cartTotal = 0; // Zwischensumme der Produkte
    let shippingCost = 0; // Versandkosten
    let appliedDiscount = 0; // Angewendeter Rabatt
    let userDetails: any = null; // Benutzerdetails

    if (!userId) {
      return res
        .status(400)
        .json({ error: "User ID is required to create payment intent." });
    }

    // Betrag auf dem Server zur Sicherheit neu berechnen
    try {
      const cartItems = await storage.getCartItems(userId);
      userDetails = await storage.getUser(userId);

      if (!cartItems || cartItems.length === 0) {
        return res.status(400).json({ error: "Your cart is empty." });
      }

      cartTotal = cartItems.reduce(
        (sum: number, item: any) =>
          sum + parseFloat(String(item.product.price)) * item.quantity,
        0,
      );

      // Rabatt neu berechnen
      if (
        userDetails &&
        userDetails.discountAmount &&
        parseFloat(userDetails.discountAmount) > 0
      ) {
        const userDiscountAmount = parseFloat(userDetails.discountAmount);
        const minimumOrder = parseFloat(
          userDetails.discountMinimumOrder || "0",
        );
        if (cartTotal >= minimumOrder) {
          const discountType = (userDetails as any).discountType || "fixed";
          if (discountType === "percentage") {
            appliedDiscount = (cartTotal * userDiscountAmount) / 100;
          } else {
            appliedDiscount = userDiscountAmount;
          }
        }
      }

      // Versandkosten neu berechnen
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
        if (cartTotal < freeShippingThreshold && standardShippingRate > 0) {
          shippingCost = standardShippingRate;
        }
      }

      finalCalculatedAmount = Math.max(
        0,
        cartTotal + shippingCost - appliedDiscount,
      );

      console.log(
        `[Backend] Payment Intent Created for user ${userId}: ${finalCalculatedAmount}€ (Products: ${cartTotal}€, Shipping: ${shippingCost}€, Discount: ${appliedDiscount}€)`,
      );
    } catch (error) {
      console.error("Error recalculating cart for payment intent:", error);
      return res
        .status(500)
        .json({ error: "Failed to securely calculate order total." });
    }

    const metadata: Record<string, string> = {
      user_id: userId.toString(),
      // Neu berechnete Werte in Metadaten speichern
      calculated_total: finalCalculatedAmount.toFixed(2),
      calculated_subtotal: cartTotal.toFixed(2),
      calculated_shipping: shippingCost.toFixed(2),
      calculated_discount: appliedDiscount.toFixed(2),
    };
    if (orderId) {
      metadata.order_id = orderId.toString();
    }

    // Payment Intent erstellen
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(finalCalculatedAmount * 100), // Betrag in Cents
      currency: "eur",
      metadata,
      payment_method_types: ["card"] as any, // Wird für PaymentElement verwendet
    });

    // Client Secret an den Client zurückgeben
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
 * Verarbeitet eine Stripe-Sitzung. Die Berechnung erfolgt serverseitig.
 */
export async function processStripeSession(
  sessionId: string,
  userId: number,
  language?: string,
) {
  try {
    console.log(
      `Verarbeite Stripe-Sitzung ${sessionId} für Benutzer ${userId}, Sprache: ${language || "nicht angegeben"}`,
    );

    // Sitzung von Stripe abrufen
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items", "payment_intent", "customer", "customer_details"],
    });

    console.log("Stripe-Sitzung erfolgreich abgerufen:", {
      sessionId,
      customerEmail: session.customer_details?.email,
      amount: session.amount_total,
      paymentStatus: session.payment_status,
    });

    // Prüfen, ob die Sitzung abgeschlossen und bezahlt ist
    if (session.status !== "complete" && session.payment_status !== "paid") {
      console.log(
        `Warnung: Sitzungsstatus ist ${session.status}, Zahlungsstatus ist ${session.payment_status}`,
      );
    }

    // Warenkorb-Artikel abrufen
    console.log(`Versuche, Warenkorbeinträge für Benutzer ${userId} abzurufen`);
    let cartItems = [];

    try {
      cartItems = await storage.getCartItems(userId);
      console.log(`${cartItems.length} Artikel im Warenkorb gefunden`);
    } catch (cartError) {
      console.error("Fehler beim Abrufen der Warenkorbeinträge:", cartError);
    }

    // Bestellung erstellen, auch wenn der Warenkorb leer ist
    console.log(
      `Erstelle Bestellung aus Stripe-Sitzung, Warenkorbgröße: ${cartItems?.length || 0}`,
    );

    // Gesamten Produktbetrag berechnen
    let totalProductAmount = 0;
    if (cartItems && cartItems.length > 0) {
      for (const item of cartItems) {
        totalProductAmount +=
          parseFloat(String(item.product.price)) * item.quantity;
      }
    } else if (session.amount_total) {
      // Wenn keine Artikel im Warenkorb sind, den Gesamtbetrag aus der Stripe-Sitzung verwenden
      totalProductAmount = session.amount_total / 100; // Stripe gibt Beträge in Cent zurück
    }

    // Versandkosten hinzufügen, falls erforderlich
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

    // Rabatt berechnen, falls der Benutzer einen hat
    let discountAmount = 0;
    let discountType = null;
    let discountPercentage = null;

    if (userId) {
      const user = await storage.getUser(userId);
      if (user && user.discountAmount && parseFloat(user.discountAmount) > 0) {
        const userDiscountAmount = parseFloat(user.discountAmount);
        const minimumOrder = parseFloat(user.discountMinimumOrder || "0");

        if (totalProductAmount >= minimumOrder) {
          discountType = (user as any).discountType || "fixed";

          if (discountType === "percentage") {
            discountPercentage = userDiscountAmount;
            discountAmount = (totalProductAmount * userDiscountAmount) / 100;
          } else {
            discountAmount = userDiscountAmount;
          }
        }
      }
    }

    const orderTotal = totalProductAmount + shippingCost - discountAmount;

    // Versanddaten aus der Stripe-Sitzung vorbereiten - customer_details verwenden
    const shippingData = {
      address: session.customer_details?.address?.line1 || "",
      city: session.customer_details?.address?.city || "",
      postalCode: session.customer_details?.address?.postal_code || "",
      country: session.customer_details?.address?.country || "",
    };

    // Neue Bestellung mit minimal erforderlichen Feldern erstellen
    const orderData = {
      userId: userId,
      status: "processing", // Bestellung ist bezahlt, daher bereits in Bearbeitung
      paymentMethod: "stripe", // Zahlung mit Stripe
      paymentStatus: "paid", // Zahlung ist bereits abgeschlossen
      total: orderTotal.toString(),
      subtotal: totalProductAmount.toString(),
      shippingCost: shippingCost.toString(),
      discountAmount: discountAmount > 0 ? discountAmount.toString() : null,
      discountType: discountType,
      discountPercentage: discountPercentage
        ? discountPercentage.toString()
        : null,
      // Optionale Felder nur hinzufügen, wenn sie im Schema existieren
      customerNote: session.metadata?.note || "",
    };

    // Versand-/Rechnungsdaten hinzufügen, falls in der Sitzung verfügbar
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

    // Bestellpositionen hinzufügen
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
          if (item.scentId) (orderItemData as any).scentId = item.scentId;
          if (item.colorId) (orderItemData as any).colorId = item.colorId;
          if (item.colorIds) (orderItemData as any).colorIds = item.colorIds;
          if (item.colorName) (orderItemData as any).colorName = item.colorName;
          if (item.hasMultipleColors !== undefined)
            (orderItemData as any).hasMultipleColors = Boolean(
              item.hasMultipleColors,
            );
          if (item.scent?.name)
            (orderItemData as any).scentName = item.scent.name;

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

    // Warenkorb des Benutzers leeren
    await storage.clearCart(userId);

    // Bestelldaten zurückgeben
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
    // Überprüfen, ob 'orderData' im req.body enthalten ist
    const {
      orderData,
      userId,
      language,
      paymentMethod,
      successUrl,
      cancelUrl,
    } = req.body;

    // Variablen am Anfang der Funktion mit Startwerten definieren
    let cartItems = [];
    let totalProductAmount = 0;
    let shippingCost = 0;
    let appliedDiscount = 0;
    let finalCalculatedTotal = 0;
    let userDetails: any = null;
    let freeShippingThreshold = 0;
    let standardShippingRate = 0;

    if (!userId) {
      return res
        .status(400)
        .json({ error: "User ID is required for checkout session creation." });
    }

    // Betrag auf dem Server zur Sicherheit neu berechnen
    try {
      cartItems = await storage.getCartItems(userId);
      userDetails = await storage.getUser(userId);

      if (!cartItems || cartItems.length === 0) {
        return res.status(400).json({ error: "Your cart is empty." });
      }

      totalProductAmount = cartItems.reduce(
        (sum: number, item: any) =>
          sum + parseFloat(String(item.product.price)) * item.quantity,
        0,
      );

      // Rabatt serverseitig neu berechnen
      appliedDiscount = 0; // Sicherstellen, dass es 0 ist, falls die Bedingungen nicht erfüllt sind

      console.log(
        `[DEBUG_RABATT] Start Rabattberechnung: userId=${userId}, totalProductAmount=${totalProductAmount}€`,
      );
      console.log(`[DEBUG_RABATT] userDetails:`, userDetails);

      if (
        userDetails &&
        userDetails.discountAmount &&
        parseFloat(userDetails.discountAmount) > 0
      ) {
        const userDiscountAmount = parseFloat(userDetails.discountAmount);
        const minimumOrder = parseFloat(
          userDetails.discountMinimumOrder || "0",
        );

        console.log(
          `[DEBUG_RABATT] User hat Rabatt: userDiscountAmount=${userDiscountAmount}, minimumOrder=${minimumOrder}`,
        );
        console.log(
          `[DEBUG_RABATT] totalProductAmount >= minimumOrder ? ${totalProductAmount} >= ${minimumOrder} = ${totalProductAmount >= minimumOrder}`,
        );

        if (totalProductAmount >= minimumOrder) {
          const discountType = (userDetails as any).discountType || "fixed";

          console.log(
            `[DEBUG_RABATT] Bedingungen erfüllt. DiscountType: ${discountType}`,
          );

          if (discountType === "percentage") {
            appliedDiscount = (totalProductAmount * userDiscountAmount) / 100;
            console.log(
              `[DEBUG_RABATT] Prozentualer Rabatt angewendet: ${userDiscountAmount}% von ${totalProductAmount}€ = ${appliedDiscount}€`,
            );
          } else {
            // fixed
            appliedDiscount = userDiscountAmount;
            console.log(
              `[DEBUG_RABATT] Fester Rabatt angewendet: ${appliedDiscount}€`,
            );
          }
        } else {
          console.log(`[DEBUG_RABATT] Mindestbestellwert nicht erreicht.`);
        }
      } else {
        console.log(
          `[DEBUG_RABATT] Kein gültiger Rabatt für den Benutzer gefunden oder Betrag ist 0.`,
        );
      }
      console.log(
        `[DEBUG_RABATT] Endgültiger appliedDiscount: ${appliedDiscount}€`,
      );

      // Versandkosten serverseitig neu berechnen
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

      // Endgültiger Betrag nach Produkten, Versand und Rabatt
      finalCalculatedTotal = Math.max(
        0,
        totalProductAmount + shippingCost - appliedDiscount,
      );
      console.log(
        `[DEBUG_RABATT] Finaler Gesamtbetrag: ${totalProductAmount} + ${shippingCost} - ${appliedDiscount} = ${finalCalculatedTotal}€`,
      );

      console.log(
        `[Backend] Checkout Session: Recalculated total for user ${userId}: ${finalCalculatedTotal}€ (Products: ${totalProductAmount}€, Shipping: ${shippingCost}€, Discount: ${appliedDiscount}€)`,
      );
    } catch (error) {
      console.error("Error recalculating cart for checkout session:", error);
      return res
        .status(500)
        .json({ error: "Failed to calculate order total securely." });
    }

    if (!successUrl || !cancelUrl) {
      return res.status(400).json({
        error: "Missing success or cancel URL",
      });
    }

    // Benutzerinformationen abrufen, falls angemeldet
    const userIdFromReq = req.user?.id; // Annahme: req.user existiert aus der Auth-Middleware
    let customerEmail = "";

    if (userIdFromReq) {
      const user = await storage.getUser(userIdFromReq);
      if (user?.email) {
        customerEmail = user.email;
      }
    }

    // Metadaten-Objekt für die Stripe-Session vorbereiten (500 Zeichen Limit)
    const metadataForStripeSession: Record<string, string> = {
      userId: userId.toString(),
      language: language || "de",
      // Neu berechnete Werte in Metadaten speichern
      calculated_total: finalCalculatedTotal.toFixed(2),
      calculated_subtotal: totalProductAmount.toFixed(2),
      calculated_shipping: shippingCost.toFixed(2),
      calculated_discount: appliedDiscount.toFixed(2),
      // Zusätzlich relevante Bestelldaten für den Webhook (falls nicht alle in fullOrderData passen)
      // Diese sollten vom Frontend als Teil von `orderData` im Body gesendet werden.
      firstName: orderData?.firstName || "",
      lastName: orderData?.lastName || "",
      email: orderData?.email || "", // Kunden-E-Mail aus dem Formular
      phone: orderData?.phone || "",
      shippingAddress: orderData?.shippingAddress || "",
      shippingCity: orderData?.shippingCity || "",
      shippingPostalCode: orderData?.shippingPostalCode || "",
      shippingCountry: orderData?.shippingCountry || "",
      customerNote: orderData?.customerNote || "",
      saveAddress: orderData?.saveAddress ? "true" : "false", // Convert boolean to string
    };
    if (orderData?.orderId) {
      metadataForStripeSession.orderId = orderData.orderId.toString();
    }
    // Wichtig: Die vollständigen Bestelldaten als JSON-String, falls nötig und nicht zu groß
    // Dies erfordert, dass das Frontend `fullOrderData` an `/api/create-checkout-session` sendet.
    if (orderData) {
      metadataForStripeSession.fullOrderData = JSON.stringify(orderData);
    }

    // Liste der unterstützten Zahlungsmethoden definieren
    const supportedMethods = [
      "card",
      "paypal",
      "klarna",
      "eps",
      "sofort",
      "bancontact",
      "ideal",
      "giropay",
      "sepa_debit",
    ];

    // Bestimmen, welche Methoden für diesen Checkout verwendet werden sollen
    let paymentMethodTypes: string[] = [];

    if (paymentMethod && supportedMethods.includes(paymentMethod)) {
      paymentMethodTypes = ["card"];
      if (paymentMethod !== "card") {
        paymentMethodTypes.push(paymentMethod);
      }
    } else {
      paymentMethodTypes = supportedMethods;
    }

    console.log("⚡ Stripe payment_method_types:", paymentMethodTypes);

    // Line-Items für Stripe Checkout vorbereiten
    let lineItems: any[] = [];

    // Alle Artikel aus dem Warenkorb mappen
    for (const item of cartItems) {
      // Verwende 'cartItems', die am Anfang der Funktion abgerufen und überprüft wurden
      // Produktnamen mit Farb- und Duftinformationen formatieren
      let productName = item.product.name;

      // Farbe hinzufügen, falls vorhanden
      if (item.colorName) {
        productName += ` - ${item.colorName}`;
      }

      // Duftnamen abrufen, falls Duft-ID vorhanden
      if (item.scentId) {
        try {
          const scent = await storage.getScent(Number(item.scentId));
          if (scent && scent.name) {
            productName += ` - Duft: ${scent.name}`;
          }
        } catch (error) {
          console.error(
            `Fehler beim Abrufen des Dufts ${item.scentId}:`,
            error,
          );
        }
      }

      // Bild-URL vorbereiten - Korrektur für absolute Pfade
      let imageUrl = null;
      const currentHost = req.get("host");
      const currentProtocol = req.protocol;
      const baseUrl = `${currentProtocol}://${currentHost}`;

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
          // Prüfen, ob URL mit '/' beginnt
          const relativePath = item.product.imageUrl.startsWith("/")
            ? item.product.imageUrl
            : `/${item.product.imageUrl}`;
          // Wichtig: Backticks für Template-Literale verwenden
          imageUrl = `${baseUrl}${relativePath}`;
          console.log(`Zusammengesetzte absolute Bild-URL: ${imageUrl}`);
        }
      } else {
        console.log("Product image URL is null or empty.");
      }

      // NEUE LOGIK FÜR DIE BESCHREIBUNG:
      let productDescription: string | undefined;
      if (item.product.description) {
        // Wenn eine Beschreibung vorhanden ist, kürzen oder verwenden
        productDescription =
          item.product.description.length > 100
            ? item.product.description.substring(0, 97) + "..."
            : item.product.description;
      }
      // Wenn item.product.description null, undefined oder leer ist, wird productDescription undefined,
      // und somit wird das Feld nicht an Stripe gesendet.

      // Erstellen des product_data-Objekts
      const productData: Stripe.Checkout.SessionCreateParams.LineItem.PriceData.ProductData =
        {
          name: productName,
          images: imageUrl ? [imageUrl] : undefined,
        };

      // Füge die Beschreibung nur hinzu, wenn sie existiert und nicht leer ist.
      if (productDescription) {
        productData.description = productDescription;
      }

      // Stripe Line Item für diesen Artikel erstellen
      lineItems.push({
        price_data: {
          currency: "eur",
          product_data: productData,
          unit_amount: (() => {
            const price = parseFloat(String(item.product.price));
            const unitAmount = Math.round(price * 100);
            console.log(
              `[DEBUG STRIPE] Proizvod: "${productName}", Cijena: ${price}€, unit_amount: ${unitAmount}`,
            );
            if (isNaN(unitAmount) || unitAmount <= 0) {
              console.warn(
                `[DEBUG STRIPE] NEISPRAVAN UNIT_AMOUNT za proizvod "${productName}": ${unitAmount}`,
              );
            }
            return unitAmount;
          })(),
        },
        quantity: item.quantity,
      });
    }

    // Wenn keine Artikel im Warenkorb gefunden wurden (sollte aufgrund der anfänglichen Prüfung redundant sein),
    // ein generisches Line Item verwenden.
    if (lineItems.length === 0) {
      lineItems = [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Bestellung aus Kerzenwelt by Dani",
              description: orderData?.orderId
                ? `Bestellnummer: ${orderData.orderId}`
                : "Online-Bestellung",
            },
            unit_amount: Math.round(finalCalculatedTotal * 100), // Verwende den berechneten Gesamtbetrag
          },
          quantity: 1,
        },
      ];
    }

    // Dodaj troškove dostave kao Line Item, ako postoje
    if (shippingCost > 0) {
      lineItems.push({
        price_data: {
          currency: "eur",
          product_data: {
            name: "Versandkosten",
            description: "Standardversand",
          },
          unit_amount: Math.round(shippingCost * 100),
        },
        quantity: 1,
      });
      console.log(`[DEBUG STRIPE] Dodani troškovi dostave: ${shippingCost}€`);
    }

    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];

    if (appliedDiscount > 0) {
      try {
        // Kreiraj privremeni kupon
        const coupon = await stripe.coupons.create({
          amount_off: Math.round(appliedDiscount * 100), // Iznos popusta u centima
          currency: "eur",
          duration: "once", // Jednokratni popust za ovu sesiju
          name:
            userDetails?.discountType === "percentage"
              ? `${userDetails.discountAmount}% Rabatt`
              : "Gutschein-Rabatt",
        });
        discounts.push({ coupon: coupon.id });
        console.log(
          `[DEBUG STRIPE] Kupon kreiran za popust: ${coupon.id}, iznos: ${appliedDiscount}€`,
        );
      } catch (couponError: any) {
        console.error(
          `[DEBUG STRIPE ERROR] Greška pri kreiranju kupona: ${couponError.message}`,
        );
        discounts = [];
      }
    } else {
      console.log(
        `[DEBUG STRIPE] Nema primijenjenog popusta (appliedDiscount je 0).`,
      );
    }
    // KREIRANJE STRIPE SESIJE:
    const session = await stripe.checkout.sessions.create({
      payment_method_types: paymentMethodTypes as any,
      line_items: lineItems,
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: metadataForStripeSession,
      customer_email: customerEmail || undefined,
      locale: language || "de",
      billing_address_collection: "required" as any,
      phone_number_collection: {
        enabled: true,
      },
      discounts: discounts,
    } as any);

    // Session ID an den Client zurückgeben
    res.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({
      error: "Failed to create checkout session",
      message: error.message,
    });
  }
}
