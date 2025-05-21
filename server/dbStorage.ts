import { eq, and, desc, isNull, sql, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  products,
  categories,
  orders,
  orderItems,
  cartItems,
  reviews,
  scents,
  colors,
  productScents,
  productColors,
  collections,
  OrderItemWithProduct,
  productCollections,
  pages,
  settings,
  invoices,
  invoiceItems,
  pageVisits,
  subscribers,
  verificationTokens,
} from "@shared/schema";

import type {
  User,
  InsertUser,
  Product,
  InsertProduct,
  Category,
  InsertCategory,
  Order,
  InsertOrder,
  OrderItem,
  InsertOrderItem,
  CartItem,
  InsertCartItem,
  CartItemWithProduct,
  Review,
  InsertReview,
  Scent,
  InsertScent,
  Color,
  InsertColor,
  ProductScent,
  InsertProductScent,
  ProductColor,
  InsertProductColor,
  Collection,
  VerificationToken,
  InsertVerificationToken,
  InsertCollection,
  Subscriber,
  InsertSubscriber,
  ProductCollection,
  InsertProductCollection,
  Page,
  InsertPage,
  Setting,
  InsertSetting,
  Invoice,
  InsertInvoice,
  InvoiceItem,
  InsertInvoiceItem,
  PageVisit,
  InsertPageVisit,
  SelectedColorInfo,
} from "@shared/schema";

import connectPg from "connect-pg-simple";
import session from "express-session";
import { pool } from "./db";
import { IStorage } from "./storage";

// Koristimo tipove iz shared/schema.ts

const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
    this.initializeRelationTables();
  }

  private async initializeRelationTables() {
    try {
      console.log(
        "Inicijalizacija pomoćnih tablica za veze između entiteta...",
      );

      // Provjeri i kreiraj tablicu product_scents ako ne postoji
      const productScentsExists = await this.tableExists("product_scents");
      if (!productScentsExists) {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "product_scents" (
            "id" SERIAL PRIMARY KEY,
            "product_id" INTEGER NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
            "scent_id" INTEGER NOT NULL REFERENCES "scents"("id") ON DELETE CASCADE,
            UNIQUE("product_id", "scent_id")
          );
        `);
      }

      // Provjeri i kreiraj tablicu product_colors ako ne postoji
      const productColorsExists = await this.tableExists("product_colors");
      if (!productColorsExists) {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "product_colors" (
            "id" SERIAL PRIMARY KEY,
            "product_id" INTEGER NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
            "color_id" INTEGER NOT NULL REFERENCES "colors"("id") ON DELETE CASCADE,
            UNIQUE("product_id", "color_id")
          );
        `);
      }

      // Provjeri i kreiraj tablicu product_collections ako ne postoji
      const productCollectionsExists = await this.tableExists(
        "product_collections",
      );
      if (!productCollectionsExists) {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "product_collections" (
            "id" SERIAL PRIMARY KEY,
            "product_id" INTEGER NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
            "collection_id" INTEGER NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
            UNIQUE("product_id", "collection_id")
          );
        `);
      }

      console.log("Inicijalizacija pomoćnih tablica završena.");
    } catch (error) {
      console.error(
        `Greška prilikom inicijalizacije pomoćnih tablica: ${error}`,
      );
      throw error;
    }
  }

  private async tableExists(tableName: string): Promise<boolean> {
    try {
      const result = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM pg_tables
          WHERE schemaname = 'public'
          AND tablename = ${tableName}
        );
      `);
      return result.rows[0].exists;
    } catch (error) {
      console.error(
        `Greška prilikom provjere postojanja tablice ${tableName}: ${error}`,
      );
      return false;
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUser(
    id: number,
    userData: Partial<User>,
  ): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  // Product methods
  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, id));
    return product;
  }

  async getAllProducts(includeInactive: boolean = false): Promise<Product[]> {
    console.log("getAllProducts pozvana - includeInactive:", includeInactive);
    let results: Product[];

    if (includeInactive) {
      results = await db.select().from(products);
      console.log(
        `Dohvaćeno ${results.length} proizvoda (uključujući neaktivne)`,
      );
    } else {
      results = await db
        .select()
        .from(products)
        .where(eq(products.active, true));
      console.log(`Dohvaćeno ${results.length} aktivnih proizvoda`);
    }

    // Logiramo status aktivnosti prvih nekoliko proizvoda
    if (results.length > 0) {
      console.log("Primjeri statusa aktivnosti proizvoda:");
      results.slice(0, 3).forEach((p) => {
        console.log(`- ID: ${p.id}, Naziv: ${p.name}, Aktivan: ${p.active}`);
      });
    }

    return results;
  }

  async getFeaturedProducts(): Promise<Product[]> {
    console.log("getFeaturedProducts pozvan");
    const featuredProducts = await db
      .select()
      .from(products)
      .where(and(eq(products.featured, true), eq(products.active, true)));

    console.log(
      `Dohvaćeno ${featuredProducts.length} istaknutih i aktivnih proizvoda`,
    );
    if (featuredProducts.length > 0) {
      console.log("Primjeri istaknutih proizvoda:");
      featuredProducts.slice(0, 3).forEach((p) => {
        console.log(
          `- ID: ${p.id}, Naziv: ${p.name}, Aktivan: ${p.active}, Istaknut: ${p.featured}`,
        );
      });
    }

    return featuredProducts;
  }

  async createProduct(productData: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(productData).returning();
    return product;
  }

  async updateProduct(
    id: number,
    productData: InsertProduct,
  ): Promise<Product | undefined> {
    // Osigurajmo da je active polje ispravno pretvoreno u boolean
    const sanitizedData = { ...productData };
    if ("active" in sanitizedData) {
      sanitizedData.active = sanitizedData.active === true;
    }

    console.log(
      "updateProduct - sanitirani podaci:",
      JSON.stringify(sanitizedData),
    );

    try {
      const [updatedProduct] = await db
        .update(products)
        .set(sanitizedData)
        .where(eq(products.id, id))
        .returning();

      console.log("updateProduct - rezultat:", JSON.stringify(updatedProduct));
      return updatedProduct;
    } catch (error) {
      console.error("Greška pri ažuriranju proizvoda u bazi:", error);
      throw error;
    }
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  // Category methods
  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id));
    return category;
  }

  async getAllCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async createCategory(categoryData: InsertCategory): Promise<Category> {
    const [category] = await db
      .insert(categories)
      .values(categoryData)
      .returning();
    return category;
  }

  async updateCategory(
    id: number,
    categoryData: InsertCategory,
  ): Promise<Category | undefined> {
    const [updatedCategory] = await db
      .update(categories)
      .set(categoryData)
      .where(eq(categories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  async getProductsByCategory(
    categoryId: number,
    includeInactive: boolean = false,
  ): Promise<Product[]> {
    if (includeInactive) {
      return await db
        .select()
        .from(products)
        .where(eq(products.categoryId, categoryId));
    } else {
      return await db
        .select()
        .from(products)
        .where(
          and(eq(products.categoryId, categoryId), eq(products.active, true)),
        );
    }
  }

  // Scent (miris) methods
  async getScent(id: number): Promise<Scent | undefined> {
    const [scent] = await db.select().from(scents).where(eq(scents.id, id));
    return scent;
  }

  async getAllScents(): Promise<Scent[]> {
    return await db.select().from(scents);
  }

  async getActiveScents(): Promise<Scent[]> {
    return await db.select().from(scents).where(eq(scents.active, true));
  }

  async createScent(scentData: InsertScent): Promise<Scent> {
    const [scent] = await db.insert(scents).values(scentData).returning();
    return scent;
  }

  async updateScent(
    id: number,
    scentData: InsertScent,
  ): Promise<Scent | undefined> {
    const [updatedScent] = await db
      .update(scents)
      .set(scentData)
      .where(eq(scents.id, id))
      .returning();
    return updatedScent;
  }

  async deleteScent(id: number): Promise<void> {
    await db.delete(scents).where(eq(scents.id, id));
  }

  async getProductScents(productId: number): Promise<Scent[]> {
    try {
      console.log(`DB: Dohvaćanje mirisa za proizvod ID: ${productId}`);

      // Direktni SQL upit za dohvaćanje povezanih mirisa - uklanjamo reference na updated_at
      const result = await db.execute(
        sql`SELECT s.id, s.name, s.description, s.active
            FROM scents s
            INNER JOIN product_scents ps ON s.id = ps.scent_id
            WHERE ps.product_id = ${productId}`,
      );

      // Pretvaramo rezultate u odgovarajući format s konverzijom tipova - uklanjamo reference na createdAt
      const mirisi = result.rows.map((row) => ({
        id: Number(row.id),
        name: String(row.name || ""),
        description: row.description ? String(row.description) : null,
        active: Boolean(row.active),
      }));

      console.log(
        `Dohvaćeno ${mirisi.length} mirisa za proizvod ID: ${productId}`,
      );
      return mirisi;
    } catch (error) {
      console.error("Greška u getProductScents:", error);
      return [];
    }
  }

  async addScentToProduct(productId: number, scentId: number): Promise<any> {
    try {
      console.log(
        `DB: Dodavanje mirisa - productId: ${productId}, scentId: ${scentId}`,
      );

      // Prvo provjerimo postoji li već veza koristeći direktni SQL upit
      const checkResult = await db.execute(
        sql`SELECT product_id, scent_id FROM product_scents 
            WHERE product_id = ${productId} AND scent_id = ${scentId}`,
      );

      // Dohvatimo rezultate kao array
      const results = checkResult.rows;

      if (results && results.length > 0) {
        console.log("Ova veza već postoji, vraćamo postojeću");

        // Vraćamo postojeću vezu bez ID polja
        return {
          productId: results[0].product_id,
          scentId: results[0].scent_id,
        };
      }

      // Ako veza ne postoji, dodajemo je direktno SQL upitom
      await db.execute(
        sql`INSERT INTO product_scents (product_id, scent_id) 
            VALUES (${productId}, ${scentId})`,
      );

      // Vraćamo objekt koji odgovara strukturi u bazi
      const productScent = {
        productId: productId,
        scentId: scentId,
      };

      console.log("Uspješno dodana veza mirisa i proizvoda:", productScent);
      return productScent;
    } catch (error) {
      console.error("Greška u addScentToProduct:", error);
      throw error;
    }
  }

  async removeScentFromProduct(
    productId: number,
    scentId: number,
  ): Promise<void> {
    await db
      .delete(productScents)
      .where(
        and(
          eq(productScents.productId, productId),
          eq(productScents.scentId, scentId),
        ),
      );
  }

  // Color (boja) methods
  async getColor(id: number): Promise<Color | undefined> {
    const [color] = await db.select().from(colors).where(eq(colors.id, id));
    return color;
  }

  async getAllColors(): Promise<Color[]> {
    return await db.select().from(colors);
  }

  async getActiveColors(): Promise<Color[]> {
    return await db.select().from(colors).where(eq(colors.active, true));
  }

  async createColor(colorData: InsertColor): Promise<Color> {
    const [color] = await db.insert(colors).values(colorData).returning();
    return color;
  }

  async updateColor(
    id: number,
    colorData: InsertColor,
  ): Promise<Color | undefined> {
    const [updatedColor] = await db
      .update(colors)
      .set(colorData)
      .where(eq(colors.id, id))
      .returning();
    return updatedColor;
  }

  async deleteColor(id: number): Promise<void> {
    await db.delete(colors).where(eq(colors.id, id));
  }

  async getProductColors(productId: number): Promise<Color[]> {
    try {
      console.log(`DB: Dohvaćanje boja za proizvod ID: ${productId}`);

      // Direktni SQL upit za dohvaćanje povezanih boja - uklanjamo reference na created_at
      const result = await db.execute(
        sql`SELECT c.id, c.name, c.hex_value as "hexValue", c.active
            FROM colors c
            INNER JOIN product_colors pc ON c.id = pc.color_id
            WHERE pc.product_id = ${productId}`,
      );

      // Pretvaramo rezultate u odgovarajući format s konverzijom tipova - uklanjamo reference na createdAt
      const bojeLista = result.rows.map((row) => ({
        id: Number(row.id),
        name: String(row.name || ""),
        hexValue: String(row.hexValue || ""),
        active: Boolean(row.active),
      }));

      console.log(
        `Dohvaćeno ${bojeLista.length} boja za proizvod ID: ${productId}`,
      );
      return bojeLista;
    } catch (error) {
      console.error("Greška u getProductColors:", error);
      return [];
    }
  }

  async addColorToProduct(productId: number, colorId: number): Promise<any> {
    try {
      console.log(
        `DB: Dodavanje boje - productId: ${productId}, colorId: ${colorId}`,
      );

      // Prvo provjerimo postoji li već veza koristeći direktni SQL upit
      const checkResult = await db.execute(
        sql`SELECT product_id, color_id FROM product_colors 
            WHERE product_id = ${productId} AND color_id = ${colorId}`,
      );

      // Dohvatimo rezultate kao array
      const results = checkResult.rows;

      if (results && results.length > 0) {
        console.log("Ova veza boje već postoji, vraćamo postojeću");

        // Vraćamo postojeću vezu bez ID polja
        return {
          productId: results[0].product_id,
          colorId: results[0].color_id,
        };
      }

      // Ako veza ne postoji, dodajemo je direktno SQL upitom
      await db.execute(
        sql`INSERT INTO product_colors (product_id, color_id) 
            VALUES (${productId}, ${colorId})`,
      );

      // Vraćamo objekt koji odgovara strukturi u bazi
      const productColor = {
        productId: productId,
        colorId: colorId,
      };

      console.log("Uspješno dodana veza boje i proizvoda:", productColor);
      return productColor;
    } catch (error) {
      console.error("Greška u addColorToProduct:", error);
      throw error;
    }
  }

  async removeColorFromProduct(
    productId: number,
    colorId: number,
  ): Promise<void> {
    await db
      .delete(productColors)
      .where(
        and(
          eq(productColors.productId, productId),
          eq(productColors.colorId, colorId),
        ),
      );
  }

  // Order methods
  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getAllOrders(): Promise<Order[]> {
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getUserOrders(userId: number): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));
  }

  async createOrder(
    orderData: InsertOrder,
    items: InsertOrderItem[],
  ): Promise<Order> {
    // Create the order
    const [order] = await db.insert(orders).values(orderData).returning();

    // Create the order items with the order ID
    if (items.length > 0) {
      console.log("Stvaranje stavki narudžbe:", items);
      // Provjeri i osiguraj da su colorIds i hasMultipleColors ispravno preneseni
      await db.insert(orderItems).values(
        items.map((item) => {
          console.log("Procesiranje stavke narudžbe:", item);

          // Vrati transformiranu stavku s ID-jem narudžbe
          return {
            ...item,
            orderId: order.id,
            // Osiguraj da su colorIds i hasMultipleColors preneseni
            colorIds: item.colorIds || null,
            hasMultipleColors: item.hasMultipleColors || false,
          };
        }),
      );
    }

    return order;
  }

  async updateOrderStatus(
    id: number,
    status: string,
  ): Promise<Order | undefined> {
    const [updatedOrder] = await db
      .update(orders)
      .set({ status })
      .where(eq(orders.id, id))
      .returning();
    return updatedOrder;
  }

  async getOrderItems(orderId: number): Promise<OrderItemWithProduct[]> {
    try {
      // Koristimo direktni SQL upit kako bismo osigurali pristup svim poljima
      // i omogućili pristup poljima za višestruke boje
      const { rows } = await pool.query(
        `
        SELECT 
          oi.id,
          oi.order_id,
          oi.product_id,
          oi.product_name,
          oi.quantity,
          oi.price,
          oi.scent_id,
          oi.scent_name,
          oi.color_id,
          oi.color_name,
          oi.color_ids,
          oi.has_multiple_colors,
          p.id as product_id,
          p.name as product_name,
          p.description as product_description,
          p.price as product_price,
          p.image_url as product_image_url,
          p.category_id as product_category_id,
          p.stock as product_stock,
          p.featured as product_featured,
          p.created_at as product_created_at,
          p.allow_multiple_colors as product_allow_multiple_colors,
          p.active as product_active,
          s.id as scent_id,
          s.name as scent_name,
          c.id as color_id,
          c.name as color_name
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        LEFT JOIN scents s ON oi.scent_id = s.id
        LEFT JOIN colors c ON oi.color_id = c.id
        WHERE oi.order_id = $1
      `,
        [orderId],
      );

      console.log("Dohvaćene stavke narudžbe SQL:", rows);

      // Mapiramo rezultate u OrderItemWithProduct format
      const result = rows.map((item: any) => {
        // Pretvaramo snake_case u camelCase
        const productData = {
          id: item.product_id,
          name: item.product_name || `Proizvod #${item.product_id}`,
          description: item.product_description || "",
          price: item.product_price || "0",
          imageUrl: item.product_image_url,
          categoryId: item.product_category_id,
          stock: item.product_stock || 0,
          featured: !!item.product_featured,
          createdAt: item.product_created_at || new Date(),
          active: !!item.product_active,
          allowMultipleColors: !!item.product_allow_multiple_colors,
          // Dodajemo dodatna polja koja očekuje Product tip
          scent: null,
          color: null,
          burnTime: null,
          hasColorOptions: false,
          dimensions: null,
          weight: null,
          materials: null,
          instructions: null,
          maintenance: null,
        };

        // Provjeri postoji li polje za višestruke boje u bazi
        const hasMultipleColors = !!item.has_multiple_colors;

        return {
          id: item.id,
          orderId: item.order_id,
          productId: item.product_id,
          quantity: item.quantity,
          price: item.price,
          product: productData,
          scentId: item.scent_id,
          colorId: item.color_id,
          scentName: item.scent_name || null,
          colorName: item.color_name || null,
          productName: item.product_name || null,
          // Dodajemo podršku za višestruke boje - koristimo vrijednost iz tablice
          // ako postoji, inače fallback na proizvod
          hasMultipleColors:
            hasMultipleColors || !!productData.allowMultipleColors,
        };
      });

      console.log("Konačni rezultat:", JSON.stringify(result[0]));

      return result;
    } catch (error) {
      console.error(`Greška prilikom dohvaćanja stavki narudžbe: ${error}`);
      return [];
    }
  }

  // Cart methods
  async getCartItems(userId: number): Promise<CartItemWithProduct[]> {
    // Dodajemo logging za praćenje
    console.log(`Dohvaćanje stavki košarice za korisnika ${userId}`);

    // 1. Dohvati osnovne podatke o stavkama košarice s uključenim proizvodima
    const result = await db.query.cartItems.findMany({
      where: eq(cartItems.userId, userId),
      with: {
        product: true,
      },
    });

    console.log(`Dohvaćene stavke košarice:`, JSON.stringify(result, null, 2));

    console.log(`Pronađeno ${result.length} stavki u košarici`);

    // 2. Dohvati dodatne informacije (mirise i boje) za svaku stavku
    const cartItemsWithExtras = await Promise.all(
      result.map(async (item) => {
        // Pripremi prošireni objekt za stavku košarice
        let cartItemWithExtras: CartItemWithProduct = {
          ...item,
          product: item.product,
        };

        // 3. Dohvati informacije o mirisu
        if (item.scentId) {
          const [scentData] = await db
            .select()
            .from(scents)
            .where(eq(scents.id, item.scentId));

          if (scentData) {
            cartItemWithExtras.scent = scentData;
            console.log(
              `Za stavku ID ${item.id}, pronađen miris:`,
              scentData.name,
            );
          }
        }

        // 4. Obradi informacije o bojama na temelju tipa stavke
        if (item.hasMultipleColors && item.colorIds) {
          // Stavka ima više odabranih boja
          try {
            // Pretvori string u niz ID-jeva
            const colorIds = JSON.parse(item.colorIds);
            console.log(
              `Za stavku ID ${item.id}, obrada više boja, IDs:`,
              colorIds,
            );

            if (Array.isArray(colorIds) && colorIds.length > 0) {
              // Dohvati sve boje odjednom
              const colorResults = await db
                .select()
                .from(colors)
                .where(
                  sql`${colors.id} IN (${sql.join(colorIds.map((id) => Number(id)))})`,
                );

              console.log(
                `Za stavku ID ${item.id}, dohvaćeno ${colorResults.length} boja iz baze`,
              );

              // Pripremi objekte za svaku boju s pripadajućim podacima
              const selectedColors: SelectedColorInfo[] = colorIds.map(
                (colorId) => {
                  const colorData = colorResults.find(
                    (c) => c.id === Number(colorId),
                  );
                  return {
                    id: Number(colorId),
                    name: colorData?.name || "Nepoznata boja",
                    hexValue: colorData?.hexValue || null,
                  };
                },
              );

              // Dodaj podatke o bojama u stavku košarice
              cartItemWithExtras.selectedColors = selectedColors;
              cartItemWithExtras.hasMultipleColors = true;

              console.log(
                `Za stavku ID ${item.id}, obrađene boje:`,
                selectedColors
                  .map((c) => `${c.name} (${c.hexValue})`)
                  .join(", "),
              );
            }
          } catch (error) {
            console.error(
              `Greška pri obradi višestrukih boja za stavku ${item.id}:`,
              error,
            );
          }
        }
        // Stavka ima samo jednu odabranu boju
        else if (item.colorId) {
          const [colorData] = await db
            .select()
            .from(colors)
            .where(eq(colors.id, item.colorId));
          if (colorData) {
            cartItemWithExtras.color = colorData;
            console.log(
              `Za stavku ID ${item.id}, pronađena boja:`,
              colorData.name,
            );
          }
        }

        // Dodatno logiranje za debug
        console.log(`Za stavku ID ${item.id}, kompletan objekt:`, {
          id: cartItemWithExtras.id,
          hasMultipleColors: cartItemWithExtras.hasMultipleColors ? "Da" : "Ne",
          selectedColorsCount: cartItemWithExtras.selectedColors?.length || 0,
          colorInfo: cartItemWithExtras.color
            ? cartItemWithExtras.color.name
            : "Nema",
        });

        return cartItemWithExtras;
      }),
    );

    console.log(
      `Dohvaćeno ukupno ${cartItemsWithExtras.length} stavki košarice za korisnika ${userId}`,
    );
    return cartItemsWithExtras;
  }

  async addToCart(itemData: InsertCartItem): Promise<CartItem> {
    console.log(
      "========== DODAVANJE U KOŠARICU ZAPOČETO (NOVA METODA v2) ==========",
    );
    console.log(
      "Dodavanje u košaricu, podaci:",
      JSON.stringify(itemData, null, 2),
    );

    try {
      // Provjeri trenutno stanje košarice
      const currentCartItems = await db
        .select()
        .from(cartItems)
        .where(eq(cartItems.userId, itemData.userId));
      console.log(
        "DEBUG: Trenutno stanje košarice:",
        JSON.stringify(currentCartItems, null, 2),
      );

      // Provjera jel stavka koristi višestruki odabir boja
      const hasMultipleColors = itemData.hasMultipleColors === true;
      console.log(
        `DEBUG: Stavka koristi višestruke boje: ${hasMultipleColors}`,
      );

      // Izgradi SQL upit za pronalaženje identične stavke
      let conditions = [];
      conditions.push(sql`"userId" = ${itemData.userId}`);
      conditions.push(sql`"productId" = ${itemData.productId}`);

      // Dodaj uvjet za miris
      if (itemData.scentId) {
        conditions.push(sql`"scentId" = ${itemData.scentId}`);
        console.log(`DEBUG: Tražim točno miris ID=${itemData.scentId}`);
      } else {
        conditions.push(sql`"scentId" IS NULL`);
        console.log("DEBUG: Tražim NULL miris");
      }

      // Različita logika pretraživanja za stavke s jednom ili više boja
      if (hasMultipleColors) {
        conditions.push(sql`"hasMultipleColors" = true`);

        if (itemData.colorIds) {
          conditions.push(sql`"colorIds" = ${itemData.colorIds}`);
          console.log(`DEBUG: Tražim višestruke boje: ${itemData.colorIds}`);
        } else {
          conditions.push(sql`"colorIds" IS NULL`);
          console.log("DEBUG: Tražim NULL colorIds");
        }
      } else {
        // Standardna logika za jednu boju
        conditions.push(sql`"hasMultipleColors" = false`);

        if (itemData.colorId) {
          conditions.push(sql`"colorId" = ${itemData.colorId}`);
          console.log(`DEBUG: Tražim točno boju ID=${itemData.colorId}`);
        } else {
          conditions.push(sql`"colorId" IS NULL`);
          console.log("DEBUG: Tražim NULL boju");
        }
      }

      // Kreiraj SQL upit
      const sqlQuery = conditions.join(" AND ");
      console.log("DEBUG: SQL upit:", sqlQuery);

      // Izvrši raw SQL upit da izbjegnemo probleme s Drizzle operatorima
      const existingItemsResult = await db.execute(sql`
        SELECT * FROM "cartItems" 
        WHERE ${sql.raw(sqlQuery)}
      `);

      console.log(
        "DEBUG: Rezultat SQL upita:",
        JSON.stringify(existingItemsResult, null, 2),
      );

      const existingItems = existingItemsResult.rows;
      console.log(
        `DEBUG: Pronađeno ${existingItems.length} stavki s istim uvjetima`,
      );

      let resultCartItem: CartItem;

      if (existingItems.length > 0) {
        // Ažuriraj postojeću stavku u košarici
        const existingItem = existingItems[0] as CartItem;

        // Detalji o postojećoj stavci
        console.log(
          "DEBUG: Postojeća stavka košarice:",
          JSON.stringify(existingItem, null, 2),
        );
        console.log(
          `DEBUG: Ažuriram količinu: ${existingItem.quantity} => ${existingItem.quantity + itemData.quantity}`,
        );

        // Ažuriraj količinu
        const [updatedItem] = await db
          .update(cartItems)
          .set({
            quantity: existingItem.quantity + itemData.quantity,
          })
          .where(eq(cartItems.id, existingItem.id))
          .returning();

        console.log(
          "DEBUG: Ažurirana stavka:",
          JSON.stringify(updatedItem, null, 2),
        );
        resultCartItem = updatedItem;
      } else {
        // Kreiraj novu stavku u košarici
        console.log(
          "DEBUG: Kreiram novu stavku:",
          JSON.stringify(itemData, null, 2),
        );

        const [newItem] = await db
          .insert(cartItems)
          .values(itemData)
          .returning();
        console.log("DEBUG: Nova stavka:", JSON.stringify(newItem, null, 2));
        resultCartItem = newItem;
      }

      // Provjeri stanje košarice nakon ažuriranja
      const updatedCartItems = await db
        .select()
        .from(cartItems)
        .where(eq(cartItems.userId, itemData.userId));
      console.log(
        "DEBUG: Stanje košarice nakon akcije:",
        JSON.stringify(updatedCartItems, null, 2),
      );

      console.log(
        "========== DODAVANJE U KOŠARICU ZAVRŠENO (NOVA METODA v2) ==========",
      );
      return resultCartItem;
    } catch (error) {
      console.error("ERROR: Greška prilikom dodavanja u košaricu:", error);
      throw error;
    }
  }

  async updateCartItem(
    id: number,
    quantity: number,
    userId: number,
  ): Promise<CartItem | undefined> {
    const [updatedItem] = await db
      .update(cartItems)
      .set({ quantity })
      .where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)))
      .returning();
    return updatedItem;
  }

  async removeFromCart(id: number, userId: number): Promise<void> {
    await db
      .delete(cartItems)
      .where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)));
  }

  async clearCart(userId: number): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.userId, userId));
  }

  // Review methods
  async getProductReviews(productId: number): Promise<Review[]> {
    return await db
      .select()
      .from(reviews)
      .where(eq(reviews.productId, productId))
      .orderBy(desc(reviews.createdAt));
  }

  async createReview(reviewData: InsertReview): Promise<Review> {
    const [review] = await db.insert(reviews).values(reviewData).returning();
    return review;
  }

  // Settings methods
  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key));
    return setting;
  }

  async getAllSettings(): Promise<Setting[]> {
    return await db.select().from(settings);
  }

  async createSetting(settingData: InsertSetting): Promise<Setting> {
    const [setting] = await db.insert(settings).values(settingData).returning();
    return setting;
  }

  async updateSetting(
    key: string,
    value: string,
  ): Promise<Setting | undefined> {
    const [updatedSetting] = await db
      .update(settings)
      .set({ value })
      .where(eq(settings.key, key))
      .returning();
    return updatedSetting;
  }

  async deleteSetting(key: string): Promise<void> {
    await db.delete(settings).where(eq(settings.key, key));
  }

  // Stranice (Pages) methods
  async getPage(id: number): Promise<Page | undefined> {
    const [page] = await db.select().from(pages).where(eq(pages.id, id));
    return page;
  }

  async getPageByType(type: string): Promise<Page | undefined> {
    const [page] = await db.select().from(pages).where(eq(pages.type, type));
    return page;
  }

  async getAllPages(): Promise<Page[]> {
    return await db.select().from(pages);
  }

  async createPage(pageData: InsertPage): Promise<Page> {
    const [page] = await db.insert(pages).values(pageData).returning();
    return page;
  }

  async updatePage(
    id: number,
    pageData: Partial<InsertPage>,
  ): Promise<Page | undefined> {
    const [updatedPage] = await db
      .update(pages)
      .set(pageData)
      .where(eq(pages.id, id))
      .returning();
    return updatedPage;
  }

  async deletePage(id: number): Promise<void> {
    await db.delete(pages).where(eq(pages.id, id));
  }

  // Collection methods
  async getCollection(id: number): Promise<Collection | undefined> {
    const [collection] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, id));
    return collection;
  }

  async getAllCollections(): Promise<Collection[]> {
    return await db.select().from(collections);
  }

  async getActiveCollections(): Promise<Collection[]> {
    return await db
      .select()
      .from(collections)
      .where(eq(collections.active, true));
  }

  async getFeaturedCollections(): Promise<Collection[]> {
    return await db
      .select()
      .from(collections)
      .where(eq(collections.featured, true));
  }

  async createCollection(
    collectionData: InsertCollection,
  ): Promise<Collection> {
    const [collection] = await db
      .insert(collections)
      .values(collectionData)
      .returning();
    return collection;
  }

  async updateCollection(
    id: number,
    collectionData: Partial<InsertCollection>,
  ): Promise<Collection | undefined> {
    const [updatedCollection] = await db
      .update(collections)
      .set(collectionData)
      .where(eq(collections.id, id))
      .returning();
    return updatedCollection;
  }

  async deleteCollection(id: number): Promise<void> {
    await db.delete(collections).where(eq(collections.id, id));
  }

  async getCollectionProducts(
    collectionId: number,
    includeInactive: boolean = false,
  ): Promise<Product[]> {
    // JOIN preko productCollections tabele
    const joinedProducts = await db.query.productCollections.findMany({
      where: eq(productCollections.collectionId, collectionId),
      with: {
        product: true,
      },
    });

    // Izvuci samo product objekte iz rezultata i filtriraj neaktivne proizvode ako je potrebno
    if (includeInactive) {
      return joinedProducts.map((item) => item.product);
    } else {
      return joinedProducts
        .map((item) => item.product)
        .filter((product) => product.active === true);
    }
  }

  async addProductToCollection(
    productId: number,
    collectionId: number,
  ): Promise<ProductCollection> {
    const [productCollection] = await db
      .insert(productCollections)
      .values({ productId, collectionId })
      .returning();
    return productCollection;
  }

  async removeProductFromCollection(
    productId: number,
    collectionId: number,
  ): Promise<void> {
    await db
      .delete(productCollections)
      .where(
        and(
          eq(productCollections.productId, productId),
          eq(productCollections.collectionId, collectionId),
        ),
      );
  }

  // Invoice methods
  async getInvoice(id: number): Promise<Invoice | undefined> {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, id));
    return invoice;
  }

  async getInvoiceByNumber(
    invoiceNumber: string,
  ): Promise<Invoice | undefined> {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, invoiceNumber));
    return invoice;
  }

  async getAllInvoices(): Promise<Invoice[]> {
    return await db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async getUserInvoices(userId: number): Promise<Invoice[]> {
    return await db
      .select()
      .from(invoices)
      .where(eq(invoices.userId, userId))
      .orderBy(desc(invoices.createdAt));
  }

  async createInvoice(
    invoiceData: InsertInvoice,
    items: InsertInvoiceItem[],
  ): Promise<Invoice> {
    // Create the invoice
    const [invoice] = await db.insert(invoices).values(invoiceData).returning();

    // Create the invoice items with the invoice ID
    if (items.length > 0) {
      await db.insert(invoiceItems).values(
        items.map((item) => ({
          ...item,
          invoiceId: invoice.id,
        })),
      );
    }

    return invoice;
  }

  async getInvoiceItems(invoiceId: number): Promise<InvoiceItem[]> {
    console.log(`Dohvaćanje stavki računa ID: ${invoiceId}`);

    const items = await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoiceId));

    console.log(
      `Dohvaćeno ${items.length} stavki računa:`,
      JSON.stringify(items, null, 2),
    );

    return items;
  }

  async deleteInvoice(id: number): Promise<void> {
    // First delete all invoice items
    await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));

    // Then delete the invoice
    await db.delete(invoices).where(eq(invoices.id, id));
  }

  // Metode za rukovanje posjetima stranice
  async incrementPageVisit(path: string): Promise<PageVisit> {
    // Prvo pokušaj pronaći postojeći zapis za putanju
    const [existingVisit] = await db
      .select()
      .from(pageVisits)
      .where(eq(pageVisits.path, path));

    if (existingVisit) {
      // Ažuriraj broj posjeta ako postoji
      const [updatedVisit] = await db
        .update(pageVisits)
        .set({
          count: existingVisit.count + 1,
          lastVisited: new Date(),
        })
        .where(eq(pageVisits.id, existingVisit.id))
        .returning();
      return updatedVisit;
    } else {
      // Kreiraj novi zapis ako ne postoji
      const [newVisit] = await db
        .insert(pageVisits)
        .values({
          path,
          count: 1,
        })
        .returning();
      return newVisit;
    }
  }

  async getPageVisit(path: string): Promise<PageVisit | undefined> {
    const [visit] = await db
      .select()
      .from(pageVisits)
      .where(eq(pageVisits.path, path));
    return visit;
  }

  async getAllPageVisits(): Promise<PageVisit[]> {
    return db.select().from(pageVisits).orderBy(desc(pageVisits.count));
  }

  // Newsletter subscribers methods
  async getAllSubscribers(): Promise<Subscriber[]> {
    return db.select().from(subscribers).orderBy(desc(subscribers.createdAt));
  }

  async getSubscriberByEmail(email: string): Promise<Subscriber | undefined> {
    try {
      const [subscriber] = await db
        .select()
        .from(subscribers)
        .where(eq(subscribers.email, email));
      return subscriber;
    } catch (error) {
      console.error("Error fetching subscriber by email:", error);
      return undefined;
    }
  }

  async getSubscriberByDiscountCode(
    code: string,
  ): Promise<Subscriber | undefined> {
    try {
      const [subscriber] = await db
        .select()
        .from(subscribers)
        .where(eq(subscribers.discountCode, code));
      return subscriber;
    } catch (error) {
      console.error("Error fetching subscriber by discount code:", error);
      return undefined;
    }
  }

  async createSubscriber(data: InsertSubscriber): Promise<Subscriber> {
    try {
      console.log("Inserting subscriber with data:", data);
      const [subscriber] = await db
        .insert(subscribers)
        .values(data)
        .returning();
      console.log("Created subscriber:", subscriber);
      return subscriber;
    } catch (error) {
      console.error("Error creating subscriber:", error);
      throw error;
    }
  }

  async markDiscountAsUsed(email: string): Promise<boolean> {
    try {
      await db
        .update(subscribers)
        .set({ discountUsed: true })
        .where(eq(subscribers.email, email));
      return true;
    } catch (error) {
      console.error("Error marking discount as used:", error);
      return false;
    }
  }

  // Email verification methods
  async verifyUserEmail(userId: number): Promise<User | undefined> {
    try {
      const [user] = await db
        .update(users)
        .set({ emailVerified: true })
        .where(eq(users.id, userId))
        .returning();

      return user;
    } catch (error) {
      console.error("Error verifying user email:", error);
      return undefined;
    }
  }

  async createVerificationToken(
    tokenData: InsertVerificationToken,
  ): Promise<VerificationToken> {
    try {
      const [token] = await db
        .insert(verificationTokens)
        .values(tokenData)
        .returning();

      return token;
    } catch (error) {
      console.error("Error creating verification token:", error);
      throw error;
    }
  }

  async getVerificationToken(
    tokenString: string,
  ): Promise<VerificationToken | undefined> {
    try {
      const [token] = await db
        .select()
        .from(verificationTokens)
        .where(eq(verificationTokens.token, tokenString));

      return token;
    } catch (error) {
      console.error("Error getting verification token:", error);
      return undefined;
    }
  }

  async deleteVerificationToken(tokenString: string): Promise<void> {
    try {
      await db
        .delete(verificationTokens)
        .where(eq(verificationTokens.token, tokenString));
    } catch (error) {
      console.error("Error deleting verification token:", error);
      throw error;
    }
  }
}
