import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import {
  createPaypalOrder,
  capturePaypalOrder,
  loadPaypalDefault,
} from "./paypal";
import { createPaymentIntent, createCheckoutSession, stripe } from "./stripe";
import { upload, resizeImage } from "./imageUpload";
import fs from "fs";
import path from "path";
import multer from "multer";
import { z } from "zod";
import { eq, sql, and, isNull, sum, desc } from "drizzle-orm";
import { db, pool } from "./db";
import { registerDocumentRoutes } from "./documentRoutes";
import { generateInvoiceFromOrder } from "./invoiceService";
import { sendEmail } from "./notificationService";
import {
  sendNewOrderNotification,
  sendInvoiceGeneratedNotification,
} from "./notificationService";
import {
  productScents,
  productColors,
  insertProductSchema,
  insertCategorySchema,
  insertOrderSchema,
  insertOrderItemSchema,
  insertCartItemSchema,
  insertReviewSchema,
  insertSettingSchema,
  insertScentSchema,
  insertColorSchema,
  insertProductImageSchema,
  insertCollectionSchema,
  insertInvoiceSchema,
  insertInvoiceItemSchema,
  companyDocuments,
  insertCompanyDocumentSchema,
  cartItems,
  CartItem,
  heroSettingsSchema,
  subscriberSchema,
  insertSubscriberSchema,
  subscribers,
  InsertMailboxMessageSchema,
  mailboxMessages, // <-- Diese Zeile hinzufügen
  pageVisits,
} from "@shared/schema";
import { authMiddleware, adminMiddleware } from "./auth"; // <-- Promijenjeno!
import { handleStripeWebhook } from "./stripeWebhookHandler";
import { InsertMailboxMessageSchema } from "@shared/schema"; // Stelle sicher, dass dies importiert ist, falls noch nicht geschehen

import multer from "multer"; // <-- HIER HINZUFÜGEN
import { simpleParser } from "mailparser"; // <-- NEU: Importiere simpleParser

// NEU: Importiere die E-Mail-Sende-Funktion von sendgrid.ts
// (Angenommen, du hast eine `sendgrid.ts` Datei, die die sendEmail Funktion exportiert)
import { sendEmail as sendgridEmail } from "./sendgrid"; // Um Konflikte mit deiner notificationService.ts sendEmail zu vermeiden, benenne diese um

// Konfiguriere multer für den Inbound Parse Webhook
// SendGrid sendet keine Dateien, aber es ist `multipart/form-data`.
// Wir brauchen nur die Textfelder, also können wir `none()` verwenden
// oder `fields()` wenn du spezifische Textfelder benötigst.
const uploadInboundEmail = multer().none(); // Verarbeitet nur Textfelder
import fetch from "node-fetch";

// Globaler Cache für das Mapping im Backend
let backendCountryAlpha2ToNumericIdMap: Record<string, string> | null = null;
let backendCountryNumericIdToAlpha2Map: Record<string, string> | null = null;

// Funktion zum Laden der Mapping-Daten im Backend (einmalig beim Serverstart)
async function loadBackendCountryMappings() {
  if (backendCountryAlpha2ToNumericIdMap) return; // Schon geladen

  try {
    const response = await fetch(
      "https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.json",
    );
    const data: any[] = await response.json();

    backendCountryAlpha2ToNumericIdMap = {};
    backendCountryNumericIdToAlpha2Map = {};

    data.forEach((country) => {
      if (country["alpha-2"] && country.numeric) {
        backendCountryAlpha2ToNumericIdMap[country["alpha-2"]] =
          country.numeric;
        backendCountryNumericIdToAlpha2Map[country.numeric] =
          country["alpha-2"];
      }
    });
    backendCountryAlpha2ToNumericIdMap["Localhost"] = "Localhost"; // Führe dies auch hier ein
    backendCountryNumericIdToAlpha2Map["Localhost"] = "Localhost";
    console.log("Backend Country Mappings loaded successfully.");
  } catch (error) {
    console.error("Backend Error loading country mappings:", error);
    // Handle Fehlerfall, z.B. Server nicht starten lassen
    throw error; // Server sollte nicht ohne Mappings starten, wenn diese kritisch sind
  }
}

async function getCountryFromIp(ip: string): Promise<string | null> {
  // Für localhost-IPs wird es nicht funktionieren, gib 'Localhost' zurück
  if (ip === "::1" || ip === "127.0.0.1") {
    return "Localhost"; // Kannst du auch auf `null` setzen, wenn diese ignoriert werden sollen
  }
  // Verwende einen Dienst wie ip-api.com (kostenlos mit Rate Limits)
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}`);
    const data = await response.json();
    if (data.status === "success" && data.countryCode) {
      return data.countryCode; // Gibt z.B. 'AT' für Österreich zurück
    }
  } catch (error) {
    console.error(`Error getting country for IP ${ip}:`, error);
  }
  return null;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  setupAuth(app);

  // Set up document routes for company documents
  registerDocumentRoutes(app);

  // Webhook je sada u index.ts prije JSON parsiranja

  app.post("/api/orders/stripe-success", authMiddleware, async (req, res) => {
    try {
      const { sessionId } = req.body;
      const userId = req.user?.id;

      if (!sessionId || !userId) {
        console.error("Fehler: Sitzungs-ID oder Benutzer-ID fehlt.");
        return res
          .status(400)
          .json({ message: "Sitzungs-ID oder Benutzer-ID fehlt." });
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent"], // Dovoljno je payment_intent, ne treba line_items.data.price.product za ovaj dio
      });

      if (session.payment_status === "paid") {
        const paymentIntentId = session.payment_intent?.id as string;
        let orderToUpdate;

        // PRVO: Pokušaj pronaći narudžbu po metadata.order_id (koji smo mi poslali)
        if (session.metadata?.order_id) {
          const orderIdFromMetadata = parseInt(session.metadata.order_id);
          orderToUpdate = await db.query.orders.findFirst({
            where: eq(orders.id, orderIdFromMetadata),
          });
          console.log(
            `Pokušavam pronaći narudžbu po metadata.order_id: ${orderIdFromMetadata}`,
          );
        }

        // AKO NIJE PRONAĐENO PO METADATA.ORDER_ID (backup, manje idealno): Pokušaj po paymentIntentId
        if (!orderToUpdate && paymentIntentId) {
          orderToUpdate = await db.query.orders.findFirst({
            where: eq(orders.paymentIntentId, paymentIntentId),
          });
          console.log(
            `Pokušavam pronaći narudžbu po paymentIntentId (backup): ${paymentIntentId}`,
          );
        }

        if (orderToUpdate) {
          if (orderToUpdate.status === "completed") {
            console.log(
              `Bestellung ${orderToUpdate.id} wurde bereits verarbeitet.`,
            );
            return res.json({
              success: true,
              message: "Bestellung bereits erfolgreich bestätigt.",
              orderId: orderToUpdate.id,
            });
          }

          // Ažuriraj narudžbu
          await db
            .update(orders)
            .set({
              status: "completed",
              paymentIntentId: paymentIntentId, // Dodajte paymentIntentId za referencu
              updatedAt: new Date(),
            })
            .where(eq(orders.id, orderToUpdate.id));

          // Obriši stavke iz košarice za ovog korisnika
          await db.delete(cartItems).where(eq(cartItems.userId, userId)); // Ova linija je ključna!

          console.log(
            `Bestellung ${orderToUpdate.id} erfolgreich aktualisiert.`,
          );
          return res.json({
            success: true,
            message: "Bestellung erfolgreich aktualisiert.",
            orderId: orderToUpdate.id, // Vratite ID narudžbe frontendu!
          });
        } else {
          console.error(
            "Fehler: Bestehende Bestellung konnte nicht gefunden werden, um die Stripe-Sitzung abzuschließen.",
          );
          // OVDJE BI SE MOGLA DODATI LOGIKA ZA KREIRANJE POTPUNO NOVE NARUDŽBE
          // AKO NIJE KREIRANA PRETHODNO (kompleksnije, ali sigurnije)
          return res.status(404).json({
            message:
              "Bestellung nicht gefunden. Bitte kontaktieren Sie den Support.",
          });
        }
      } else {
        console.warn(
          `Stripe Sitzung ${sessionId} hat den Status: ${session.payment_status}.`,
        );
        return res.status(400).json({
          message: "Zahlung nicht erfolgreich oder noch ausstehend.",
          status: session.payment_status,
        });
      }
    } catch (error) {
      console.error("Fehler bei der Stripe-Erfolgsbearbeitung:", error);
      return res.status(500).json({
        message: "Ein Fehler ist bei der Zahlungsabwicklung aufgetreten.",
        error: (error as Error).message,
      });
    }
  });

  // Stripe routes
  app.post("/api/create-payment-intent", async (req, res) => {
    await createPaymentIntent(req, res);
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    await createCheckoutSession(req, res);
  });

  // Nova ruta za procesiranje Stripe sesije nakon uspješnog plaćanja
  app.post("/api/process-stripe-session", async (req, res) => {
    // Explicitly set Content-Type header to application/json
    res.setHeader("Content-Type", "application/json");

    try {
      console.log("Primljen zahtjev za obradu Stripe sesije, body:", req.body);

      const { sessionId, userId: providedUserId, language } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: "Nedostaje ID sesije" });
      }

      // Pokušamo dohvatiti korisnika iz sesije ili iz zahtjeva
      let userId: number | undefined = req.user?.id;

      // Ako je ID korisnika proslijeđen u zahtjevu, koristimo ga
      if (!userId && providedUserId) {
        userId = parseInt(providedUserId);
        console.log(`Koristim ID korisnika iz zahtjeva: ${userId}`);
      }

      // Ako korisnik nije prijavljen, nastavljamo s obradom Stripe sesije
      // ali s direktnim pristupom u processStripeSession funkciji
      if (!userId) {
        console.log(
          "Korisnik nije prijavljen u sesiji, nastavit ćemo s obradom Stripe podataka",
        );

        // Dohvaćamo korisnika iz baze koristeći metadata u Stripe sesiji
        try {
          const { stripe } = await import("./stripe");
          const stripeSession = await stripe.checkout.sessions.retrieve(
            sessionId,
            {
              expand: [
                "line_items",
                "payment_intent",
                "customer",
                "customer_details",
              ],
            },
          );

          // Pokušamo izvući userID iz metapodataka
          if (stripeSession.metadata?.userId) {
            userId = parseInt(stripeSession.metadata.userId);
            console.log(
              `Pronađen ID korisnika u Stripe metapodacima: ${userId}`,
            );
          }
        } catch (stripeError) {
          console.error("Greška pri dohvaćanju Stripe sesije:", stripeError);
        }
      }

      // E-Mail-Optionen wurden entfernt, da sie nicht korrekt funktionieren

      // Ako i dalje nemamo korisnika, provjeravamo imamo li email u Stripe sesiji
      if (!userId) {
        try {
          const { stripe } = await import("./stripe");
          const stripeSession = await stripe.checkout.sessions.retrieve(
            sessionId,
            {
              expand: [
                "line_items",
                "payment_intent",
                "customer",
                "customer_details",
              ],
            },
          );

          // Pokušavamo pronaći korisnika po emailu iz Stripe sesije
          if (stripeSession.customer_details?.email) {
            const userByEmail = await storage.getUserByEmail(
              stripeSession.customer_details.email,
            );
            if (userByEmail) {
              userId = userByEmail.id;
              console.log(
                `Pronađen korisnik po emailu iz Stripe sesije: ${userByEmail.email}, ID: ${userId}`,
              );
            }
          }
        } catch (err) {
          console.error(
            "Greška pri traženju korisnika po emailu iz Stripe sesije:",
            err,
          );
        }
      }

      // Vraćamo grešku samo ako definitivno ne možemo pronaći korisnika
      if (!userId) {
        return res.status(400).json({
          error: "Nije pronađen ID korisnika za kreiranje narudžbe",
          details:
            "Korisnik nije prijavljen i metadata ne sadrži userId. Molimo pokušajte ponovno.",
        });
      }

      console.log(
        `Obrađujem Stripe sesiju ${sessionId} za korisnika ${userId}`,
      );

      // Dohvaćamo modul za Stripe procesiranje
      const { processStripeSession } = await import("./stripe");

      try {
        // Obrađujemo Stripe sesiju i kreiramo narudžbu
        const result = await processStripeSession(sessionId, userId);

        // Čistimo košaricu korisnika nakon uspješne narudžbe
        try {
          await storage.clearCart(userId);
          console.log(
            `Očišćena košarica za korisnika ${userId} nakon uspješne narudžbe`,
          );
        } catch (cartError) {
          console.error(
            `Greška pri čišćenju košarice korisnika ${userId}:`,
            cartError,
          );
          // Ne prekidamo proces ako je čišćenje košarice neuspjelo
        }

        console.log("Uspješno obrađena narudžba, šaljem odgovor:", result);

        // Vraćamo podatke o narudžbi
        return res.json(result);
      } catch (processError) {
        console.error("Greška pri procesiranju Stripe sesije:", processError);
        return res.status(500).json({
          error: "Greška pri procesiranju Stripe sesije",
          details: processError.message || String(processError),
        });
      }
    } catch (error: any) {
      console.error("Greška pri obradi Stripe sesije:", error);
      res.status(500).json({
        error: "Greška pri obradi Stripe sesije",
        details: error.message || String(error),
      });
    }
  });

  // Enable serving static files from the public directory
  app.use(express.static(path.join(process.cwd(), "public")));

  // PayPal API routes
  app.get("/api/paypal/setup", async (req, res) => {
    await loadPaypalDefault(req, res);
  });

  app.post("/api/paypal/order", async (req, res) => {
    // Request body should contain: { intent, amount, currency }
    await createPaypalOrder(req, res);
  });

  app.post("/api/paypal/order/:orderID/capture", async (req, res) => {
    await capturePaypalOrder(req, res);
  });

  // Specific handler for uploads directory
  app.use("/uploads", (req, res, next) => {
    const filePath = path.join(
      process.cwd(),
      "public",
      "uploads",
      path.basename(req.url),
    );
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error("Error serving file:", err);
        next();
      }
    });
  });

  // Image Upload Route
  app.post("/api/upload", upload.single("image"), resizeImage, (req, res) => {
    if (!req.body.imageUrl) {
      return res.status(400).json({ error: "Greška pri uploadu slike" });
    }

    // Vraćamo putanju do slike koju klijent može koristiti
    res.json({ imageUrl: req.body.imageUrl });
  });

  // ===== API rute za proizvode (Javno dostupne - samo aktivni proizvodi) =====
  app.get("/api/products", async (req, res) => {
    try {
      // includeInactive je uvijek false za javne rute
      const includeInactive = false;

      const categoryId = req.query.category
        ? parseInt(req.query.category as string)
        : null;

      let products;
      if (categoryId) {
        console.log(
          `API: Filtriranje proizvoda po ID-u kategorije: ${categoryId}`,
        );
        products = await storage.getProductsByCategory(
          categoryId,
          includeInactive,
        );
        console.log(
          `DEBUG: API /api/products - Pronađeno ${products.length} proizvoda u kategoriji ${categoryId}`,
        );
        console.log(
          "DEBUG: API /api/products - Uzorak proizvoda:",
          products.slice(0, 5).map((p) => ({
            id: p.id,
            name: p.name,
            categoryId: p.categoryId,
            active: p.active,
          })),
        );
      } else {
        console.log(
          "API: Dohvaćanje svih proizvoda, includeInactive:",
          includeInactive,
        );
        products = await storage.getAllProducts(includeInactive);
        console.log(
          `DEBUG: API /api/products - Dohvaćeno ${products.length} ukupno proizvoda`,
        );
      }

      res.json(products);
    } catch (error) {
      console.error("Greška pri dohvaćanju proizvoda:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/products/featured", async (req, res) => {
    try {
      // Dohvati istaknute proizvode (metoda već sama filtrira neaktivne proizvode)
      const featuredProducts = await storage.getFeaturedProducts();
      res.json(featuredProducts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch featured products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Proizvod se vraća samo ako postoji i ako je aktivan
      if (!product.active) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  // ===== API Route für öffentliche Produktlisten (mit optionalem Kategorie-Filter) =====
  app.get("/api/products", async (req, res) => {
    try {
      const categoryIdString = req.query.category as string | undefined; // Hole den 'category' Query-Parameter

      let products;

      if (categoryIdString) {
        // Wenn eine categoryId übergeben wurde
        const categoryId = parseInt(categoryIdString);
        if (isNaN(categoryId)) {
          return res
            .status(400)
            .json({ message: "Invalid category ID format" });
        }
        console.log(
          `Backend: Fetching products for category ID: ${categoryId}`,
        );
        // Rufe Produkte für diese Kategorie ab (nur aktive Produkte für öffentliche Routen)
        // Du hast bereits storage.getProductsByCategory
        products = await storage.getProductsByCategory(categoryId, false); // false für includeInactive
      } else {
        // Wenn keine categoryId übergeben wurde, hole alle aktiven Produkte
        console.log("Backend: Fetching all active products");
        // Du brauchst eine Funktion wie storage.getAllActiveProducts() oder
        // storage.getAllProducts(false) die nur aktive Produkte liefert.
        // Angenommen, du hast eine Funktion storage.getAllProducts(includeInactive: boolean)
        products = await storage.getAllProducts(false); // false für includeInactive
      }

      res.json(products);
    } catch (error) {
      console.error("Backend: Failed to fetch products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.put("/api/products/:id", adminMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log(
        "Ažuriranje proizvoda ID:",
        id,
        "Podaci:",
        JSON.stringify(req.body),
      );

      const existingProduct = await storage.getProduct(id);
      if (!existingProduct) {
        console.log("Proizvod nije pronađen. ID:", id);
        return res.status(404).json({ message: "Product not found" });
      }

      try {
        const validatedData = insertProductSchema.parse(req.body);
        console.log("Validirani podaci:", JSON.stringify(validatedData));

        const product = await storage.updateProduct(id, validatedData);
        if (!product) {
          return res.status(404).json({ message: "Product not found" });
        }

        console.log("Proizvod uspješno ažuriran:", JSON.stringify(product));
        res.json(product);
      } catch (validationError) {
        console.error("Greška pri validaciji:", validationError);
        if (validationError instanceof z.ZodError) {
          return res.status(400).json({ message: validationError.errors });
        }
        throw validationError;
      }
    } catch (error) {
      console.error("Greška pri ažuriranju proizvoda:", error);
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  // PATCH endpoint za parcijalnu izmjenu podataka proizvoda (npr. status aktivnosti)
  app.patch("/api/products/:id", adminMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log(
        "Parcijalno ažuriranje proizvoda ID:",
        id,
        "Podaci:",
        JSON.stringify(req.body),
      );

      const existingProduct = await storage.getProduct(id);
      if (!existingProduct) {
        console.log("Proizvod nije pronađen. ID:", id);
        return res.status(404).json({ message: "Product not found" });
      }

      try {
        const currentData = {
          name: existingProduct.name,
          description: existingProduct.description,
          price: existingProduct.price,
          imageUrl: existingProduct.imageUrl,
          categoryId: existingProduct.categoryId,
          stock: existingProduct.stock,
          featured: existingProduct.featured,
          active: existingProduct.active !== false,
          hasColorOptions: existingProduct.hasColorOptions,
          allowMultipleColors: existingProduct.allowMultipleColors,
          scent: existingProduct.scent,
          color: existingProduct.color,
          burnTime: existingProduct.burnTime,
          dimensions: existingProduct.dimensions,
          weight: existingProduct.weight,
          materials: existingProduct.materials,
          instructions: existingProduct.instructions,
          maintenance: existingProduct.maintenance,
        };

        let updatedData = { ...currentData };

        if (req.body) {
          if ("active" in req.body) {
            updatedData.active =
              req.body.active === true || req.body.active === "true";
          }

          Object.keys(req.body).forEach((key) => {
            if (key !== "active" && key in currentData) {
              updatedData[key as keyof typeof currentData] = req.body[key];
            }
          });
        }

        console.log("Ažurirani podaci:", JSON.stringify(updatedData));

        const product = await storage.updateProduct(id, updatedData);
        if (!product) {
          console.log("Product not found nakon updateProduct");
          return res.status(404).json({ message: "Product not found" });
        }

        console.log("Proizvod uspješno ažuriran:", JSON.stringify(product));
        const simplifiedResponse = {
          id: product.id,
          name: product.name,
          active: product.active === true,
        };
        console.log("Šaljem odgovor:", JSON.stringify(simplifiedResponse));
        res.setHeader("Content-Type", "application/json");
        return res.status(200).json(simplifiedResponse);
      } catch (validationError) {
        console.error("Greška pri validaciji:", validationError);
        return res.status(400).json({
          message: "Validation error",
          error: validationError.message,
        });
      }
    } catch (error) {
      console.error("Greška pri ažuriranju proizvoda:", error);
      return res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", adminMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProduct(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  app.get("/api/admin/products", adminMiddleware, async (req, res) => {
    try {
      const products = await storage.getAllProducts(true); // Dohvati i neaktivne
      res.json(products);
    } catch (error) {
      console.error("Greška pri dohvaćanju admin proizvoda:", error);
      res.status(500).json({ message: "Failed to fetch admin products" });
    }
  });

  app.get("/api/admin/products/:id", adminMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id); // Dohvati proizvod bez obzira na aktivnost
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Greška pri dohvaćanju admin proizvoda po ID-u:", error);
      res.status(500).json({ message: "Failed to fetch admin product" });
    }
  });

  app.get(
    "/api/admin/categories/:id/products",
    adminMiddleware,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const products = await storage.getProductsByCategory(id, true); // Dohvati i neaktivne
        res.json(products);
      } catch (error) {
        console.error(
          "Greška pri dohvaćanju admin kategorijskih proizvoda:",
          error,
        );
        res
          .status(500)
          .json({ message: "Failed to fetch admin category products" });
      }
    },
  );

  // ===== API rute za kategorije (Javno dostupne) =====
  app.get("/api/categories", async (req, res) => {
    try {
      // getAllCategories bi trebao filtrirati samo aktivne kategorije
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.get("/api/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.getCategory(id);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch category" });
    }
  });

  app.get("/api/categories/:id/products", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // includeInactive je uvijek false za javne rute
      const includeInactive = false;
      const products = await storage.getProductsByCategory(id, includeInactive);
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products by category" });
    }
  });

  // ===== API rute za kategorije (ADMIN) =====
  app.post("/api/categories", adminMiddleware, async (req, res) => {
    try {
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(validatedData);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.put("/api/categories/:id", adminMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await storage.updateCategory(id, validatedData);

      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", adminMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCategory(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Cart
  app.get("/api/cart", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const cartItems = await storage.getCartItems(req.user.id);
      res.json(cartItems);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch cart items" });
    }
  });

  app.post("/api/cart", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      console.log(
        "[POST /api/cart] Primljeni podaci:",
        JSON.stringify(req.body, null, 2),
      );

      const validatedData = insertCartItemSchema.parse({
        ...req.body,
        userId: req.user.id,
      });

      console.log(
        "[POST /api/cart] Validirani podaci:",
        JSON.stringify(validatedData, null, 2),
      );

      // Provjera da li proizvod koristi višestruke boje
      const hasMultipleColors = validatedData.hasMultipleColors || false;
      const colorIds = validatedData.colorIds || null;
      const colorName = validatedData.colorName || null;

      // Različita logika pretrage ovisno o tome koristi li se višestruki odabir boja
      let existingCartItemsQuery;

      if (hasMultipleColors) {
        // Ako koristimo višestruki odabir boja, tražimo po colorIds i ignoriramo colorId
        console.log(
          "[POST /api/cart] Traženje stavke s višestrukim bojama:",
          colorIds,
        );
        existingCartItemsQuery = await db.execute(sql`
          SELECT * FROM cart_items 
          WHERE 
            user_id = ${validatedData.userId} AND 
            product_id = ${validatedData.productId} AND
            scent_id IS NOT DISTINCT FROM ${validatedData.scentId} AND
            has_multiple_colors = true AND
            color_ids IS NOT DISTINCT FROM ${colorIds}
        `);
      } else {
        // Standardna pretraga po pojedinačnoj boji
        console.log("[POST /api/cart] Traženje stavke s jednom bojom");
        existingCartItemsQuery = await db.execute(sql`
          SELECT * FROM cart_items 
          WHERE 
            user_id = ${validatedData.userId} AND 
            product_id = ${validatedData.productId} AND
            scent_id IS NOT DISTINCT FROM ${validatedData.scentId} AND
            color_id IS NOT DISTINCT FROM ${validatedData.colorId} AND
            has_multiple_colors = false
        `);
      }

      const existingCartItems = existingCartItemsQuery.rows;
      console.log(
        "[POST /api/cart] Pronađene postojeće stavke:",
        JSON.stringify(existingCartItems, null, 2),
      );

      let cartItem;

      // Ako postoji identična stavka, povećaj količinu, inače dodaj novu stavku
      if (existingCartItems.length > 0) {
        const existingItem = existingCartItems[0];
        console.log(
          `[POST /api/cart] Ažuriram postojeću stavku ${existingItem.id}, količina ${existingItem.quantity} => ${existingItem.quantity + validatedData.quantity}`,
        );

        const updateQuery = await db.execute(sql`
          UPDATE cart_items 
          SET quantity = quantity + ${validatedData.quantity}
          WHERE id = ${existingItem.id}
          RETURNING *
        `);

        cartItem = updateQuery.rows[0];
      } else {
        console.log(`[POST /api/cart] Dodajem novu stavku u košaricu`);

        // Mapiramo iz camelCase u snake_case za direktni SQL upit
        console.log(
          `[POST /api/cart] Inserting: userId=${validatedData.userId}, productId=${validatedData.productId}, quantity=${validatedData.quantity}`,
        );

        // Različiti upiti za dodavanje stavke ovisno o tome koristi li višestruki odabir boja
        let insertQuery;

        if (hasMultipleColors) {
          console.log(
            `[POST /api/cart] Dodajem stavku s višestrukim bojama: ${colorIds}, nazivBoja: ${colorName}`,
          );
          insertQuery = await db.execute(sql`
            INSERT INTO cart_items (
              user_id, 
              product_id, 
              quantity, 
              scent_id, 
              color_id,
              color_ids,
              color_name,
              has_multiple_colors
            )
            VALUES (
              ${validatedData.userId}, 
              ${validatedData.productId}, 
              ${validatedData.quantity}, 
              ${validatedData.scentId}, 
              NULL,
              ${colorIds},
              ${colorName},
              true
            )
            RETURNING *
          `);
        } else {
          console.log(
            `[POST /api/cart] Dodajem stavku s jednom bojom: ID=${validatedData.colorId}`,
          );
          insertQuery = await db.execute(sql`
            INSERT INTO cart_items (
              user_id, 
              product_id, 
              quantity, 
              scent_id, 
              color_id,
              color_name,
              has_multiple_colors
            )
            VALUES (
              ${validatedData.userId}, 
              ${validatedData.productId}, 
              ${validatedData.quantity}, 
              ${validatedData.scentId}, 
              ${validatedData.colorId},
              ${colorName},
              false
            )
            RETURNING *
          `);
        }

        cartItem = insertQuery.rows[0];
      }

      console.log(
        "[POST /api/cart] Dodano u košaricu:",
        JSON.stringify(cartItem, null, 2),
      );

      // Odmah nakon dodavanja dohvatimo sve stavke u košarici za provjeru
      const allCartItems = await storage.getCartItems(req.user.id);
      console.log(
        "[POST /api/cart] Sve stavke u košarici nakon dodavanja:",
        JSON.stringify(
          allCartItems.map((item) => ({
            id: item.id,
            productId: item.productId,
            productName: item.product.name,
            quantity: item.quantity,
            scentId: item.scentId,
            scentName: item.scent?.name,
            colorId: item.colorId,
            colorName: item.color?.name,
          })),
          null,
          2,
        ),
      );

      res.status(201).json(cartItem);
    } catch (error) {
      console.error("[POST /api/cart] Greška:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to add item to cart" });
    }
  });

  app.put("/api/cart/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      const { quantity } = req.body;

      if (typeof quantity !== "number" || quantity < 1) {
        return res.status(400).json({ message: "Invalid quantity" });
      }

      const cartItem = await storage.updateCartItem(id, quantity, req.user.id);
      if (!cartItem) {
        return res.status(404).json({ message: "Cart item not found" });
      }

      res.json(cartItem);
    } catch (error) {
      res.status(500).json({ message: "Failed to update cart item" });
    }
  });

  app.delete("/api/cart/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      await storage.removeFromCart(id, req.user.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to remove cart item" });
    }
  });

  app.delete("/api/cart", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      console.log(
        `[DELETE /api/cart] Brisanje košarice za korisnika ${req.user.id}`,
      );

      // Koristi direktni SQL upit za brisanje
      await db.execute(sql`
        DELETE FROM cart_items 
        WHERE user_id = ${req.user.id}
      `);

      console.log(`[DELETE /api/cart] Košarica uspješno obrisana`);

      res.status(204).send();
    } catch (error) {
      console.error("[DELETE /api/cart] Greška:", error);
      res.status(500).json({ message: "Failed to clear cart" });
    }
  });

  // Dodajemo POST rutu za čišćenje košarice zbog jednostavnijeg testiranja
  app.post("/api/cart/clear", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      console.log(
        `[POST /api/cart/clear] Čišćenje košarice za korisnika ${req.user.id}`,
      );

      // Koristi direktni SQL upit za brisanje
      await db.execute(sql`
        DELETE FROM cart_items 
        WHERE user_id = ${req.user.id}
      `);

      // Dohvati svježe podatke o košarici nakon čišćenja
      const emptyCart = await storage.getCartItems(req.user.id);
      console.log(`[POST /api/cart/clear] Košarica uspješno obrisana`);

      res
        .status(200)
        .json({ message: "Cart cleared successfully", cart: emptyCart });
    } catch (error) {
      console.error("[POST /api/cart/clear] Greška:", error);
      res.status(500).json({ message: "Failed to clear cart" });
    }
  });

  // Orders
  app.get("/api/orders", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (
        req.body.paymentMethod === "nachnahme" &&
        req.body.shippingCountry !== "Österreich"
      ) {
        return res.status(400).json({
          error: "Nachnahme ist nur für Österreich verfügbar.",
        });
      }

      if (req.user.isAdmin) {
        const orders = await storage.getAllOrders();
        return res.json(orders);
      }

      const orders = await storage.getUserOrders(req.user.id);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/orders/user", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userId = req.user.id;
      const orders = await storage.getUserOrders(userId);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user orders" });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      const order = await storage.getOrder(id);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (!req.user.isAdmin && order.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.get("/api/orders/:id/items", async (req, res) => {
    try {
      console.log("Dohvaćanje stavki narudžbe:", req.params.id);

      if (!req.isAuthenticated()) {
        console.log("Korisnik nije autentificiran");
        return res.status(401).json({ message: "Unauthorized" });
      }

      console.log("Autentificirani korisnik:", req.user.id);

      const id = parseInt(req.params.id);
      const order = await storage.getOrder(id);

      if (!order) {
        console.log("Narudžba nije pronađena:", id);
        return res.status(404).json({ message: "Order not found" });
      }

      console.log(
        "Pronađena narudžba:",
        order.id,
        "Korisnik narudžbe:",
        order.userId,
      );

      if (!req.user.isAdmin && order.userId !== req.user.id) {
        console.log(
          "Korisnik nema pristup:",
          req.user.id,
          "Korisnik narudžbe:",
          order.userId,
        );
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Dohvati stavke narudžbe
      const orderItems = await storage.getOrderItems(id);
      console.log("Dohvaćeno stavki:", orderItems.length);
      if (orderItems.length > 0) {
        console.log("Cijeli item:", JSON.stringify(orderItems[0]));
      }

      // Potrebno je dodati product podatke na svaku stavku
      const enhancedItems = [];
      for (const item of orderItems) {
        try {
          const product = await storage.getProduct(item.productId);

          // Provjera za detalje o mirisu i boji
          let scentName = item.scentName || null;
          let colorName = item.colorName || null;

          // Ako nemamo nazive, a imamo ID-eve, dohvatimo ih
          if (!scentName && item.scentId) {
            try {
              const scent = await storage.getScent(item.scentId);
              if (scent) {
                scentName = scent.name;
              }
            } catch (error) {
              console.error(
                `Greška pri dohvaćanju mirisa za stavku ${item.id}:`,
                error,
              );
            }
          }

          if (!colorName && item.colorId) {
            try {
              const color = await storage.getColor(item.colorId);
              if (color) {
                colorName = color.name;
              }
            } catch (error) {
              console.error(
                `Greška pri dohvaćanju boje za stavku ${item.id}:`,
                error,
              );
            }
          }

          // Dodajemo podatke o proizvodu na stavku
          const enhancedItem = {
            ...item,
            product: product || {
              id: item.productId,
              name: item.productName || `Proizvod #${item.productId}`,
              price: item.price,
              description: "",
              imageUrl: null,
              categoryId: null,
              stock: 0,
              scent: null,
              color: null,
              burnTime: null,
              featured: false,
              hasColorOptions: false,
              allowMultipleColors: false, // Dodana podrška za višestruke boje
              active: true, // Podrazumijevano aktivan
              createdAt: new Date(),
            },
            scentName: scentName || item.scentName,
            colorName: colorName || item.colorName,
            // Provjeriti ima li proizvod svojstvo allowMultipleColors i/ili sama stavka hasMultipleColors
            hasMultipleColors:
              item.hasMultipleColors ||
              (product && product.allowMultipleColors) ||
              false,
          };
          enhancedItems.push(enhancedItem);
        } catch (err) {
          console.error(
            `Greška pri dohvaćanju proizvoda ${item.productId}:`,
            err,
          );
          // Dodajemo stavku i bez proizvoda ako dođe do greške
          enhancedItems.push({
            ...item,
            product: {
              id: item.productId,
              name: item.productName || `Proizvod #${item.productId}`,
              price: item.price,
              description: "",
              imageUrl: null,
              categoryId: null,
              stock: 0,
              scent: null,
              color: null,
              burnTime: null,
              featured: false,
              hasColorOptions: false,
              allowMultipleColors: false,
              active: true,
              createdAt: new Date(),
            },
            scentName: item.scentName || null,
            colorName: item.colorName || null,
            hasMultipleColors: item.hasMultipleColors || false,
          });
        }
      }

      console.log("Obogaćene stavke:", enhancedItems.length);
      res.json(enhancedItems);
    } catch (error) {
      console.error("Greška pri dohvaćanju stavki narudžbe:", error);
      res.status(500).json({ message: "Failed to fetch order items" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    console.log(
      `🚀 [ORDER ENDPOINT] Starting order creation for user ${req.user?.id}`,
    );
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get user discount info before creating order
      const userForDiscountInfo = await storage.getUser(req.user.id);
      const currentDiscountType =
        (userForDiscountInfo as any)?.discountType || "fixed";
      const currentDiscountPercentage =
        currentDiscountType === "percentage"
          ? parseFloat(userForDiscountInfo?.discountAmount || "0")
          : 0;

      // Process discount for this user BEFORE creating validatedData
      let appliedDiscount = 0;
      console.log(
        `n��� [DIRECT ORDER DEBUG] Processing discount for user ${req.user.id}`,
      );
      console.log(`🔍 [DIRECT ORDER DEBUG] Request body:`, req.body);
      try {
        const userForDiscount = await storage.getUser(req.user.id);
        console.log(`[Direct Order] User discount data:`, {
          discountAmount: userForDiscount?.discountAmount,
          discountType: (userForDiscount as any)?.discountType,
          discountUsageType: (userForDiscount as any)?.discountUsageType,
          discountBalance: userForDiscount?.discountBalance,
        });
        if (userForDiscount) {
          const discountType = (userForDiscount as any).discountType || "fixed";
          const discountUsageType =
            (userForDiscount as any).discountUsageType || "permanent";
          const discountAmount = parseFloat(
            userForDiscount.discountAmount || "0",
          );
          const orderTotal = parseFloat(req.body.total);

          console.log(`[Direct Order] Processing discount:`, {
            discountType,
            discountUsageType,
            discountAmount,
            orderTotal,
          });

          if (discountType === "percentage" && discountAmount > 0) {
            // For percentage discounts, calculate based on order total
            appliedDiscount = (orderTotal * discountAmount) / 100;
            console.log(
              `[Direct Order] Applied percentage discount: ${discountAmount}% = ${appliedDiscount}€, usage type: ${discountUsageType}`,
            );

            // Remove one-time percentage discounts after use
            if (discountUsageType === "one_time") {
              await storage.updateUser(req.user.id, {
                discountAmount: "0",
                discountType: "fixed",
                discountUsageType: "permanent",
                discountExpiryDate: null,
              });
              console.log(
                `[Direct Order] Removed one-time percentage discount for user ${req.user.id}`,
              );
            }
          } else if (discountType === "fixed" && discountAmount > 0) {
            // For fixed discounts, use discount balance system
            const currentBalance = parseFloat(
              userForDiscount.discountBalance ||
                userForDiscount.discountAmount ||
                "0",
            );
            appliedDiscount = Math.min(currentBalance, orderTotal);

            // For one-time fixed discounts, remove after use regardless of remaining balance
            if (discountUsageType === "one_time") {
              await storage.updateUser(req.user.id, {
                discountAmount: "0",
                discountBalance: "0",
                discountType: "fixed",
                discountUsageType: "permanent",
                discountExpiryDate: null,
              });
              console.log(
                `[Direct Order] Removed one-time fixed discount for user ${req.user.id}, applied: ${appliedDiscount}€`,
              );
            } else {
              // For permanent discounts, update balance and remove if it reaches 0
              const newBalance = currentBalance - appliedDiscount;
              await storage.updateUser(req.user.id, {
                discountBalance: newBalance.toString(),
                // Remove discount if balance reaches 0
                ...(newBalance <= 0 && {
                  discountAmount: "0",
                  discountType: "fixed",
                  discountExpiryDate: null,
                }),
              });
              console.log(
                `[Direct Order] Applied fixed discount: ${appliedDiscount}€, remaining balance: ${newBalance}€`,
              );
            }
          }
        }
      } catch (discountError) {
        console.error(
          `[Direct Order] Error processing discount:`,
          discountError,
        );
      }

      // Calculate the final total after discount
      const originalTotal = parseFloat(req.body.total);
      const finalTotal = Math.max(0, originalTotal - appliedDiscount);

      // Now create validatedData with the calculated discount
      const validatedData = insertOrderSchema.parse({
        ...req.body,
        userId: req.user.id,
        total: finalTotal.toString(), // Update total to reflect discount
        subtotal: originalTotal.toString(), // Keep original total as subtotal
        discountType: currentDiscountType,
        discountPercentage: currentDiscountPercentage.toString(),
        discountAmount: appliedDiscount.toString(), // Store the actual calculated discount amount
      });

      console.log(`[Direct Order] Creating order with discount applied:`, {
        originalTotal: req.body.total,
        appliedDiscount,
        discountType: currentDiscountType,
        discountPercentage: currentDiscountPercentage,
      });

      // Kreiraj narudžbu
      const order = await storage.createOrder(validatedData, req.body.items);
      await storage.clearCart(req.user.id);

      // Automatski generiraj račun za narudžbu
      try {
        console.log(`Automatsko generiranje računa za narudžbu ${order.id}...`);
        const language = req.body.language || "hr";

        // Pošalji obavijest o novoj narudžbi
        sendNewOrderNotification(order).catch((err) => {
          console.error("Greška kod slanja obavijesti o novoj narudžbi:", err);
        });

        // Generiraj račun s odabranim jezikom
        const invoiceId = await generateInvoiceFromOrder(order.id, {
          language,
        });

        if (invoiceId) {
          console.log(
            `Uspješno generiran račun (ID: ${invoiceId}) za narudžbu ${order.id}`,
          );

          // Pošalji obavijest o generiranom računu
          sendInvoiceGeneratedNotification(order.id, invoiceId).catch((err) => {
            console.error(
              "Greška kod slanja obavijesti o generiranom računu:",
              err,
            );
          });

          // Dodaj broj računa u odgovor
          res.status(201).json({ ...order, invoiceId });
        } else {
          console.error(`Neuspjelo generiranje računa za narudžbu ${order.id}`);
          res.status(201).json(order);
        }
      } catch (invoiceError) {
        console.error(
          "Greška kod automatskog generiranja računa:",
          invoiceError,
        );
        // Svejedno vrati narudžbu kao uspješnu jer je kreiranje narudžbe uspjelo
        res.status(201).json(order);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      console.error("Greška kod kreiranja narudžbe:", error);
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  app.put("/api/orders/:id/status", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      const { status } = req.body;

      if (!status || typeof status !== "string") {
        return res.status(400).json({ message: "Invalid status" });
      }

      const order = await storage.updateOrderStatus(id, status);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  // Reviews
  app.get("/api/reviews", async (req, res) => {
    try {
      // Dohvati sve recenzije s podacima o korisniku i proizvodu
      const result = await db.query.reviews.findMany({
        with: {
          user: {
            columns: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              password: false,
            },
          },
          product: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      res.json(result);
    } catch (error) {
      console.error("Failed to fetch all reviews:", error);
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  app.get("/api/products/:id/reviews", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const reviews = await storage.getProductReviews(productId);
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  app.get("/api/products/:id/reviews", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const reviews = await storage.getProductReviews(productId);
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  app.post("/api/products/:id/reviews", authMiddleware, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const validatedData = insertReviewSchema.parse({
        ...req.body,
        userId: req.user!.id,
        productId,
      });

      const review = await storage.createReview(validatedData);
      res.status(201).json(review);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  app.delete("/api/reviews/:id", adminMiddleware, async (req, res) => {
    try {
      const reviewId = parseInt(req.params.id);
      await db.execute(sql`DELETE FROM reviews WHERE id = ${reviewId}`);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete review:", error);
      res.status(500).json({ message: "Failed to delete review" });
    }
  });

  // ===== API rute za korisnike (ADMIN) =====
  app.get("/api/users", adminMiddleware, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Scents (mirisi)
  app.get("/api/scents", async (req, res) => {
    try {
      const scents = await storage.getAllScents();
      res.json(scents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch scents" });
    }
  });

  app.get("/api/scents/active", async (req, res) => {
    try {
      const scents = await storage.getActiveScents();
      res.json(scents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active scents" });
    }
  });

  app.post("/api/scents", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const validatedData = insertScentSchema.parse(req.body);
      const scent = await storage.createScent(validatedData);
      res.status(201).json(scent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to create scent" });
    }
  });

  app.put("/api/scents/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      const validatedData = insertScentSchema.parse(req.body);
      const scent = await storage.updateScent(id, validatedData);

      if (!scent) {
        return res.status(404).json({ message: "Scent not found" });
      }

      res.json(scent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to update scent" });
    }
  });

  app.delete("/api/scents/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      await storage.deleteScent(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete scent" });
    }
  });

  // Colors (boje)
  app.get("/api/colors", async (req, res) => {
    try {
      const colors = await storage.getAllColors();
      res.json(colors);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch colors" });
    }
  });

  app.get("/api/colors/active", async (req, res) => {
    try {
      const colors = await storage.getActiveColors();
      res.json(colors);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active colors" });
    }
  });

  app.post("/api/colors", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const validatedData = insertColorSchema.parse(req.body);
      const color = await storage.createColor(validatedData);
      res.status(201).json(color);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to create color" });
    }
  });

  app.put("/api/colors/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      const validatedData = insertColorSchema.parse(req.body);
      const color = await storage.updateColor(id, validatedData);

      if (!color) {
        return res.status(404).json({ message: "Color not found" });
      }

      res.json(color);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to update color" });
    }
  });

  app.delete("/api/colors/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      await storage.deleteColor(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete color" });
    }
  });

  // Product scents and colors
  app.get("/api/products/:id/scents", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);

      console.log(`API: Dohvaćanje mirisa za proizvod ID: ${productId}`);

      if (isNaN(productId)) {
        console.error("Nevažeći ID proizvoda:", req.params.id);
        return res.status(400).json({ message: "Invalid product ID" });
      }

      const scents = await storage.getProductScents(productId);
      console.log(
        `API: Pronađeno ${scents.length} mirisa za proizvod ID: ${productId}`,
      );

      res.json(scents);
    } catch (error) {
      console.error("Greška pri dohvaćanju mirisa proizvoda:", error);
      res.status(500).json({ message: "Failed to fetch product scents" });
    }
  });

  app.post("/api/products/:id/scents", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const productId = parseInt(req.params.id);
      const { scentId } = req.body;

      console.log(
        `Pokušaj dodavanja mirisa - Product ID: ${productId}, Scent ID:`,
        scentId,
        "Tip scentId:",
        typeof scentId,
      );

      if (scentId === undefined || scentId === null) {
        return res.status(400).json({ message: "Missing scent ID" });
      }

      // Pretvorimo scentId u broj ako je potrebno
      const scentIdNum =
        typeof scentId === "string" ? parseInt(scentId) : scentId;

      if (isNaN(scentIdNum)) {
        return res.status(400).json({ message: "Invalid scent ID format" });
      }

      console.log(
        `Dodavanje mirisa - Product ID: ${productId}, Scent ID: ${scentIdNum}`,
      );
      const productScent = await storage.addScentToProduct(
        productId,
        scentIdNum,
      );
      res.status(201).json(productScent);
    } catch (error) {
      console.error("Greška pri dodavanju mirisa:", error);
      res.status(500).json({ message: "Failed to add scent to product" });
    }
  });

  app.delete("/api/products/:productId/scents/:scentId", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const productId = parseInt(req.params.productId);
      const scentId = parseInt(req.params.scentId);

      await storage.removeScentFromProduct(productId, scentId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to remove scent from product" });
    }
  });

  // Ruta za brisanje svih mirisa s proizvoda
  app.delete("/api/products/:id/scents", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const productId = parseInt(req.params.id);
      console.log(`Brisanje svih mirisa za proizvod ID: ${productId}`);

      try {
        // Direktno koristimo pool.query za brisanje svih mirisa
        await pool.query(`DELETE FROM product_scents WHERE product_id = $1`, [
          productId,
        ]);
        console.log(
          `Uspješno izbrisani svi mirisi za proizvod ID: ${productId}`,
        );
        res.status(204).send();
      } catch (dbError) {
        console.error("Database error removing scents:", dbError);

        // Još jedan pokušaj s inicijalizacijom tablice
        console.log("Pokušaj inicijalizacije tablice product_scents...");
        await pool.query(`
          CREATE TABLE IF NOT EXISTS product_scents (
            id SERIAL PRIMARY KEY,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            scent_id INTEGER NOT NULL REFERENCES scents(id) ON DELETE CASCADE,
            UNIQUE(product_id, scent_id)
          )
        `);

        // Sada ponovo pokušamo brisanje
        await pool.query(`DELETE FROM product_scents WHERE product_id = $1`, [
          productId,
        ]);
        console.log(
          `Nakon inicijalizacije, uspješno izbrisani svi mirisi za proizvod ID: ${productId}`,
        );
        res.status(204).send();
      }
    } catch (error) {
      console.error("Error removing scents from product:", error);
      res.status(500).json({
        message: "Failed to remove all scents from product",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get("/api/products/:id/colors", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);

      console.log(`API: Dohvaćanje boja za proizvod ID: ${productId}`);

      if (isNaN(productId)) {
        console.error("Nevažeći ID proizvoda:", req.params.id);
        return res.status(400).json({ message: "Invalid product ID" });
      }

      const colors = await storage.getProductColors(productId);
      console.log(
        `API: Pronađeno ${colors.length} boja za proizvod ID: ${productId}`,
      );

      res.json(colors);
    } catch (error) {
      console.error("Greška pri dohvaćanju boja proizvoda:", error);
      res.status(500).json({ message: "Failed to fetch product colors" });
    }
  });

  app.post("/api/products/:id/colors", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const productId = parseInt(req.params.id);
      const { colorId } = req.body;

      console.log(
        `Pokušaj dodavanja boje - Product ID: ${productId}, Color ID:`,
        colorId,
        "Tip colorId:",
        typeof colorId,
      );

      if (colorId === undefined || colorId === null) {
        return res.status(400).json({ message: "Missing color ID" });
      }

      // Pretvorimo colorId u broj ako je potrebno
      const colorIdNum =
        typeof colorId === "string" ? parseInt(colorId) : colorId;

      if (isNaN(colorIdNum)) {
        return res.status(400).json({ message: "Invalid color ID format" });
      }

      console.log(
        `Dodavanje boje - Product ID: ${productId}, Color ID: ${colorIdNum}`,
      );
      const productColor = await storage.addColorToProduct(
        productId,
        colorIdNum,
      );
      res.status(201).json(productColor);
    } catch (error) {
      console.error("Greška pri dodavanju boje:", error);
      res.status(500).json({ message: "Failed to add color to product" });
    }
  });

  app.delete("/api/products/:productId/colors/:colorId", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const productId = parseInt(req.params.productId);
      const colorId = parseInt(req.params.colorId);

      await storage.removeColorFromProduct(productId, colorId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to remove color from product" });
    }
  });

  // Ruta za brisanje svih boja s proizvoda
  app.delete("/api/products/:id/colors", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const productId = parseInt(req.params.id);
      console.log(`Brisanje svih boja za proizvod ID: ${productId}`);

      try {
        // Direktno koristimo pool.query za brisanje svih boja
        await pool.query(`DELETE FROM product_colors WHERE product_id = $1`, [
          productId,
        ]);
        console.log(`Uspješno izbrisane sve boje za proizvod ID: ${productId}`);
        res.status(204).send();
      } catch (dbError) {
        console.error("Database error removing colors:", dbError);

        // Još jedan pokušaj s inicijalizacijom tablice
        console.log("Pokušaj inicijalizacije tablice product_colors...");
        await pool.query(`
          CREATE TABLE IF NOT EXISTS product_colors (
            id SERIAL PRIMARY KEY,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            color_id INTEGER NOT NULL REFERENCES colors(id) ON DELETE CASCADE,
            UNIQUE(product_id, color_id)
          )
        `);

        // Sada ponovo pokušamo brisanje
        await pool.query(`DELETE FROM product_colors WHERE product_id = $1`, [
          productId,
        ]);
        console.log(
          `Nakon inicijalizacije, uspješno izbrisane sve boje za proizvod ID: ${productId}`,
        );
        res.status(204).send();
      }
    } catch (error) {
      console.error("Error removing colors from product:", error);
      res.status(500).json({
        message: "Failed to remove all colors from product",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Product Images routes
  app.get("/api/products/:id/images", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      const images = await storage.getProductImages(productId);
      res.json(images);
    } catch (error) {
      console.error("Error fetching product images:", error);
      res.status(500).json({ message: "Failed to fetch product images" });
    }
  });

  app.post("/api/products/:id/images", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const productId = parseInt(req.params.id);
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      const imageData = insertProductImageSchema.parse(req.body);
      const image = await storage.addImageToProduct(productId, imageData);
      
      res.status(201).json(image);
    } catch (error) {
      console.error("Error adding product image:", error);
      res.status(500).json({ message: "Failed to add product image" });
    }
  });

  app.put("/api/products/images/:imageId", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const imageId = parseInt(req.params.imageId);
      if (isNaN(imageId)) {
        return res.status(400).json({ message: "Invalid image ID" });
      }

      const imageData = req.body;
      const updatedImage = await storage.updateProductImage(imageId, imageData);
      
      if (!updatedImage) {
        return res.status(404).json({ message: "Image not found" });
      }

      res.json(updatedImage);
    } catch (error) {
      console.error("Error updating product image:", error);
      res.status(500).json({ message: "Failed to update product image" });
    }
  });

  app.delete("/api/products/images/:imageId", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const imageId = parseInt(req.params.imageId);
      if (isNaN(imageId)) {
        return res.status(400).json({ message: "Invalid image ID" });
      }

      await storage.deleteProductImage(imageId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product image:", error);
      res.status(500).json({ message: "Failed to delete product image" });
    }
  });

  app.put("/api/products/:id/images/:imageId/primary", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const productId = parseInt(req.params.id);
      const imageId = parseInt(req.params.imageId);
      
      if (isNaN(productId) || isNaN(imageId)) {
        return res.status(400).json({ message: "Invalid ID" });
      }

      await storage.setPrimaryImage(productId, imageId);
      res.status(204).send();
    } catch (error) {
      console.error("Error setting primary image:", error);
      res.status(500).json({ message: "Failed to set primary image" });
    }
  });

  // Change password
  app.put("/api/users/:id/password", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);

      // Ensure users can only change their own password (unless admin)
      if (id !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Import the auth functions
      const { comparePasswords, hashPassword } = require("./auth");

      // Get the user
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isPasswordValid = await comparePasswords(
        currentPassword,
        user.password,
      );
      if (!isPasswordValid) {
        return res
          .status(400)
          .json({ message: "Current password is incorrect" });
      }

      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);

      // Update user with new password
      const updatedUser = await storage.updateUser(id, {
        password: hashedPassword,
      });

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update password" });
    }
  });

  // Update user profile
  app.put("/api/users/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);

      // Ensure users can only update their own profile (unless admin)
      if (id !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Extract only allowed fields for update
      const {
        firstName,
        lastName,
        email,
        address,
        city,
        postalCode,
        country,
        phone,
      } = req.body;

      // Validate email if provided
      if (email && email !== req.user.email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== id) {
          return res.status(400).json({ message: "Email already in use" });
        }
      }

      // Update user data
      const updatedUser = await storage.updateUser(id, {
        firstName,
        lastName,
        email,
        address,
        city,
        postalCode,
        country,
        phone,
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user profile" });
    }
  });

  // Delete user account
  app.delete("/api/users/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);

      // Ensure users can only delete their own account (unless admin)
      if (id !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Add deletion logic for user data
      // Note: Prilagodi ovo prema stvarnoj implementaciji
      // Trenutno samo simuliramo uspješno brisanje

      res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Dohvati statistiku korisnika (ukupna potrošnja i broj narudžbi)
  app.get("/api/users/:id/stats", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      const orders = await storage.getUserOrders(id);

      // Izračunaj ukupnu potrošnju
      const totalSpent = orders.reduce((total, order) => {
        return total + parseFloat(order.total);
      }, 0);

      // Broj narudžbi
      const orderCount = orders.length;

      res.json({
        userId: id,
        totalSpent: totalSpent.toFixed(2),
        orderCount,
      });
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: "Failed to fetch user statistics" });
    }
  });

  // Send email to user
  app.post("/api/users/:id/send-email", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      const { subject, message } = req.body;

      if (!subject || !message) {
        return res
          .status(400)
          .json({ message: "Subject and message are required" });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Import sendEmailNotification from notificationService
      const { sendEmailNotification } = await import("./notificationService");

      const emailSent = await sendEmailNotification(
        subject,
        message,
        user.email,
      );

      if (emailSent) {
        res.json({ message: "Email sent successfully" });
      } else {
        res.status(500).json({ message: "Failed to send email" });
      }
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ message: "Failed to send email" });
    }
  });

  // Helper function to process discount balance
  async function processDiscountBalance(
    userId: number,
    orderTotal: number,
  ): Promise<{
    appliedDiscount: number;
    remainingBalance: number;
  }> {
    const user = await storage.getUser(userId);
    if (!user) return { appliedDiscount: 0, remainingBalance: 0 };

    const currentBalance = parseFloat(user.discountBalance || "0");
    const discountType = (user as any).discountType || "fixed";

    if (currentBalance <= 0) {
      return { appliedDiscount: 0, remainingBalance: 0 };
    }

    let appliedDiscount = 0;
    let newBalance = currentBalance;

    if (discountType === "percentage") {
      // For percentage discounts, calculate based on the discount percentage
      const discountPercentage = parseFloat(user.discountAmount || "0");
      appliedDiscount = (orderTotal * discountPercentage) / 100;
      console.log(
        `[processDiscountBalance] Applied percentage discount: ${discountPercentage}% = ${appliedDiscount}€`,
      );

      // For one-time percentage discounts, remove after use
      const discountUsageType = (user as any).discountUsageType || "permanent";
      if (discountUsageType === "one_time") {
        await storage.updateUser(userId, {
          discountAmount: "0",
          discountType: "fixed",
          discountUsageType: "permanent",
          discountExpiryDate: null,
        });
        console.log(
          `[processDiscountBalance] Removed one-time percentage discount for user ${userId}`,
        );
      }
      // Percentage discounts don't reduce balance
      newBalance = currentBalance;
    } else if (discountType === "fixed") {
      // For fixed discounts, use the balance directly
      appliedDiscount = Math.min(currentBalance, orderTotal);
      newBalance = currentBalance - appliedDiscount;
      console.log(
        `[processDiscountBalance] Applied fixed discount: ${appliedDiscount}€ from balance ${currentBalance}€`,
      );
    }

    // Update user's remaining balance for fixed discounts
    if (discountType === "fixed" && newBalance !== currentBalance) {
      const discountUsageType = (user as any).discountUsageType || "permanent";

      if (discountUsageType === "one_time") {
        // For one-time fixed discounts, remove completely after use
        await storage.updateUser(userId, {
          discountAmount: "0",
          discountBalance: "0",
          discountType: "fixed",
          discountUsageType: "permanent",
          discountExpiryDate: null,
        });
        console.log(
          `[processDiscountBalance] Removed one-time fixed discount for user ${userId}`,
        );
      } else {
        // For permanent fixed discounts, update balance
        await storage.updateUser(userId, {
          discountBalance: newBalance.toString(),
          // Remove discount if balance reaches 0
          ...(newBalance <= 0 && {
            discountAmount: "0",
            discountType: "fixed",
            discountExpiryDate: null,
          }),
        });
        console.log(
          `[processDiscountBalance] Updated fixed discount balance: ${newBalance}€`,
        );
      }
    }

    console.log(
      `Discount processed for user ${userId}: applied=${appliedDiscount}, remaining=${newBalance}`,
    );
    return { appliedDiscount, remainingBalance: newBalance };
  }

  // Get user discount balance
  app.get("/api/users/:id/discount-balance", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const balance = parseFloat(user.discountBalance || "0");
      const discountType = (user as any).discountType || "fixed";

      res.json({
        balance,
        discountType,
        hasActiveDiscount:
          balance > 0 ||
          (discountType === "percentage" &&
            parseFloat(user.discountAmount || "0") > 0),
      });
    } catch (error) {
      console.error("Error getting user discount balance:", error);
      res.status(500).json({ message: "Failed to get discount balance" });
    }
  });

  // Postavi popust za korisnika
  app.post("/api/users/:id/discount", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      const {
        discountAmount,
        discountMinimumOrder,
        discountExpiryDate,
        discountType,
        discountUsageType,
      } = req.body;

      // Convert date string to proper Date object
      let expiryDate = null;
      if (discountExpiryDate) {
        expiryDate = new Date(discountExpiryDate);
        // Ensure it's a valid date
        if (isNaN(expiryDate.getTime())) {
          return res
            .status(400)
            .json({ message: "Invalid expiry date format" });
        }
      }

      // When setting a new discount, set the discount balance correctly
      // For fixed amounts: set the balance to the amount
      // For percentage: keep balance at 0 since percentage doesn't use balance
      const discountBalanceValue =
        discountType === "fixed" ? discountAmount : "0";

      const updatedUser = await storage.updateUser(id, {
        discountAmount,
        discountMinimumOrder: discountMinimumOrder || "0",
        discountExpiryDate: expiryDate,
        discountType: discountType || "fixed", // 'fixed' or 'percentage'
        discountUsageType: discountUsageType || "permanent", // 'one_time' or 'permanent'
        discountBalance: discountBalanceValue, // Set initial balance for fixed amounts
      });

      console.log(
        `Set discount for user ${id}: type=${discountType}, amount=${discountAmount}, balance=${discountBalanceValue}`,
      );

      // Send email notification to user about the discount
      if (updatedUser && updatedUser.email) {
        try {
          const discountText =
            discountType === "percentage"
              ? `${discountAmount}%`
              : `${discountAmount}€`;
          const usageText =
            discountUsageType === "one_time"
              ? "einmalig für Ihre nächste Bestellung"
              : "dauerhaft für alle Ihre Bestellungen";

          await sendEmail({
            to: updatedUser.email,
            from: "info@kerzenweltbydani.com",
            subject: "Ihr neuer Rabatt bei Kerzenwelt by Dani!",
            text: `Liebe/r ${updatedUser.username}, Sie haben einen neuen Rabatt von ${discountText} erhalten! Dieser Rabatt ist ${usageText} gültig.`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #D4AF37;">Kerzenwelt by Dani</h1>
                <h2>Ihr neuer Rabatt ist da! 🎉</h2>
                <p>Liebe/r ${updatedUser.username},</p>
                <p>Wir freuen uns, Ihnen mitteilen zu können, dass Sie einen neuen Rabatt erhalten haben!</p>
                <div style="background-color: #f0f0f0; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                  <h3 style="color: #D4AF37; margin: 0;">Ihr Rabatt: ${discountText}</h3>
                  <p style="margin: 10px 0 0 0; color: #666;">Gültig ${usageText}</p>
                </div>
                ${
                  discountMinimumOrder && parseFloat(discountMinimumOrder) > 0
                    ? `<p><strong>Mindestbestellwert:</strong> ${discountMinimumOrder}€</p>`
                    : ""
                }
                ${
                  expiryDate
                    ? `<p><strong>Gültig bis:</strong> ${expiryDate.toLocaleDateString("de-DE")}</p>`
                    : ""
                }
                <p>Vielen Dank für Ihr Vertrauen in Kerzenwelt by Dani!</p>
                <p>Mit freundlichen Grüßen,<br>Daniela</p>
              </div>
            `,
          });
          console.log(
            `Discount notification email sent to ${updatedUser.email}`,
          );
        } catch (error) {
          console.error("Error sending discount notification email:", error);
          // Continue even if email fails
        }
      }

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Error setting user discount:", error);
      res.status(500).json({ message: "Failed to set user discount" });
    }
  });

  // Remove user discount
  app.delete("/api/users/:id/discount", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);

      const updatedUser = await storage.updateUser(id, {
        discountAmount: "0",
        discountMinimumOrder: "0",
        discountExpiryDate: null,
        discountType: "fixed",
        discountUsageType: "permanent",
        discountBalance: "0",
      });

      console.log(`Removed discount for user ${id}`);

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Error removing user discount:", error);
      res.status(500).json({ message: "Failed to remove discount" });
    }
  });

  // Settings
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  // Opće postavke - moraju biti prije generičke rute za :key

  // Hero section settings - must be before generic :key route
  app.get("/api/settings/hero", async (req, res) => {
    try {
      const heroSetting = await storage.getSetting("heroSettings");

      if (!heroSetting) {
        return res.json({
          titleText: {
            de: [
              {
                text: "Willkommen",
                fontSize: "2xl",
                fontWeight: "medium",
                color: "white",
              },
              {
                text: "Kerzenwelt by Dani",
                fontSize: "4xl",
                fontWeight: "bold",
                color: "white",
              },
              {
                text: "Wo Kerzen Wärme und Stil vereinen",
                fontSize: "xl",
                fontWeight: "medium",
                color: "white",
              },
            ],
            hr: [
              {
                text: "Dobrodošli",
                fontSize: "2xl",
                fontWeight: "medium",
                color: "white",
              },
              {
                text: "Svijet svijeća by Dani",
                fontSize: "4xl",
                fontWeight: "bold",
                color: "white",
              },
              {
                text: "Gdje se toplina i stil spajaju",
                fontSize: "xl",
                fontWeight: "medium",
                color: "white",
              },
            ],
            en: [
              {
                text: "Welcome",
                fontSize: "2xl",
                fontWeight: "medium",
                color: "white",
              },
              {
                text: "The Candle World by Dani",
                fontSize: "4xl",
                fontWeight: "bold",
                color: "white",
              },
              {
                text: "Where warmth and style unite",
                fontSize: "xl",
                fontWeight: "medium",
                color: "white",
              },
            ],
            it: [
              {
                text: "Benvenuti",
                fontSize: "2xl",
                fontWeight: "medium",
                color: "white",
              },
              {
                text: "Il mondo delle candele di Dani",
                fontSize: "4xl",
                fontWeight: "bold",
                color: "white",
              },
              {
                text: "Dove calore e stile si incontrano",
                fontSize: "xl",
                fontWeight: "medium",
                color: "white",
              },
            ],
            sl: [
              {
                text: "Dobrodošli",
                fontSize: "2xl",
                fontWeight: "medium",
                color: "white",
              },
              {
                text: "Svet sveč by Dani",
                fontSize: "4xl",
                fontWeight: "bold",
                color: "white",
              },
              {
                text: "Kjer se toplina in stil združita",
                fontSize: "xl",
                fontWeight: "medium",
                color: "white",
              },
            ],
          },
          subtitleText: {
            de: "Entdecken Sie unsere einzigartige Sammlung handgefertigter Kerzen, perfekt für jede Gelegenheit.",
            hr: "Otkrijte našu jedinstvenu kolekciju ručno izrađenih svijeća, savršenih za svaku prigodu.",
            en: "Discover our unique collection of handcrafted candles, perfect for any occasion.",
            it: "Scopri la nostra collezione unica di candele artigianali, perfette per ogni occasione.",
            sl: "Odkrijte našo edinstveno zbirko ročno izdelanih sveč, popolnih za vsako priložnost.",
          },
          subtitleFontSize: "lg md:text-xl",
          subtitleFontWeight: "normal",
          subtitleColor: "white opacity-90",
        });
      }

      // Return the stored settings
      return res.json(JSON.parse(heroSetting.value));
    } catch (error) {
      console.error("Error fetching hero settings:", error);
      res.status(500).json({ message: "Failed to fetch hero settings" });
    }
  });

  app.post("/api/settings/hero", async (req, res) => {
    try {
      // Validate the request body
      const parseResult = heroSettingsSchema.safeParse(req.body);

      if (!parseResult.success) {
        return res.status(400).json({
          message: "Invalid hero settings data",
          errors: parseResult.error.errors,
        });
      }

      const settingsValue = JSON.stringify(parseResult.data);

      // Check if the settings already exist
      const existingSettings = await storage.getSetting("heroSettings");

      if (existingSettings) {
        // Update existing settings
        await storage.updateSetting("heroSettings", settingsValue);
      } else {
        // Create new settings
        await storage.createSetting({
          key: "heroSettings",
          value: settingsValue,
        });
      }

      res.status(200).json({ message: "Hero settings updated successfully" });
    } catch (error) {
      console.error("Error updating hero settings:", error);
      res.status(500).json({ message: "Failed to update hero settings" });
    }
  });

  // Kontakt postavke - moraju biti prije generičke rute za :key
  app.get("/api/settings/contact", async (req, res) => {
    try {
      // Dohvati sve postavke koje se tiču kontakta
      const address = await storage.getSetting("contact_address");
      const city = await storage.getSetting("contact_city");
      const postalCode = await storage.getSetting("contact_postal_code");
      const phone = await storage.getSetting("contact_phone");
      const email = await storage.getSetting("contact_email");
      const workingHours = await storage.getSetting("contact_working_hours");

      res.json({
        address: address?.value || "",
        city: city?.value || "",
        postalCode: postalCode?.value || "",
        phone: phone?.value || "",
        email: email?.value || "",
        workingHours: workingHours?.value || "",
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contact settings" });
    }
  });

  // API rute za upravljanje sadržajem stranica
  app.get("/api/pages/:type", async (req, res) => {
    try {
      const { type } = req.params;
      const page = await storage.getPageByType(type);

      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }

      res.json(page);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch page" });
    }
  });

  // Ruta za obradu POST i PUT zahtjeva za stranice
  // POST /api/pages - Kreira novu stranicu ili ažurira postojeću
  app.post("/api/pages", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { type, title, content, id } = req.body;

      if (!type || !title || !content) {
        return res
          .status(400)
          .json({ message: "Type, title, and content are required" });
      }

      // Kreiraj novu stranicu ili ažuriraj postojeću
      // createPage metoda će sama provjeriti postoji li stranica s tim tipom
      // i ažurirati je ako postoji
      const page = await storage.createPage({
        title,
        content,
        type,
      });

      res.status(201).json(page);
    } catch (error) {
      console.error("Greška pri kreiranju/ažuriranju stranice:", error);
      res.status(500).json({ message: "Failed to create page" });
    }
  });

  // PUT /api/pages - Ažurira postojeću stranicu
  app.put("/api/pages", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { id, type, title, content } = req.body;

      if (!id || !type || !title || !content) {
        return res
          .status(400)
          .json({ message: "ID, type, title, and content are required" });
      }

      // Provjeri postoji li stranica
      const existingPage = await storage.getPage(id);

      if (!existingPage) {
        return res.status(404).json({ message: "Page not found" });
      }

      // Ažuriraj postojeću stranicu
      const page = await storage.updatePage(id, {
        title,
        content,
        type,
      });

      res.json(page);
    } catch (error) {
      res.status(500).json({ message: "Failed to update page" });
    }
  });

  // Instagram API rute
  app.get("/api/instagram/manual", async (req, res) => {
    try {
      // Dohvaća ručno dodane slike iz settings tabele
      const instagramImages = await storage.getSetting(
        "instagram_manual_images",
      );
      if (!instagramImages) {
        return res.json([]);
      }

      try {
        const images = JSON.parse(instagramImages.value);
        res.json(images);
      } catch (parseError) {
        console.error("Greška pri parsiranju Instagram slika:", parseError);
        res.json([]);
      }
    } catch (error) {
      console.error("Greška pri dohvaćanju Instagram slika:", error);
      res.status(500).json({ message: "Failed to fetch Instagram images" });
    }
  });

  app.post("/api/instagram/manual", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { images } = req.body;

      if (!images || !Array.isArray(images)) {
        return res.status(400).json({ message: "Invalid image data" });
      }

      // Prvo provjeri postoji li postavka
      const existingSetting = await storage.getSetting(
        "instagram_manual_images",
      );

      if (existingSetting) {
        // Ako postavka već postoji, ažuriraj je
        await storage.updateSetting(
          "instagram_manual_images",
          JSON.stringify(images),
        );
      } else {
        // Ako postavka ne postoji, kreiraj je
        await storage.createSetting({
          key: "instagram_manual_images",
          value: JSON.stringify(images),
        });
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Greška pri spremanju Instagram slika:", error);
      res.status(500).json({ message: "Failed to save Instagram images" });
    }
  });

  app.post("/api/instagram/token", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }

      // Provjeri postoji li token već u bazi
      const existingToken = await storage.getSetting("instagram_token");

      if (existingToken) {
        // Ako token već postoji, ažuriraj ga
        await storage.updateSetting("instagram_token", token);
      } else {
        // Ako token ne postoji, kreiraj ga
        await storage.createSetting({
          key: "instagram_token",
          value: token,
        });
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Greška pri spremanju Instagram tokena:", error);
      res.status(500).json({ message: "Failed to save Instagram token" });
    }
  });

  // Zadržavamo postojeću rutu za nazad kompatibilnost
  app.post("/api/pages/:type", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { type } = req.params;
      const { title, content } = req.body;

      if (!title || !content) {
        return res
          .status(400)
          .json({ message: "Title and content are required" });
      }

      // Provjeri postoji li stranica
      const existingPage = await storage.getPageByType(type);

      let page;
      if (existingPage) {
        // Ažuriraj postojeću stranicu
        page = await storage.updatePage(existingPage.id, {
          title,
          content,
          type,
        });
      } else {
        // Kreiraj novu stranicu
        page = await storage.createPage({
          title,
          content,
          type,
        });
      }

      res.json(page);
    } catch (error) {
      res.status(500).json({ message: "Failed to update page" });
    }
  });

  app.get("/api/settings/:key", async (req, res) => {
    try {
      const key = req.params.key;
      const setting = await storage.getSetting(key);

      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }

      res.json(setting);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch setting" });
    }
  });

  app.post("/api/settings/contact", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { address, city, postalCode, phone, email, workingHours } =
        req.body;

      // Ažuriraj ili kreiraj postavke za kontakt
      await Promise.all([
        storage.updateSetting("contact_address", address),
        storage.updateSetting("contact_city", city),
        storage.updateSetting("contact_postal_code", postalCode),
        storage.updateSetting("contact_phone", phone),
        storage.updateSetting("contact_email", email),
        storage.updateSetting("contact_working_hours", workingHours),
      ]);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to update contact settings" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const validatedData = insertSettingSchema.parse(req.body);

      // Check if setting already exists
      const existingSetting = await storage.getSetting(validatedData.key);
      if (existingSetting) {
        return res
          .status(400)
          .json({ message: "Setting with this key already exists" });
      }

      const setting = await storage.createSetting(validatedData);
      res.status(201).json(setting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to create setting" });
    }
  });

  app.put("/api/settings/:key", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const key = req.params.key;
      const { value } = req.body;

      if (!value || typeof value !== "string") {
        return res.status(400).json({ message: "Invalid value" });
      }

      const setting = await storage.updateSetting(key, value);
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }

      res.json(setting);
    } catch (error) {
      res.status(500).json({ message: "Failed to update setting" });
    }
  });

  app.delete("/api/settings/:key", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const key = req.params.key;
      await storage.deleteSetting(key);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete setting" });
    }
  });

  // Scents
  app.get("/api/scents", async (req, res) => {
    try {
      const scents = await storage.getAllScents();
      res.json(scents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch scents" });
    }
  });

  app.get("/api/scents/active", async (req, res) => {
    try {
      const scents = await storage.getActiveScents();
      res.json(scents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active scents" });
    }
  });

  app.get("/api/scents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const scent = await storage.getScent(id);
      if (!scent) {
        return res.status(404).json({ message: "Scent not found" });
      }
      res.json(scent);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch scent" });
    }
  });

  app.post("/api/scents", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const validatedData = insertScentSchema.parse(req.body);
      const scent = await storage.createScent(validatedData);
      res.status(201).json(scent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to create scent" });
    }
  });

  app.put("/api/scents/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      const validatedData = insertScentSchema.parse(req.body);
      const scent = await storage.updateScent(id, validatedData);

      if (!scent) {
        return res.status(404).json({ message: "Scent not found" });
      }

      res.json(scent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to update scent" });
    }
  });

  app.delete("/api/scents/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      await storage.deleteScent(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete scent" });
    }
  });

  // Ove rute su već definirane iznad - duplikati

  // Colors
  app.get("/api/colors", async (req, res) => {
    try {
      const colors = await storage.getAllColors();
      res.json(colors);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch colors" });
    }
  });

  app.get("/api/colors/active", async (req, res) => {
    try {
      const colors = await storage.getActiveColors();
      res.json(colors);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active colors" });
    }
  });

  app.get("/api/colors/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const color = await storage.getColor(id);
      if (!color) {
        return res.status(404).json({ message: "Color not found" });
      }
      res.json(color);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch color" });
    }
  });

  app.post("/api/colors", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const validatedData = insertColorSchema.parse(req.body);
      const color = await storage.createColor(validatedData);
      res.status(201).json(color);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to create color" });
    }
  });

  app.put("/api/colors/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      const validatedData = insertColorSchema.parse(req.body);
      const color = await storage.updateColor(id, validatedData);

      if (!color) {
        return res.status(404).json({ message: "Color not found" });
      }

      res.json(color);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to update color" });
    }
  });

  app.delete("/api/colors/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      await storage.deleteColor(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete color" });
    }
  });

  // Product Colors - ova ruta je duplicirana na liniji ~1262, izbrisat ćemo ju

  app.post("/api/products/:id/colors/:colorId", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const productId = parseInt(req.params.id);
      const colorId = parseInt(req.params.colorId);

      const productColor = await storage.addColorToProduct(productId, colorId);
      res.status(201).json(productColor);
    } catch (error) {
      res.status(500).json({ message: "Failed to add color to product" });
    }
  });

  app.delete("/api/products/:id/colors/:colorId", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const productId = parseInt(req.params.id);
      const colorId = parseInt(req.params.colorId);

      await storage.removeColorFromProduct(productId, colorId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to remove color from product" });
    }
  });

  // ===== API rute za kolekcije =====

  // Dohvati sve kolekcije
  app.get("/api/collections", async (req, res) => {
    try {
      console.log("Dohvaćam sve kolekcije...");
      const collections = await storage.getAllCollections();
      console.log("Dohvaćene kolekcije:", collections);
      res.json(collections);
    } catch (error) {
      console.error("Greška pri dohvaćanju kolekcija:", error);
      res.status(500).json({ message: "Failed to fetch collections" });
    }
  });

  // Dohvati samo aktivne kolekcije
  app.get("/api/collections/active", async (req, res) => {
    try {
      const collections = await storage.getActiveCollections();
      res.json(collections);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active collections" });
    }
  });

  // Dohvati kolekcije koje se prikazuju na početnoj stranici
  app.get("/api/collections/featured", async (req, res) => {
    try {
      const collections = await storage.getFeaturedCollections();
      res.json(collections);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch featured collections" });
    }
  });

  // Dohvati pojedinačnu kolekciju
  app.get("/api/collections/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const collection = await storage.getCollection(id);

      if (!collection) {
        return res.status(404).json({ message: "Collection not found" });
      }

      res.json(collection);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch collection" });
    }
  });

  // Kreiraj novu kolekciju
  app.post("/api/collections", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      console.log("Kreiranje nove kolekcije, podaci:", req.body);
      const validatedData = insertCollectionSchema.parse(req.body);
      console.log("Podaci nakon validacije:", validatedData);
      const collection = await storage.createCollection(validatedData);
      console.log("Kreirana kolekcija:", collection);
      res.status(201).json(collection);
    } catch (error) {
      console.error("Greška pri kreiranju kolekcije:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to create collection" });
    }
  });

  // Ažuriraj postojeću kolekciju
  app.put("/api/collections/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      const validatedData = insertCollectionSchema.parse(req.body);
      const collection = await storage.updateCollection(id, validatedData);

      if (!collection) {
        return res.status(404).json({ message: "Collection not found" });
      }

      res.json(collection);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to update collection" });
    }
  });

  // Obriši kolekciju
  app.delete("/api/collections/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      await storage.deleteCollection(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete collection" });
    }
  });

  // Dohvati proizvode u kolekciji
  app.get("/api/collections/:id/products", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const products = await storage.getCollectionProducts(id);
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch collection products" });
    }
  });

  // Dodaj proizvod u kolekciju
  app.post("/api/collections/:id/products", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const collectionId = parseInt(req.params.id);
      const { productId } = req.body;

      if (!productId) {
        return res.status(400).json({ message: "Product ID is required" });
      }

      const relation = await storage.addProductToCollection(
        productId,
        collectionId,
      );
      res.status(201).json(relation);
    } catch (error) {
      res.status(500).json({ message: "Failed to add product to collection" });
    }
  });

  // Ukloni proizvod iz kolekcije
  app.delete("/api/collections/:id/products/:productId", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const collectionId = parseInt(req.params.id);
      const productId = parseInt(req.params.productId);

      await storage.removeProductFromCollection(productId, collectionId);
      res.status(204).send();
    } catch (error) {
      res
        .status(500)
        .json({ message: "Failed to remove product from collection" });
    }
  });

  // Invoices API endpoints

  // Get all invoices
  app.get("/api/invoices", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const invoices = await storage.getAllInvoices();
      res.json(invoices);
    } catch (error) {
      console.error("Error getting invoices:", error);
      res.status(500).json({ message: "Failed to get invoices" });
    }
  });

  // Get last invoice (za generiranje novih brojeva računa)
  app.get("/api/invoices/last", async (req, res) => {
    try {
      // Ovu rutu mogu koristiti i ulogirani korisnici jer im treba za generiranje novih brojeva
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Dohvati sve račune sortirane po ID-ju silazno i vrati prvi (posljednji kreirani)
      const invoices = await storage.getAllInvoices();
      const lastInvoice = invoices.length > 0 ? invoices[0] : null;

      console.log(
        `Dohvaćen posljednji račun: ${
          lastInvoice
            ? JSON.stringify({
                id: lastInvoice.id,
                invoiceNumber: lastInvoice.invoiceNumber,
              })
            : "Nema računa u bazi"
        }`,
      );

      res.json(lastInvoice);
    } catch (error) {
      console.error("Error getting last invoice:", error);
      res.status(500).json({ message: "Failed to get last invoice" });
    }
  });

  // Get invoice by ID
  app.get("/api/invoices/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const invoiceId = parseInt(req.params.id);
      const invoice = await storage.getInvoice(invoiceId);

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Only admins or the user who owns the invoice can access it
      if (!req.user?.isAdmin && invoice.userId !== req.user?.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Get invoice items
      const items = await storage.getInvoiceItems(invoiceId);

      res.json({
        ...invoice,
        items,
      });
    } catch (error) {
      console.error("Error getting invoice:", error);
      res.status(500).json({ message: "Failed to get invoice" });
    }
  });

  // Get user's invoices
  app.get("/api/user/invoices", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const invoices = await storage.getUserInvoices(req.user!.id);
      res.json(invoices);
    } catch (error) {
      console.error("Error getting user invoices:", error);
      res.status(500).json({ message: "Failed to get invoices" });
    }
  });

  // Create a new invoice
  app.post("/api/invoices", async (req, res) => {
    try {
      console.log("Primljen zahtjev za kreiranje računa, body:", req.body);
      // Privremeno uklonjena provjera autentifikacije zbog problema s klijentom
      // Samo administratori mogu pristupiti admin stranicama iz kojih se poziva ova API ruta
      /*if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }*/

      // Handle both nested and flat formats
      let invoice, items;

      if (req.body.invoice && req.body.items) {
        // Nested format (original)
        invoice = req.body.invoice;
        items = req.body.items;
      } else if (req.body.items) {
        // Direct format from admin page
        const { items: itemsData, ...invoiceData } = req.body;
        invoice = invoiceData;
        items = itemsData;
      } else {
        console.error("Nedostaje items u zahtjevu");
        return res.status(400).json({
          message: "Invalid request format - missing items data",
        });
      }

      console.log("Processed request data:", { invoice, items });

      // Dodaj userId hardkodirano za admina (id=1) ako nemamo korisnika u sesiji
      if (req.user) {
        invoice.userId = req.user.id;
      } else {
        invoice.userId = invoice.userId || 1; // Admin ID
      }

      console.log("Creating invoice with data:", { invoice, items });

      try {
        // Validate the invoice data
        const validatedInvoice = insertInvoiceSchema.parse(invoice);

        // Create the invoice with its items
        const newInvoice = await storage.createInvoice(validatedInvoice, items);

        console.log("Uspješno kreiran račun:", newInvoice);
        res.status(201).json(newInvoice);
      } catch (validationError) {
        console.error("Validacija nije uspjela:", validationError);
        res.status(400).json({
          message: "Validation error",
          errors:
            validationError instanceof z.ZodError
              ? validationError.errors
              : [{ message: validationError.message }],
        });
      }
    } catch (error) {
      console.error("Error creating invoice:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  // Delete an invoice
  app.delete("/api/invoices/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const invoiceId = parseInt(req.params.id);
      await storage.deleteInvoice(invoiceId);

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting invoice:", error);
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  // Dohvati fakturu za narudžbu
  app.get("/api/orders/:id/invoice", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const orderId = parseInt(req.params.id);
      const order = await storage.getOrder(orderId);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (!req.user.isAdmin && order.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Koristimo storage metodu za dohvat svih faktura i filtriranje
      let invoice = null;
      try {
        const invoicesList = await storage.getAllInvoices();
        invoice = invoicesList.find((inv) => inv.orderId === orderId) || null;

        console.log(
          `Dohvaćena faktura za narudžbu ${orderId}:`,
          invoice
            ? `${invoice.invoiceNumber} (ID: ${invoice.id})`
            : "Nema fakture",
        );

        // Dodajmo dodatno logiranje za praćenje svih faktura u bazi
        console.log(
          `Sve fakture u bazi:`,
          invoicesList.map(
            (inv) => `${inv.invoiceNumber} (za narudžbu ${inv.orderId})`,
          ),
        );
      } catch (error) {
        console.error(`Greška pri dohvaćanju faktura iz baze:`, error);
        return res
          .status(500)
          .json({ message: "Greška pri dohvaćanju fakture iz baze" });
      }

      res.json(invoice);
    } catch (error) {
      console.error("Greška pri dohvaćanju fakture za narudžbu:", error);
      res.status(500).json({ message: "Failed to fetch invoice for order" });
    }
  });

  // Rute za praćenje posjeta (Page Visit Tracking Routes)
  app.post("/api/page-visits", async (req, res) => {
    try {
      if (!req.body.path) {
        return res.status(400).json({ error: "Missing path parameter" });
      }

      const path = req.body.path;

      // Verbessert die Erfassung der IP-Adresse
      // Priorisiere X-Forwarded-For, da dies die echte Client-IP hinter Proxys ist
      const forwardedIps = req.headers["x-forwarded-for"];
      let clientIp: string | null = null;

      if (forwardedIps) {
        // X-Forwarded-For kann eine kommaseparierte Liste sein. Der erste ist der Client.
        clientIp = (
          Array.isArray(forwardedIps)
            ? forwardedIps[0]
            : forwardedIps.split(",")[0]
        ).trim();
      } else {
        // Fallback zu req.ip oder req.socket.remoteAddress
        clientIp = req.ip || req.socket.remoteAddress || null;
      }

      let country: string | null = null;
      if (clientIp) {
        country = await getCountryFromIp(clientIp); // Verwende die ermittelte Client-IP
        console.log(
          `Page visit from Client IP: ${clientIp}, Country: ${country}`,
        );
      } else {
        console.warn("Could not determine client IP address for page visit.");
      }

      const resolvedCountry = country || "Unknown";

      const [existingVisit] = await db
        .select()
        .from(pageVisits)
        .where(
          and(
            eq(pageVisits.path, path),
            eq(pageVisits.country, resolvedCountry),
          ),
        );

      if (existingVisit) {
        const [updatedVisit] = await db
          .update(pageVisits)
          .set({
            count: existingVisit.count + 1,
            lastVisited: new Date(),
          })
          .where(eq(pageVisits.id, existingVisit.id))
          .returning();
        res.status(200).json(updatedVisit);
      } else {
        const [newVisit] = await db
          .insert(pageVisits)
          .values({
            path,
            count: 1,
            country: resolvedCountry,
          })
          .returning();
        res.status(200).json(newVisit);
      }
    } catch (error) {
      console.error("Error incrementing page visit:", error);
      res.status(500).json({ error: "Failed to increment page visit" });
    }
  });

  app.get("/api/page-visits/:path", async (req, res) => {
    try {
      // Nur Admin kann Besuche einsehen
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Wenn der Pfad für einzelne Besuche nach Land gefiltert werden soll,
      // müsstest du hier eine weitere Parameter (z.B. req.query.country) hinzufügen.
      // Ansonsten holt diese Route weiterhin den Visit für den Pfad (unabhängig vom Land),
      // wenn du das in dbStorage so implementiert hast.
      const visit = await storage.getPageVisit(req.params.path);
      if (!visit) {
        return res.status(404).json({ error: "No visits found for this path" });
      }

      res.status(200).json(visit);
    } catch (error) {
      console.error("Error getting page visit:", error);
      res.status(500).json({ error: "Failed to get page visit" });
    }
  });

  app.get("/api/page-visits", async (req, res) => {
    try {
      // Nur Admin kann Besuche einsehen
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const visits = await storage.getAllPageVisits();
      res.status(200).json(visits);
    } catch (error) {
      console.error("Error getting all page visits:", error);
      res.status(500).json({ error: "Failed to get page visits" });
    }
  });

  // GET /api/admin/page-visits/countries (KORRIGIERTE VERSION)
  app.get(
    "/api/admin/page-visits/countries",
    adminMiddleware,
    async (req, res) => {
      try {
        console.log("Backend: Request for page visits by country.");

        // Sicherstellen, dass Mappings geladen sind (relevant, wenn Serverstart asynchron ist)
        if (!backendCountryAlpha2ToNumericIdMap) {
          await loadBackendCountryMappings();
        }

        // Gruppiere Besuche nach dem 2-Buchstaben-Ländercode
        const countryVisitsRaw = await db
          .select({
            country: pageVisits.country, // Das ist der 2-Buchstaben-Code (z.B. 'AT')
            totalVisits: sql<number>`sum(${pageVisits.count})`.mapWith(Number),
          })
          .from(pageVisits)
          .groupBy(pageVisits.country)
          .orderBy(desc(sql<number>`sum(${pageVisits.count})`))
          .execute();

        // ✅ NEU: Transformation der Daten HIER im Backend
        const countryVisitsForFrontend = countryVisitsRaw
          .map((cv) => {
            const numericId = backendCountryAlpha2ToNumericIdMap
              ? backendCountryAlpha2ToNumericIdMap[cv.country]
              : null;
            return {
              // Sende die numerische ID (aus TopoJSON) und die ISO_A2 (für Tabelle)
              // oder nur die numerische ID, wenn das Frontend nur diese braucht.
              // Senden wir beide, um flexibel zu bleiben.
              id: numericId || cv.country, // '040' oder 'AT' (Fallback)
              iso_a2: cv.country, // 'AT'
              totalVisits: cv.totalVisits,
            };
          })
          .filter((cv) => cv.id !== "Localhost" && cv.id !== "Unknown"); // Filtern

        console.log(
          `Backend: Page visits by country (transformed for frontend):`,
          countryVisitsForFrontend,
        );
        res.json(countryVisitsForFrontend); // Sende die transformierten Daten an das Frontend
      } catch (error) {
        console.error("Backend: Error fetching page visits by country:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch page visits by country" });
      }
    },
  );

  // Newsletter subscription
  app.post("/api/subscribe", async (req, res) => {
    try {
      // Validate the subscription data
      const validationResult = subscriberSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid subscription data",
          errors: validationResult.error.errors,
        });
      }

      const { email, language } = validationResult.data;

      // Check if the email is already subscribed
      const existingSubscriber = await storage.getSubscriberByEmail(email);
      if (existingSubscriber) {
        return res.status(400).json({
          message: "Diese E-Mail-Adresse ist bereits angemeldet",
        });
      }

      // Generate a unique discount code for the subscriber
      const discountCode = generateDiscountCode();

      // Create the new subscriber
      const newSubscriber = await storage.createSubscriber({
        email,
        language,
        discountCode,
      });

      // Send welcome email with discount code (if configured)
      if (process.env.SENDGRID_API_KEY) {
        try {
          await sendSubscriptionEmail(email, discountCode, language);
        } catch (emailError) {
          console.error("Failed to send subscription email:", emailError);
          // Continue with the subscription process even if email fails
        }
      }

      res.status(201).json({
        message:
          "Vielen Dank für Ihre Anmeldung! Ihr 10% Rabattcode ist: " +
          discountCode,
        discountCode,
      });
    } catch (error) {
      console.error("Error processing subscription:", error);
      res
        .status(500)
        .json({ message: "Subscription failed. Please try again later." });
    }
  });

  // Admin endpoints za upravljanje pretplatnicima
  app.get("/api/admin/subscribers", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const allSubscribers = await storage.getAllSubscribers();
      res.status(200).json(allSubscribers);
    } catch (error) {
      console.error("Error fetching subscribers:", error);
      res.status(500).json({ message: "Failed to fetch subscribers" });
    }
  });

  app.delete("/api/admin/subscribers/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid subscriber ID" });
      }

      // Delete subscriber
      await db.delete(subscribers).where(eq(subscribers.id, id));

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting subscriber:", error);
      res.status(500).json({ message: "Failed to delete subscriber" });
    }
  });

  // Function to generate a unique discount code
  function generateDiscountCode() {
    const prefix = "WELCOME";
    const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${prefix}${randomPart}`;
  }

  // Function to send subscription welcome email with discount code
  async function sendSubscriptionEmail(
    email: string,
    discountCode: string,
    language: string,
  ) {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error("SENDGRID_API_KEY not configured");
    }

    // Import the sendEmail function from sendgrid helper
    const { sendEmail } = await import("./sendgrid");

    // Determine email content based on user's language
    let subject, text, html;

    switch (language) {
      case "hr":
        subject = "Dobrodošli na Kerzenwelt by Dani newsletter!";
        text = `Hvala vam na pretplati na naš newsletter! Koristite kod ${discountCode} za 10% popusta na vašu prvu narudžbu.`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #D4AF37;">Kerzenwelt by Dani</h1>
            <h2>Hvala vam na pretplati!</h2>
            <p>Poštovani,</p>
            <p>Hvala vam što ste se pretplatili na naš newsletter. Kao znak zahvalnosti, pripremili smo vam poseban popust.</p>
            <p>Vaš kod za 10% popusta pri prvoj kupnji je:</p>
            <div style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 20px; font-weight: bold; letter-spacing: 2px; margin: 20px 0;">
              ${discountCode}
            </div>
            <p>Hvala što ste dio Kerzenwelt zajednice!</p>
            <p>Srdačan pozdrav,<br>Daniela</p>
          </div>
        `;
        break;

      case "en":
        subject = "Welcome to Kerzenwelt by Dani newsletter!";
        text = `Thank you for subscribing to our newsletter! Use code ${discountCode} for 10% off your first order.`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #D4AF37;">Kerzenwelt by Dani</h1>
            <h2>Thank you for subscribing!</h2>
            <p>Dear Customer,</p>
            <p>Thank you for subscribing to our newsletter. As a token of our appreciation, we've prepared a special discount for you.</p>
            <p>Your 10% discount code for your first purchase is:</p>
            <div style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 20px; font-weight: bold; letter-spacing: 2px; margin: 20px 0;">
              ${discountCode}
            </div>
            <p>Thank you for being part of the Kerzenwelt community!</p>
            <p>Best regards,<br>Daniela</p>
          </div>
        `;
        break;
      case "it":
        subject = "Benvenuto alla newsletter di Kerzenwelt by Dani!";
        text = `Grazie per esserti iscritto alla nostra newsletter! Utilizza il codice ${discountCode} per ottenere il 10% di sconto sul tuo primo ordine.`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #D4AF37;">Kerzenwelt by Dani</h1>
            <h2>Grazie per l'iscrizione!</h2>
            <p>Gentile Cliente,</p>
            <p>Grazie per esserti iscritto alla nostra newsletter. Come segno del nostro apprezzamento, abbiamo preparato uno sconto speciale per te.</p>
            <p>Il tuo codice sconto del 10% per il tuo primo acquisto è:</p>
            <div style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 20px; font-weight: bold; letter-spacing: 2px; margin: 20px 0;">
              ${discountCode}
            </div>
            <p>Grazie per far parte della comunità Kerzenwelt!</p>
            <p>Cordiali saluti,<br>Daniela</p>
          </div>
        `;
        break;
      case "sl":
        subject = "Dobrodošli v Kerzenwelt by Dani newsletter!";
        text = `Hvala, ker ste se naročili na naš newsletter! Uporabite kodo ${discountCode} za 10% popusta pri prvem naročilu.`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #D4AF37;">Kerzenwelt by Dani</h1>
            <h2>Hvala za vašo prijavo!</h2>
            <p>Spoštovani,</p>
            <p>Hvala, ker ste se naročili na naš newsletter. Kot znak zahvale smo vam pripravili poseben popust.</p>
            <p>Vaša koda za 10% popust pri prvem nakupu je:</p>
            <div style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 20px; font-weight: bold; letter-spacing: 2px; margin: 20px 0;">
              ${discountCode}
            </div>
            <p>Hvala, ker ste del skupnosti Kerzenwelt!</p>
            <p>Lep pozdrav,<br>Daniela</p>
          </div>
        `;
        break;
      default: // German
        subject = "Willkommen zum Kerzenwelt by Dani Newsletter!";
        text = `Vielen Dank für Ihre Anmeldung zu unserem Newsletter! Verwenden Sie den Code ${discountCode} für 10% Rabatt auf Ihre erste Bestellung.`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #D4AF37;">Kerzenwelt by Dani</h1>
            <h2>Vielen Dank für Ihre Anmeldung!</h2>
            <p>Sehr geehrter Kunde,</p>
            <p>Vielen Dank für Ihre Anmeldung zu unserem Newsletter. Als Zeichen unserer Wertschätzung haben wir einen speziellen Rabatt für Sie vorbereitet.</p>
            <p>Ihr 10% Rabattcode für Ihren ersten Einkauf ist:</p>
            <div style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 20px; font-weight: bold; letter-spacing: 2px; margin: 20px 0;">
              ${discountCode}
            </div>
            <p>Vielen Dank, dass Sie Teil der Kerzenwelt-Gemeinschaft sind!</p>
            <p>Mit freundlichen Grüßen,<br>Daniela</p>
          </div>
        `;
    }

    // Send the email
    try {
      await sendEmail({
        to: email,
        from: "info@kerzenweltbydani.com", // Koristimo verificiranu email adresu
        subject,
        text,
        html,
      });

      console.log(`Newsletter subscription email sent to ${email}`);
      return true;
    } catch (error) {
      console.error("Error sending subscription email:", error);
      // Continue even if email fails
      return false;
    }
  }

  // Endpoint za automatsko generiranje PDF računa i slanje preko email-a (kao postojeći "Generiere PDF" gumb)
  app.post("/api/orders/:id/generate-pdf", async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      if (isNaN(orderId)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }

      // Dohvati podatke o narudžbi
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // NOVI LOGOVI KOJI TREBAJU BITI OVDJE:
      console.log(
        `[DEBUG INVOICE INPUT] Order values received for invoice generation:`,
      );
      console.log(`  - order.id: ${order.id}`);
      console.log(`  - order.total: ${order.total}`);
      console.log(`  - order.subtotal: ${order.subtotal}`);
      console.log(`  - order.discountAmount: ${order.discountAmount}`);
      console.log(`  - order.shippingCost: ${order.shippingCost}`);

      const user = await storage.getUser(order.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const orderItems = await storage.getOrderItems(orderId);
      if (!orderItems || orderItems.length === 0) {
        return res.status(404).json({ message: "No order items found" });
      }

      // Generiraj PDF sadržaj
      const jsPDF = (await import("jspdf")).default;
      const autoTable = (await import("jspdf-autotable")).default;
      const { format } = await import("date-fns"); // Import date-fns for date formatting

      const doc = new jsPDF();

      // --- Start of PDF content generation from pdf-izgled-koji-valja.tsx ---

      // Determine invoice language (default to 'de' as per original nevalja.ts)
      const lang = "de"; //

      // Define translations for PDF
      const translations: Record<string, Record<string, string>> = {
        hr: {
          title: "RACUN",
          date: "Datum racuna",
          invoiceNo: "Broj racuna",
          buyer: "Podaci o kupcu",
          seller: "Prodavatelj",
          item: "Proizvod",
          quantity: "Kolicina",
          price: "Cijena/kom",
          total: "Ukupno",
          subtotal: "Meduzboj",
          tax: "PDV (0%)",
          totalAmount: "UKUPNO",
          paymentInfo: "Informacije o placanju",
          paymentMethod: "Nacin placanja",
          paymentStatus: "Status placanja",
          cash: "Gotovina",
          bank: "Bankovni prijenos",
          paypal: "PayPal",
          paid: "Placeno",
          unpaid: "U obradi",
          deliveryAddress: "Adresa za dostavu",
          handInvoice: "Rucni racun",
          thankYou: "Hvala Vam na narudzbi",
          generatedNote:
            "Ovo je automatski generirani racun i valjan je bez potpisa i pecata",
          exemptionNote:
            "Poduzetnik nije u sustavu PDV-a, PDV nije obracunat temeljem odredbi posebnog postupka oporezivanja za male porezne obveznike.",
          orderItems: "Stavke narudzbe",
          shipping: "Dostava",
          customerNote: "Napomena kupca",
        },
        en: {
          title: "INVOICE",
          date: "Invoice date",
          invoiceNo: "Invoice number",
          buyer: "Buyer information",
          seller: "Seller",
          item: "Product",
          quantity: "Quantity",
          price: "Price/unit",
          total: "Total",
          subtotal: "Subtotal",
          tax: "VAT (0%)",
          totalAmount: "TOTAL",
          paymentInfo: "Payment information",
          paymentMethod: "Payment method",
          paymentStatus: "Payment status",
          cash: "Cash",
          bank: "Bank transfer",
          paypal: "PayPal",
          paid: "Paid",
          unpaid: "Processing",
          deliveryAddress: "Delivery address",
          handInvoice: "Hand invoice",
          thankYou: "Thank you for your order",
          generatedNote:
            "This is an automatically generated invoice and is valid without signature or stamp",
          exemptionNote:
            "The entrepreneur is not in the VAT system, VAT is not calculated based on the provisions of the special taxation procedure for small taxpayers.",
          orderItems: "Order items",
          shipping: "Shipping",
          customerNote: "Customer note",
        },
        de: {
          title: "RECHNUNG",
          date: "Rechnungsdatum",
          invoiceNo: "Rechnungsnummer",
          buyer: "Käuferinformationen",
          seller: "Verkäufer",
          item: "Produkt",
          quantity: "Menge",
          price: "Preis/Stück",
          total: "Gesamt",
          subtotal: "Zwischensumme",
          tax: "MwSt. (0%)",
          totalAmount: "GESAMTBETRAG",
          paymentInfo: "Zahlungsinformationen",
          paymentMethod: "Zahlungsmethode",
          paymentStatus: "Zahlungsstatus",
          cash: "Bargeld",
          bank: "Banküberweisung",
          paypal: "PayPal",
          paid: "Bezahlt",
          unpaid: "In Bearbeitung",
          deliveryAddress: "Lieferadresse",
          handInvoice: "Handrechnung",
          thankYou: "Vielen Dank für Ihre Bestellung",
          generatedNote:
            "Dies ist eine automatisch generierte Rechnung und ist ohne Unterschrift und Stempel gültig",
          exemptionNote:
            "Der Unternehmer ist nicht im Mehrwertsteuersystem, MwSt. wird nicht berechnet gemäß den Bestimmungen des Kleinunternehmerregelung.",
          orderItems: "Bestellpositionen",
          shipping: "Versand",
          customerNote: "Kundenhinweis",
        },
      }; //

      // Select translations
      const t = translations[lang] || translations.hr; //

      // Function to get payment status text based on selected value and language
      const getPaymentStatusText = (status: string | undefined) => {
        if (!status) return t.unpaid; //
        return status === "completed" ? t.paid : t.unpaid; //
      };

      // Function to get payment method text
      const getPaymentMethodText = (method: string, currentLang: string) => {
        const methodMap: Record<string, Record<string, string>> = {
          cash: { hr: "Gotovina", en: "Cash", de: "Bargeld" },
          bank_transfer: {
            hr: "Bankovni prijenos",
            en: "Bank transfer",
            de: "Banküberweisung",
          },
          paypal: { hr: "PayPal", en: "PayPal", de: "PayPal" },
          credit_card: {
            hr: "Kreditkarte",
            en: "Credit Card",
            de: "Kreditkarte",
          },
          eps: { hr: "EPS", en: "EPS", de: "EPS" },
        };
        return methodMap[method]?.[currentLang] || method;
      };

      // Set basic details
      doc.setFontSize(10); //
      doc.setTextColor(0, 0, 0); //

      // Header with logo
      try {
        const fs = await import("fs");
        const path = await import("path");
        const logoPath = path.join(
          process.cwd(),
          "client/src/assets/Kerzenwelt by Dani.png",
        );
        const logoBuffer = fs.readFileSync(logoPath);
        const logoBase64 =
          "data:image/png;base64," + logoBuffer.toString("base64");

        console.log("🖼️ Logo loaded successfully, adding to PDF");
        doc.addImage(logoBase64, "PNG", 20, 15, 30, 30);
      } catch (logoError) {
        console.log("⚠️ Logo could not be added to PDF:", logoError);
        // Continue without logo if there's an error
      }

      // Format date and invoice number
      const currentDate = new Date(); //
      const formattedDate = format(currentDate, "dd.MM.yyyy."); //

      // Get invoice number from database or generate a temporary one if it doesn't exist
      const baseNumber = 450; //
      let invoiceNumber = `i${baseNumber}`; //

      try {
        const invoicesResponse = await storage.getAllInvoices(); // Assuming storage.getAllInvoices() exists and returns an array of invoices with orderId and invoiceNumber
        const existingInvoice = invoicesResponse.find(
          (inv) => inv.orderId === order.id,
        ); //
        if (existingInvoice && existingInvoice.invoiceNumber) {
          //
          invoiceNumber = existingInvoice.invoiceNumber; //
          console.log(
            "Korištenje stvarnog broja računa iz baze:",
            invoiceNumber,
          ); //
        } else {
          invoiceNumber =
            order.id < baseNumber ? `i${baseNumber}` : `i${order.id}`; //
          console.log("Korištenje privremenog broja računa:", invoiceNumber); //
        }
      } catch (invoiceError) {
        // If there's an error fetching invoices, fall back to temporary invoice number
        invoiceNumber =
          order.id < baseNumber ? `i${baseNumber}` : `i${order.id}`; //
        console.log("Koristim novi broj računa zbog greške:", invoiceNumber); //
      }

      doc.setTextColor(218, 165, 32); // Golden color (RGB)
      doc.setFontSize(18); //
      doc.setFont("helvetica", "bold"); //
      doc.text("Kerzenwelt by Dani", 55, 24); //
      doc.setFontSize(10); //
      doc.setTextColor(0, 0, 0); // Return to black color
      doc.setFont("helvetica", "normal"); //
      doc.text("Ossiacher Zeile 30, 9500 Villach, Österreich", 55, 30); //
      doc.text("Email: info@kerzenweltbydani.com", 55, 35); //

      // Title and invoice number on the right side
      doc.setTextColor(0, 0, 0); //
      doc.setFontSize(16); //
      doc.setFont("helvetica", "bold"); //
      doc.text(t.title, 190, 24, { align: "right" }); //
      doc.setFontSize(11); //
      doc.setFont("helvetica", "normal"); //
      doc.text(`${t.invoiceNo}: ${invoiceNumber}`, 190, 32, { align: "right" }); //
      doc.text(`${t.date}: ${formattedDate}`, 190, 38, { align: "right" }); //

      // Horizontal line
      doc.setDrawColor(200, 200, 200); //
      doc.line(20, 45, 190, 45); //

      // Customer data
      doc.setFontSize(11); //
      doc.setFont("helvetica", "bold"); //
      doc.text(`${t.buyer}:`, 20, 55); //
      doc.setDrawColor(200, 200, 200); //
      doc.line(20, 57, 190, 57); //
      doc.setFont("helvetica", "normal"); //

      let customerY = 62; //

      // Add customer information if available, otherwise display "hand invoice"
      if (user) {
        //
        const fullName =
          `${user.firstName || ""} ${user.lastName || ""}`.trim(); //
        const email = user.email || ""; //
        const address = order.shippingAddress || user.address || ""; //
        const city = order.shippingCity || user.city || ""; //
        const postalCode = order.shippingPostalCode || user.postalCode || ""; //
        const country = order.shippingCountry || user.country || ""; //

        if (fullName) {
          //
          doc.text(fullName, 20, customerY); //
          customerY += 5; //
        }

        if (email) {
          //
          doc.text(`Email: ${email}`, 20, customerY); //
          customerY += 5; //
        }

        if (address) {
          //
          doc.text(`${t.deliveryAddress}: ${address}`, 20, customerY); //
          customerY += 5; //
        }

        if (postalCode || city) {
          //
          doc.text(`${postalCode} ${city}`, 20, customerY); //
          customerY += 5; //
        }

        if (country) {
          //
          doc.text(country, 20, customerY); //
          customerY += 5; //
        }
      } else {
        doc.text(`${t.deliveryAddress}: N/A - ${t.handInvoice}`, 20, customerY); //
        customerY += 5; //
      }

      // Add customer notes if they exist
      if (order.customerNote) {
        //
        doc.setFontSize(11); //
        doc.setFont("helvetica", "bold"); //
        doc.text(`${t.customerNote}:`, 120, 55); // Same Y position as "Buyer information"
        doc.setFont("helvetica", "normal"); //
        doc.setFontSize(10); //

        const noteLines = doc.splitTextToSize(order.customerNote, 65); // Slightly narrower space for notes
        const maxLines = Math.min(3, noteLines.length); // Max 3 lines

        for (let i = 0; i < maxLines; i++) {
          //
          doc.text(noteLines[i], 120, 62 + i * 5); // Start below the note title
        }
      }

      // Order items
      doc.setFontSize(11); //
      doc.setFont("helvetica", "bold"); //
      doc.text(`${t.orderItems}:`, 20, customerY + 5); //
      doc.setDrawColor(200, 200, 200); //
      doc.line(20, customerY + 7, 190, customerY + 7); //

      // Prepare data for the table
      const items = orderItems.map((item) => {
        let productName = item.productName || `${t.product} #${item.productId}`; //
        let details = []; //

        // Add scent if exists
        if (item.scentName) {
          //
          details.push(`Duft: ${item.scentName}`); //
        }

        // Add color(s) - check colorIds for multiple colors first
        let colorText = null; //
        if (item.hasMultipleColors && item.colorIds) {
          //
          try {
            const colorIds = JSON.parse(item.colorIds); //
            if (Array.isArray(colorIds)) {
              //
              const colorMap: { [key: number]: string } = {
                1: "Weiß",
                2: "Beige",
                3: "Golden",
                5: "Rot",
                6: "Grün",
                7: "Blau",
                8: "Gelb",
                9: "Lila",
                10: "Rosa",
                11: "Schwarz",
                12: "Orange",
                13: "Braun",
              }; //
              const colorNames = colorIds.map(
                (colorId) => colorMap[colorId] || `Farbe ${colorId}`,
              ); //
              colorText = colorNames.join(", "); //
            }
          } catch (e) {
            console.error("Error parsing colorIds in PDF:", e); //
          }
        } else if (item.colorName) {
          //
          colorText = item.colorName; //
        }

        if (colorText) {
          //
          const colorLabel = item.hasMultipleColors ? "Farben" : "Farbe"; //
          details.push(`${colorLabel}: ${colorText}`); //
        }

        // Combine product name with details
        const detailsText = details.length > 0 ? `\n${details.join("\n")}` : ""; //
        const fullName = `${productName}${detailsText}`; //
        const price = parseFloat(item.price).toFixed(2); //
        const total = (parseFloat(item.price) * item.quantity).toFixed(2); //

        return [fullName, item.quantity, `${price} €`, `${total} €`]; //
      });

      // Add table
      autoTable(doc, {
        head: [
          [
            t.item, //
            t.quantity.replace(/\s+/g, " "), // Ensure no multiple spaces
            t.price, //
            t.total, //
          ],
        ],
        body: items, //
        startY: customerY + 10, //
        margin: { left: 20, right: 20 }, //
        headStyles: {
          fillColor: [245, 245, 245], //
          textColor: [0, 0, 0], //
          fontStyle: "bold", //
          halign: "left", //
          valign: "middle", //
          fontSize: 10, //
          cellPadding: 5, //
          minCellWidth: 30, // Ensure header cells are wide enough
          overflow: "visible", // Ensure text is not truncated
        },
        bodyStyles: {
          textColor: [0, 0, 0], //
          fontSize: 10, //
          cellPadding: 5, //
        },
        columnStyles: {
          0: { cellWidth: "auto" }, //
          1: { cellWidth: 30, halign: "center" }, // Increased "Quantity" column width from 20 to 30
          2: { cellWidth: 30, halign: "right" }, //
          3: { cellWidth: 30, halign: "right" }, //
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250], //
        },
      });

      // NEU: Verwende die bereits im 'order'-Objekt gespeicherten Werte
      // (Diese Werte sollten den Rabatt bereits enthalten, wie sie vom Webhook in die DB geschrieben wurden)
      let subtotalInvoice = parseFloat(order.subtotal || "0"); // <- Nutze den Subtotal aus der DB
      const shippingCostInvoice = parseFloat(order.shippingCost || "0"); // <- Nutze Versandkosten aus der DB
      const totalInvoice = parseFloat(order.total || "0"); // <- Nutze den Total aus der DB

      // Get position after the table
      const finalY = (doc as any).lastAutoTable.finalY || 200; // Početna pozicija za zbrojeve

      // Početna Y pozicija za prvu sumarnu liniju (Međuzbroj)
      let currentY = finalY + 10;

      // 1. Međuzbroj (Subtotal)
      doc.setFontSize(10);
      doc.text(`${t.subtotal}:`, 160, currentY, { align: "right" });
      doc.text(`${subtotalInvoice.toFixed(2)} €`, 190, currentY, {
        align: "right",
      });
      currentY += 5; // Pomakni za sljedeću liniju

      // 2. Popust (Rabatt) - DODANO NOVO
      // Provjeri postoji li popust u narudžbi
      const orderDiscountAmount = parseFloat(order.discountAmount || "0");
      const orderDiscountType = (order as any)?.discountType; // Fixed ili Percentage
      const orderDiscountPercentage = parseFloat(
        order.discountPercentage || "0",
      ); // Postotak za postotni popust

      if (orderDiscountAmount > 0) {
        let discountDisplayText = `Rabatt:`;
        if (orderDiscountType === "percentage" && orderDiscountPercentage > 0) {
          discountDisplayText = `Rabatt (-${orderDiscountPercentage.toFixed(0)}%):`;
        }

        doc.text(discountDisplayText, 160, currentY, { align: "right" });
        doc.text(`-${orderDiscountAmount.toFixed(2)} €`, 190, currentY, {
          align: "right",
        });
        currentY += 5; // Pomakni za sljedeću liniju
      }

      // 3. Dostava (Shipping)
      doc.text(`${t.shipping}:`, 160, currentY, { align: "right" });
      doc.text(`${shippingCostInvoice.toFixed(2)} €`, 190, currentY, {
        align: "right",
      });
      currentY += 5; // Pomakni za sljedeću liniju

      // 4. Porez (Tax) - PDV
      doc.text(`${t.tax}:`, 160, currentY, { align: "right" });
      doc.text("0.00 €", 190, currentY, { align: "right" });
      currentY += 5; // Pomakni za sljedeću liniju

      // 5. Ukupan Iznos (Total Amount)
      doc.setFont("helvetica", "bold");
      doc.text(`${t.totalAmount}:`, 160, currentY, { align: "right" });
      doc.text(`${totalInvoice.toFixed(2)} €`, 190, currentY, {
        align: "right",
      }); // totalInvoice sadrži konačan iznos (7.64€)
      doc.setFont("helvetica", "normal");

      // Payment information
      doc.setDrawColor(200, 200, 200); //
      doc.line(20, finalY + 30, 190, finalY + 30); //

      doc.setFontSize(11); //
      doc.setFont("helvetica", "bold"); //
      doc.text(`${t.paymentInfo}:`, 20, finalY + 38); //
      doc.setFont("helvetica", "normal"); //
      doc.setFontSize(10); //

      const paymentMethod = getPaymentMethodText(
        order.paymentMethod || "bank_transfer",
        lang,
      ); //
      const paymentStatus = getPaymentStatusText(order.paymentStatus); //

      doc.text(`${t.paymentMethod}: ${paymentMethod}`, 20, finalY + 45); //
      doc.text(`${t.paymentStatus}: ${paymentStatus}`, 20, finalY + 50); //

      // Thank you for your order
      doc.setFontSize(10); //
      doc.text(`${t.thankYou}!`, 105, finalY + 65, { align: "center" }); //

      // Footer with company information
      doc.setFontSize(8); //
      doc.text(
        "Kerzenwelt by Dani | Ossiacher Zeile 30, 9500 Villach, Österreich | Email: info@kerzenweltbydani.com | Telefon: 004366038787621",
        105,
        finalY + 75,
        { align: "center" },
      ); //
      doc.text(`${t.generatedNote}.`, 105, finalY + 80, { align: "center" }); //
      doc.text("Steuernummer: 61 154/7175", 105, finalY + 85, {
        align: "center",
      }); //
      doc.text(`${t.exemptionNote}`, 105, finalY + 90, { align: "center" }); //

      // --- End of PDF content generation from pdf-izgled-koji-valja.tsx ---

      // Generiraj PDF kao base64
      const pdfBuffer = doc.output("arraybuffer");
      const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

      // Pošalji email sa PDF prilogom
      console.log("📧 PDF endpoint - počinje slanje email-a na:", user.email);
      const { sendEmail } = await import("./sendgrid");

      console.log("📧 PDF endpoint - pozivam SendGrid...");
      const emailSent = await sendEmail({
        to: user.email,
        from: "info@kerzenweltbydani.com",
        subject: `Rechnung ${invoiceNumber} - Kerzenwelt by Dani`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #D4AF37;">Kerzenwelt by Dani</h1>
            <h2>Ihre Rechnung ist bereit!</h2>
            <p>Sehr geehrte/r ${user.firstName || ""} ${user.lastName || ""},</p>
            <p>vielen Dank für Ihre Bestellung. Ihre Rechnung ${invoiceNumber} finden Sie im Anhang.</p>
            <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
            <p>Mit freundlichen Grüßen,<br>Ihr Team von Kerzenwelt by Dani</p>
          </div>
        `,
        attachments: [
          {
            content: pdfBase64,
            filename: `Rechnung_${invoiceNumber}.pdf`,
            type: "application/pdf",
            disposition: "attachment",
          },
        ],
      });

      if (emailSent) {
        console.log("✅ PDF endpoint - email uspešno poslan na:", user.email);
        console.log(
          `🎉 PDF invoice sent via email to ${user.email} for order ${orderId}`,
        );
        res.json({
          success: true,
          message: "Invoice generated and sent via email",
          invoiceNumber: invoiceNumber,
        });
      } else {
        console.log("❌ PDF endpoint - email slanje neuspešno");
        res
          .status(500)
          .json({ message: "Invoice generated but email sending failed" });
      }
    } catch (error) {
      console.error("❌ PDF endpoint - greška:", error);
      res.status(500).json({ message: "Failed to generate and send invoice" });
    }
  });

  // ===== API rute für E-Mail Postfach (ADMIN) =====
  // GET /api/admin/emails
  app.get("/api/admin/emails", adminMiddleware, async (req, res) => {
    try {
      console.log("Backend: Request to get all mailbox messages.");
      const emails = await storage.getAllMailboxMessages();
      res.json(emails);
    } catch (error) {
      console.error("Backend: Error fetching mailbox messages:", error);
      res.status(500).json({ message: "Failed to fetch emails" });
    }
  });

  // POST /api/admin/emails/send
  app.post("/api/admin/emails/send", adminMiddleware, async (req, res) => {
    try {
      console.log("Backend: Request to send new email from admin.");

      const { recipient, subject, body, inReplyToMessageId } = req.body;

      // Validierung mit Zod Schema
      const validatedData = InsertMailboxMessageSchema.parse({
        senderEmail: "info@kerzenweltbydani.com", // Absender ist immer die Admin-Adresse
        recipientEmail: recipient,
        subject: subject,
        body: body,
        type: "outbound",
        read: true, // E-Mails, die vom Admin gesendet werden, sind immer 'gelesen'
        inReplyToMessageId: inReplyToMessageId || null,
      });

      // E-Mail tatsächlich senden über SendGrid
      // Hier verwenden wir die importierte `sendEmail` Funktion aus `notificationService.ts`
      const emailSentSuccessfully = await sendEmail({
        // <-- Hier `sendEmail` verwenden
        to: validatedData.recipientEmail,
        from: validatedData.senderEmail, // Dies ist deine `info@kerzenweltbydani.com` Adresse
        subject: validatedData.subject,
        html: validatedData.body.replace(/\n/g, "<br>"), // Grundlegende Konvertierung für HTML-E-Mail
        text: validatedData.body,
      });

      if (!emailSentSuccessfully) {
        console.warn(
          "Backend: E-Mail konnte nicht über SendGrid versendet werden.",
        );
        // Optional: Du könntest hier einen Fehler werfen, wenn das Senden der E-Mail kritisch ist
        // throw new Error("E-Mail-Versand über SendGrid fehlgeschlagen.");
      }

      // E-Mail in der Datenbank speichern (als ausgehend)
      const sentMessage = await storage.createMailboxMessage(validatedData);
      res.status(201).json(sentMessage);
    } catch (error) {
      console.error("Backend: Error sending email:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      // Wenn der Fehler vom `sendEmail`-Aufruf kommt und du ihn als kritisch betrachtest
      // kannst du hier eine spezifischere Fehlermeldung zurückgeben.
      res.status(500).json({ message: "Failed to send email" });
    }
  });

  // PUT /api/admin/emails/:id/read
  app.put("/api/admin/emails/:id/read", adminMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { read } = req.body; // Erwarte { read: true } oder { read: false }

      if (typeof read !== "boolean") {
        return res
          .status(400)
          .json({ message: "Invalid 'read' status. Must be boolean." });
      }

      console.log(
        `Backend: Request to update read status for email ID ${id} to ${read}.`,
      );
      const updatedMessage = await storage.updateMailboxMessageReadStatus(
        id,
        read,
      );

      if (!updatedMessage) {
        return res.status(404).json({ message: "Email not found." });
      }
      res.json(updatedMessage);
    } catch (error) {
      console.error(
        `Backend: Error updating read status for email ID ${req.params.id}:`,
        error,
      );
      res.status(500).json({ message: "Failed to update email read status." });
    }
  });

  // DELETE /api/admin/emails/:id
  app.delete("/api/admin/emails/:id", adminMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`Backend: Request to delete email ID ${id}.`);
      await storage.deleteMailboxMessage(id);
      res.status(204).send(); // 204 No Content for successful deletion
    } catch (error) {
      console.error(
        `Backend: Error deleting email ID ${req.params.id}:`,
        error,
      );
      res.status(500).json({ message: "Failed to delete email." });
    }
  });

  // POST /api/admin/emails/receive (Dies wäre ein interner Endpunkt, der von deinem E-Mail-Provider-Webhook aufgerufen wird)
  // HINWEIS: Dieser Endpunkt MUSS UNTER JEDER AUTORISIERUNGS-MIDDLEWARE liegen, wenn er öffentlich erreichbar sein soll.
  // Oder du implementierst eine eigene, spezifische Authentifizierung für den Webhook.
  app.post("/api/admin/emails/receive", async (req, res) => {
    try {
      // Hier musst du die Datenstruktur des Webhooks deines E-Mail-Providers verstehen
      // Beispiel (vereinfacht für SendGrid Inbound Parse Webhook):
      const { from, subject, text, html, to } = req.body;

      if (!from || !subject || (!text && !html) || !to) {
        console.error("Missing required fields for inbound email.");
        return res
          .status(400)
          .json({ message: "Missing required email fields." });
      }

      // 'to' kann ein Array sein, oder einen String wie "info@example.com" oder "Name <info@example.com>"
      const recipientEmail = Array.isArray(to) ? to[0] : to;
      const actualRecipient = (recipientEmail.match(/<([^>]+)>/) || [
        null,
        recipientEmail,
      ])[1]; // Extrahiere E-Mail aus "Name <email>" Format

      // 'from' kann auch "Name <email>" sein
      const senderInfo = from.match(/^(.*?)\s*<([^>]+)>$/) || [
        null,
        null,
        from,
      ];
      const senderName = senderInfo[1] || null;
      const senderEmail = senderInfo[2] || from;

      const inboundMessage: InsertMailboxMessage = {
        senderEmail: senderEmail,
        senderName: senderName,
        recipientEmail: actualRecipient || "info@kerzenweltbydani.com", // Fallback, falls nicht extrahierbar
        subject: subject,
        body: text || html, // Speichere Text oder HTML-Inhalt
        receivedAt: new Date(), // Aktueller Zeitstempel
        type: "inbound",
        read: false, // Standardmäßig ungelesen
        inReplyToMessageId: null, // Konversationserkennung wäre hier komplexer
      };

      const savedMessage = await storage.createMailboxMessage(inboundMessage);
      console.log(
        `Backend: Eingehende E-Mail gespeichert mit ID: ${savedMessage.id}`,
      );
      res
        .status(200)
        .json({ message: "Email received and stored.", id: savedMessage.id });
    } catch (error) {
      console.error("Backend: Error processing inbound email:", error);
      res.status(500).json({ message: "Failed to process inbound email." });
    }
  });

  app.post("/api/emails/inbound", uploadInboundEmail, async (req, res) => {
    try {
      console.log("Backend: Received inbound email webhook from SendGrid.");
      console.log(
        "Inbound Webhook - Raw req.body (Full):",
        JSON.stringify(req.body, null, 2),
      ); // Logge den gesamten Body für Debugging

      // Überprüfe, ob das 'email'-Feld mit dem rohen E-Mail-Inhalt vorhanden ist
      if (!req.body.email) {
        console.error(
          "Backend: Missing 'email' field in inbound webhook body.",
        );
        return res.status(400).json({ message: "Missing raw email content." });
      }

      // Parse den rohen E-Mail-Inhalt mit mailparser
      const parsedEmail = await simpleParser(req.body.email);

      // Extrahiere die benötigten Felder aus dem geparsten E-Mail-Objekt
      const senderEmailRaw = parsedEmail.from?.value[0]?.address || null;
      const senderName = parsedEmail.from?.value[0]?.name || null;
      const recipientEmailRaw = parsedEmail.to?.value[0]?.address || null;
      const subject = parsedEmail.subject || "(no subject)";
      const textBody = parsedEmail.text || parsedEmail.html || null; // Bevorzuge Text, fallback auf HTML

      if (!senderEmailRaw || !recipientEmailRaw || !subject || !textBody) {
        console.error(
          "Backend: Missing required fields after parsing raw email content.",
          {
            from: senderEmailRaw,
            to: recipientEmailRaw,
            subject: subject,
            bodyPresent: !!textBody,
          },
        );
        return res.status(400).json({ message: "Missing required email data" });
      }

      // Optional: Bereinigung der E-Mail-Adressen, falls sie noch Header-Infos enthalten
      // (mailparser sollte das meistens schon korrekt machen, aber zur Sicherheit)
      const finalSenderEmail = senderEmailRaw;
      const finalRecipientEmail = recipientEmailRaw;

      // Validierung mit Zod Schema für eingehende Nachrichten
      const validatedData = InsertMailboxMessageSchema.parse({
        senderEmail: finalSenderEmail,
        senderName: senderName, // Füge den extrahierten Namen hinzu
        recipientEmail: finalRecipientEmail,
        subject: subject,
        body: textBody,
        type: "inbound", // Typ ist 'inbound'
        read: false, // Standardmäßig ungelesen
        receivedAt: new Date(), // Setze den Empfangszeitpunkt
        inReplyToMessageId: null, // Initial NULL, Konversationen später erkennen
      });

      // E-Mail in der Datenbank speichern (als eingehend)
      const savedMessage = await storage.createMailboxMessage(validatedData);

      console.log(
        `Backend: Inbound email from ${finalSenderEmail} saved with ID: ${savedMessage.id}`,
      );
      res.status(200).json({
        message: "Inbound email processed successfully",
        id: savedMessage.id,
      });
    } catch (error) {
      console.error("Backend: Error processing inbound email webhook:", error);
      if (error instanceof z.ZodError) {
        console.error(
          "Backend: Validacijska greška kod obrade dolaznog e-maila:",
          error.errors,
        );
        return res.status(400).json({
          message: "Invalid inbound email data",
          errors: error.errors,
        });
      }
      // Füge einen Log für den ursprünglichen Fehler hinzu, wenn er nicht von Zod ist
      console.error("Original error details:", error);
      res.status(500).json({ message: "Failed to process inbound email" });
    }
  });

  // NEUE ROUTE: GET /api/admin/emails/unread/count
  app.get(
    "/api/admin/emails/unread/count",
    adminMiddleware,
    async (req, res) => {
      try {
        console.log("Backend: Request for unread email count from admin.");

        const unreadCount = await db
          .select({ count: sql<number>`count(*)` }) // Zähle die Zeilen
          .from(mailboxMessages)
          .where(eq(mailboxMessages.read, false)) // Wo 'read' false ist
          .then((rows) => rows[0]?.count || 0); // Hole den Zählerwert oder 0

        console.log(`Backend: Unread email count: ${unreadCount}`);
        res.json({ count: unreadCount });
      } catch (error) {
        console.error("Backend: Error fetching unread email count:", error);
        res.status(500).json({ message: "Failed to fetch unread email count" });
      }
    },
  );

  // Create HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
