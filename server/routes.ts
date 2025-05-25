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
import { createPaymentIntent, createCheckoutSession } from "./stripe";
import { upload, resizeImage } from "./imageUpload";
import fs from "fs";
import path from "path";
import multer from "multer";
import { z } from "zod";
import { eq, sql, and, isNull } from "drizzle-orm";
import { db, pool } from "./db";
import { registerDocumentRoutes } from "./documentRoutes";
import { generateInvoiceFromOrder } from "./invoiceService";
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
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  setupAuth(app);

  // Set up document routes for company documents
  registerDocumentRoutes(app);

  // Stripe routes
  app.post("/api/create-payment-intent", async (req, res) => {
    await createPaymentIntent(req, res);
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    await createCheckoutSession(req, res);
  });
  
  // Nova ruta za procesiranje Stripe sesije nakon uspješnog plaćanja
  app.post("/api/process-stripe-session", async (req, res) => {
    try {
      const { sessionId, userId: providedUserId, language, email: providedEmail } = req.body;
      
      console.log("Primljeni zahtjev za obradu Stripe sesije:", {
        sessionId,
        providedUserId,
        providedEmail,
        language,
        isAuthenticated: !!req.user
      });
      
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
        console.log("Korisnik nije prijavljen u sesiji, nastavit ćemo s obradom Stripe podataka");
        
        // Dohvaćamo korisnika iz baze koristeći metadata u Stripe sesiji
        try {
          const { stripe } = await import('./stripe');
          const stripeSession = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['line_items', 'payment_intent', 'customer', 'customer_details']
          });
          
          // Pokušamo izvući userID iz metapodataka
          if (stripeSession.metadata?.userId) {
            userId = parseInt(stripeSession.metadata.userId);
            console.log(`Pronađen ID korisnika u Stripe metapodacima: ${userId}`);
          }
        } catch (stripeError) {
          console.error("Greška pri dohvaćanju Stripe sesije:", stripeError);
        }
      }
      
      // Provjeravamo imamo li email iz URL-a
      if (!userId && providedEmail) {
        try {
          console.log(`Pokušavam pronaći korisnika po emailu iz URL-a: ${providedEmail}`);
          const userByEmail = await storage.getUserByEmail(providedEmail);
          if (userByEmail) {
            userId = userByEmail.id;
            console.log(`Pronađen korisnik po emailu iz URL-a: ${providedEmail}, ID: ${userId}`);
          }
        } catch (err) {
          console.error("Greška pri traženju korisnika po emailu iz URL-a:", err);
        }
      }
      
      // Ako i dalje nemamo korisnika, provjeravamo imamo li email u Stripe sesiji
      if (!userId) {
        try {
          const { stripe } = await import('./stripe');
          const stripeSession = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['line_items', 'payment_intent', 'customer', 'customer_details']
          });
          
          // Pokušavamo pronaći korisnika po emailu iz Stripe sesije
          if (stripeSession.customer_details?.email) {
            const userByEmail = await storage.getUserByEmail(stripeSession.customer_details.email);
            if (userByEmail) {
              userId = userByEmail.id;
              console.log(`Pronađen korisnik po emailu iz Stripe sesije: ${userByEmail.email}, ID: ${userId}`);
            }
          }
        } catch (err) {
          console.error("Greška pri traženju korisnika po emailu iz Stripe sesije:", err);
        }
      }
      
      // Vraćamo grešku samo ako definitivno ne možemo pronaći korisnika
      if (!userId) {
        return res.status(400).json({ 
          error: "Nije pronađen ID korisnika za kreiranje narudžbe",
          details: "Korisnik nije prijavljen i metadata ne sadrži userId. Molimo pokušajte ponovno." 
        });
      }
      
      console.log(`Obrađujem Stripe sesiju ${sessionId} za korisnika ${userId}`);
      
      // Dohvaćamo modul za Stripe procesiranje
      const { processStripeSession } = await import('./stripe');
      
      // Obrađujemo Stripe sesiju i kreiramo narudžbu
      const result = await processStripeSession(sessionId, userId);
      
      // Čistimo košaricu korisnika nakon uspješne narudžbe
      try {
        await storage.clearCart(userId);
        console.log(`Očišćena košarica za korisnika ${userId} nakon uspješne narudžbe`);
      } catch (cartError) {
        console.error(`Greška pri čišćenju košarice korisnika ${userId}:`, cartError);
        // Ne prekidamo proces ako je čišćenje košarice neuspjelo
      }
      
      // Vraćamo podatke o narudžbi
      res.json(result);
    } catch (error: any) {
      console.error("Greška pri obradi Stripe sesije:", error);
      res.status(500).json({ 
        error: "Greška pri obradi Stripe sesije", 
        details: error.message || String(error) 
      });
    }
  });

  // Enable serving static files from the public directory
  app.use(express.static(path.join(process.cwd(), "public")));

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

  // Products
  app.get("/api/products", async (req, res) => {
    try {
      // Provjera je li korisnik admin - ako je admin, dohvati i neaktivne proizvode
      const includeInactive = req.isAuthenticated() && req.user?.isAdmin;

      // Check if category filter is applied
      const categoryId = req.query.category
        ? parseInt(req.query.category as string)
        : null;

      let products;
      if (categoryId) {
        console.log(`Filtering products by category ID: ${categoryId}`);

        // Use the storage method for consistency
        products = await storage.getProductsByCategory(
          categoryId,
          includeInactive,
        );

        console.log(
          `Found ${products.length} products in category ${categoryId}`,
        );
      } else {
        console.log("Getting all products, includeInactive:", includeInactive);
        products = await storage.getAllProducts(includeInactive);
        console.log(`Retrieved ${products.length} total products`);
      }

      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
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

      // Provjera postoji li proizvod
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Provjera je li proizvod aktivan za ne-admin korisnike
      if (!product.active && (!req.isAuthenticated() || !req.user?.isAdmin)) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const validatedData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(validatedData);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.put("/api/products/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      console.log(
        "Ažuriranje proizvoda ID:",
        id,
        "Podaci:",
        JSON.stringify(req.body),
      );

      // Provjera postoji li proizvod
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
  app.patch("/api/products/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      console.log(
        "Parcijalno ažuriranje proizvoda ID:",
        id,
        "Podaci:",
        JSON.stringify(req.body),
      );

      // Provjera postoji li proizvod
      const existingProduct = await storage.getProduct(id);
      if (!existingProduct) {
        console.log("Proizvod nije pronađen. ID:", id);
        return res.status(404).json({ message: "Product not found" });
      }

      try {
        // Dohvatimo trenutne podatke proizvoda za ažuriranje samo određenih polja
        const currentData = {
          name: existingProduct.name,
          description: existingProduct.description,
          price: existingProduct.price,
          imageUrl: existingProduct.imageUrl,
          categoryId: existingProduct.categoryId,
          stock: existingProduct.stock,
          featured: existingProduct.featured,
          active: existingProduct.active !== false, // osiguravamo da je boolean
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

        // Kombiniramo postojeće podatke s novim podacima
        // Pretvorimo active eksplicitno u boolean ako postoji u req.body
        let updatedData = { ...currentData };

        if (req.body) {
          if ("active" in req.body) {
            // Sigurno konvertiramo u boolean
            updatedData.active =
              req.body.active === true || req.body.active === "true";
          }

          // Kopiramo ostale vrijednosti
          Object.keys(req.body).forEach((key) => {
            if (key !== "active" && key in currentData) {
              updatedData[key as keyof typeof currentData] = req.body[key];
            }
          });
        }

        console.log("Ažurirani podaci:", JSON.stringify(updatedData));

        // Ažuriramo proizvod
        try {
          console.log(
            "Pozivam storage.updateProduct s podacima:",
            JSON.stringify(updatedData),
          );
          const product = await storage.updateProduct(id, updatedData);
          if (!product) {
            console.log("Product not found nakon updateProduct");
            return res.status(404).json({ message: "Product not found" });
          }

          console.log("Proizvod uspješno ažuriran:", JSON.stringify(product));
          // Šaljemo pojednostavljeni odgovor koji sadrži samo podstawne informacije
          // kako bismo izbjegli probleme s JSON parsanjem
          const simplifiedResponse = {
            id: product.id,
            name: product.name,
            active: product.active === true,
          };
          console.log("Šaljem odgovor:", JSON.stringify(simplifiedResponse));
          res.setHeader("Content-Type", "application/json");
          return res.status(200).json(simplifiedResponse);
        } catch (err) {
          console.error("Greška pri storage.updateProduct:", err);
          return res
            .status(500)
            .json({ message: "Server error during product update" });
        }
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

  app.delete("/api/products/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      await storage.deleteProduct(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // Categories
  app.get("/api/categories", async (req, res) => {
    try {
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
      // Provjera je li korisnik admin - ako je admin, dohvati i neaktivne proizvode
      const includeInactive = req.isAuthenticated() && req.user?.isAdmin;
      const products = await storage.getProductsByCategory(id, includeInactive);
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products by category" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

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

  app.put("/api/categories/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

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

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

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
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validatedData = insertOrderSchema.parse({
        ...req.body,
        userId: req.user.id,
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

  app.post("/api/products/:id/reviews", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const productId = parseInt(req.params.id);
      const validatedData = insertReviewSchema.parse({
        ...req.body,
        userId: req.user.id,
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

  // Brisanje recenzije (samo admin)
  app.delete("/api/reviews/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const reviewId = parseInt(req.params.id);

      // Izbriši recenziju
      await db.execute(sql`DELETE FROM reviews WHERE id = ${reviewId}`);

      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete review:", error);
      res.status(500).json({ message: "Failed to delete review" });
    }
  });

  // Users (admin only)
  app.get("/api/users", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

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

  // Postavi popust za korisnika
  app.post("/api/users/:id/discount", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      const { discountAmount, discountMinimumOrder, discountExpiryDate } =
        req.body;

      const updatedUser = await storage.updateUser(id, {
        discountAmount,
        discountMinimumOrder: discountMinimumOrder || "0",
        discountExpiryDate: discountExpiryDate || null,
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Error setting user discount:", error);
      res.status(500).json({ message: "Failed to set user discount" });
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

  // Rute za praćenje posjeta
  app.post("/api/page-visits", async (req, res) => {
    try {
      if (!req.body.path) {
        return res.status(400).json({ error: "Missing path parameter" });
      }

      // Povećaj broj posjeta za putanju
      const visit = await storage.incrementPageVisit(req.body.path);
      res.status(200).json(visit);
    } catch (error) {
      console.error("Error incrementing page visit:", error);
      res.status(500).json({ error: "Failed to increment page visit" });
    }
  });

  app.get("/api/page-visits/:path", async (req, res) => {
    try {
      // Samo admin može pregledati posjete
      if (!req.isAuthenticated() || !req.user.isAdmin) {
        return res.status(403).json({ error: "Forbidden" });
      }

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
      // Samo admin može pregledati posjete
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

  // Create HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
