import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  decimal,
  timestamp,
  json,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  address: text("address"),
  city: text("city"),
  postalCode: text("postal_code"),
  country: text("country"),
  phone: text("phone"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(), // Whether email has been verified
  discountAmount: decimal("discount_amount", {
    precision: 10,
    scale: 2,
  }).default("0"),
  discountMinimumOrder: decimal("discount_minimum_order", {
    precision: 10,
    scale: 2,
  }).default("0"),
  discountExpiryDate: timestamp("discount_expiry_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  emailVerified: true,
});

// Email verification tokens
export const verificationTokens = pgTable("verification_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVerificationTokenSchema = createInsertSchema(
  verificationTokens,
).omit({
  id: true,
  createdAt: true,
});

export const verificationTokensRelations = relations(
  verificationTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [verificationTokens.userId],
      references: [users.id],
    }),
  }),
);

export type VerificationToken = typeof verificationTokens.$inferSelect;
export type InsertVerificationToken = z.infer<
  typeof insertVerificationTokenSchema
>;

// Products table
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  categoryId: integer("category_id"),
  stock: integer("stock").default(0).notNull(),
  scent: text("scent"), // Direktno pohranjen miris za proizvod
  color: text("color"), // Direktno pohranjena boja za proizvod
  burnTime: text("burn_time"),
  featured: boolean("featured").default(false).notNull(),
  hasColorOptions: boolean("has_color_options").default(true).notNull(), // Treba li proizvod imati opcije boja
  allowMultipleColors: boolean("allow_multiple_colors")
    .default(false)
    .notNull(), // Omogućuje odabir više boja
  active: boolean("active").default(true).notNull(), // Kontrolira je li proizvod vidljiv kupcima
  dimensions: text("dimensions"), // Dimenzije proizvoda
  weight: text("weight"), // Težina proizvoda
  materials: text("materials"), // Materijali od kojih je proizvod napravljen
  instructions: text("instructions"), // Upute za korištenje
  maintenance: text("maintenance"), // Upute za održavanje
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

// Categories table
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
});

// Scents table (mirisi)
export const scents = pgTable("scents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
});

export const insertScentSchema = createInsertSchema(scents).omit({
  id: true,
});

// Colors table (boje)
export const colors = pgTable("colors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  hexValue: text("hex_value").notNull(),
  active: boolean("active").default(true).notNull(),
});

export const insertColorSchema = createInsertSchema(colors).omit({
  id: true,
});

// Orders table
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  status: text("status").notNull().default("pending"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }),
  discountAmount: decimal("discount_amount", {
    precision: 10,
    scale: 2,
  }).default("0"),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).default(
    "0",
  ),
  paymentMethod: text("payment_method").notNull(),
  paymentStatus: text("payment_status").default("pending").notNull(),
  customerNote: text("customer_note"), // Napomena kupca
  shippingAddress: text("shipping_address"),
  shippingCity: text("shipping_city"),
  shippingPostalCode: text("shipping_postal_code"),
  shippingCountry: text("shipping_country"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
});

// Order items table
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  productId: integer("product_id").notNull(),
  productName: text("product_name"), // Dodajemo ime proizvoda za prikaz
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  // Dodajemo polja za varijante proizvoda
  scentId: integer("scent_id"),
  scentName: text("scent_name"),
  colorId: integer("color_id"),
  colorName: text("color_name"),
  // Polja za podršku višestrukih boja
  colorIds: text("color_ids"), // JSON string s nizom ID-jeva boja za višestruki odabir
  hasMultipleColors: boolean("has_multiple_colors").default(false).notNull(),
});

export const insertOrderItemSchema = createInsertSchema(orderItems)
  .omit({
    id: true,
  })
  .extend({
    colorIds: z.string().optional(),
    hasMultipleColors: z.boolean().optional(),
  });

// Cart items table
export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  productId: integer("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  scentId: integer("scent_id"),
  colorId: integer("color_id"),
  colorName: text("color_name"), // Ime boje ili spojeni nazivi više boja
  colorIds: text("color_ids"), // JSON string s nizom ID-jeva boja za višestruki odabir
  hasMultipleColors: boolean("has_multiple_colors").default(false).notNull(),
});

export const insertCartItemSchema = createInsertSchema(cartItems)
  .omit({
    id: true,
  })
  .extend({
    colorIds: z.string().optional(),
    hasMultipleColors: z.boolean().optional(),
  });

// Product-Scent relations table
export const productScents = pgTable("product_scents", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  scentId: integer("scent_id").notNull(),
});

export const insertProductScentSchema = createInsertSchema(productScents).omit({
  id: true,
});

// Product-Color relations table
export const productColors = pgTable("product_colors", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  colorId: integer("color_id").notNull(),
});

export const insertProductColorSchema = createInsertSchema(productColors).omit({
  id: true,
});

// Relations for product scents and colors
export const productScentsRelations = relations(productScents, ({ one }) => ({
  product: one(products, {
    fields: [productScents.productId],
    references: [products.id],
  }),
  scent: one(scents, {
    fields: [productScents.scentId],
    references: [scents.id],
  }),
}));

export const productColorsRelations = relations(productColors, ({ one }) => ({
  product: one(products, {
    fields: [productColors.productId],
    references: [products.id],
  }),
  color: one(colors, {
    fields: [productColors.colorId],
    references: [colors.id],
  }),
}));

export const scentsRelations = relations(scents, ({ many }) => ({
  productScents: many(productScents),
}));

export const colorsRelations = relations(colors, ({ many }) => ({
  productColors: many(productColors),
}));

// Reviews table
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  productId: integer("product_id").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});

// Define types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type Scent = typeof scents.$inferSelect;
export type InsertScent = z.infer<typeof insertScentSchema>;

export type Color = typeof colors.$inferSelect;
export type InsertColor = z.infer<typeof insertColorSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

// Definicija OrderItemWithProduct je premještena dolje u kodu

export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;

export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

export type ProductScent = typeof productScents.$inferSelect;
export type InsertProductScent = z.infer<typeof insertProductScentSchema>;

export type ProductColor = typeof productColors.$inferSelect;
export type InsertProductColor = z.infer<typeof insertProductColorSchema>;

// Define relationships between tables
export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  orderItems: many(orderItems),
  cartItems: many(cartItems),
  reviews: many(reviews),
  productScents: many(productScents),
  productColors: many(productColors),
  productCollections: many(productCollections),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
  user: one(users, {
    fields: [cartItems.userId],
    references: [users.id],
  }),
  scent: one(scents, {
    fields: [cartItems.scentId],
    references: [scents.id],
  }),
  color: one(colors, {
    fields: [cartItems.colorId],
    references: [colors.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, {
    fields: [reviews.productId],
    references: [products.id],
  }),
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id],
  }),
}));

// Extended CartItem type that includes product information
// Definiranje tablice za postavke
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSettingSchema = createInsertSchema(settings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for hero section settings
export const heroSettingsSchema = z.object({
  titleText: z.record(z.string(), z.string()), // Multi-language title text
  subtitleText: z.record(z.string(), z.string()), // Multi-language subtitle text
  titleFontSize: z.string().default("4xl md:text-5xl lg:text-6xl"),
  titleFontWeight: z.string().default("bold"),
  titleColor: z.string().default("white"),
  subtitleFontSize: z.string().default("lg md:text-xl"),
  subtitleFontWeight: z.string().default("normal"),
  subtitleColor: z.string().default("white opacity-90"),
});

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;

// Definicija tipa za objekt odabrane boje
export type SelectedColorInfo = {
  id: number;
  name: string | undefined;
  hexValue: string | null;
};

export type CartItemWithProduct = CartItem & {
  product: Product;
  scent?: Scent;
  color?: Color;
  // Dodatna polja za podršku višestrukih boja
  selectedColors?: SelectedColorInfo[];
  hasMultipleColors?: boolean;
};

export type OrderItemWithProduct = Omit<
  OrderItem,
  "scentId" | "colorId" | "scentName" | "colorName"
> & {
  product: Product;
  scent?: Scent;
  color?: Color;
  scentId: number | null;
  colorId: number | null;
  scentName: string | null;
  colorName: string | null;
  // hasMultipleColors je već prisutan u OrderItem
};

// Definiranje tablice za stranice (O nama, Kontakt, Blog)
export const pages = pgTable("pages", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().unique(), // "about", "contact", "blog"
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPageSchema = createInsertSchema(pages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Page = typeof pages.$inferSelect;
export type InsertPage = z.infer<typeof insertPageSchema>;

// Definiranje tablice za kolekcije
export const collections = pgTable("collections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url"),
  featuredOnHome: boolean("featured_on_home").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCollectionSchema = createInsertSchema(collections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Collection = typeof collections.$inferSelect;
export type InsertCollection = z.infer<typeof insertCollectionSchema>;

// Relacijska tablica između proizvoda i kolekcija
export const productCollections = pgTable("product_collections", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  collectionId: integer("collection_id").notNull(),
});

export const insertProductCollectionSchema = createInsertSchema(
  productCollections,
).omit({
  id: true,
});

export type ProductCollection = typeof productCollections.$inferSelect;
export type InsertProductCollection = z.infer<
  typeof insertProductCollectionSchema
>;

// Relacije za kolekcije
export const collectionsRelations = relations(collections, ({ many }) => ({
  productCollections: many(productCollections),
}));

// Dodajemo relacije za proizvode s kolekcijama
export const productCollectionsRelations = relations(
  productCollections,
  ({ one }) => ({
    product: one(products, {
      fields: [productCollections.productId],
      references: [products.id],
    }),
    collection: one(collections, {
      fields: [productCollections.collectionId],
      references: [collections.id],
    }),
  }),
);

// Tablica za račune
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull(),
  orderId: integer("order_id"),
  userId: integer("user_id").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerAddress: text("customer_address"),
  customerCity: text("customer_city"),
  customerPostalCode: text("customer_postal_code"),
  customerCountry: text("customer_country"),
  customerPhone: text("customer_phone"),
  customerNote: text("customer_note"), // Napomena kupca
  paymentMethod: text("payment_method").default("cash").notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).notNull(),
  language: text("language").default("hr").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
});

// Tablica za stavke računa
export const invoiceItems = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull(),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  selectedScent: text("selected_scent"),
  selectedColor: text("selected_color"),
});

export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({
  id: true,
});

// Definiranje tipova za račune
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;

// Relacije za račune
export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  order: one(orders, {
    fields: [invoices.orderId],
    references: [orders.id],
  }),
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
  product: one(products, {
    fields: [invoiceItems.productId],
    references: [products.id],
  }),
}));

// Tablica za dokumente firme
export const companyDocuments = pgTable("company_documents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull(), // npr. pdf, docx, xlsx
  fileSize: integer("file_size").notNull(), // veličina u bajtovima
  uploadedBy: integer("uploaded_by").notNull(), // ID korisnika koji je dodao dokument
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const insertCompanyDocumentSchema = createInsertSchema(
  companyDocuments,
).omit({
  id: true,
  uploadedAt: true,
});

export type CompanyDocument = typeof companyDocuments.$inferSelect;
export type InsertCompanyDocument = z.infer<typeof insertCompanyDocumentSchema>;

export const companyDocumentsRelations = relations(
  companyDocuments,
  ({ one }) => ({
    uploader: one(users, {
      fields: [companyDocuments.uploadedBy],
      references: [users.id],
    }),
  }),
);

// Tablica za praćenje posjeta na stranici
export const pageVisits = pgTable("page_visits", {
  id: serial("id").primaryKey(),
  path: text("path").notNull(),
  count: integer("count").default(0).notNull(),
  lastVisited: timestamp("last_visited").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPageVisitSchema = createInsertSchema(pageVisits).omit({
  id: true,
  createdAt: true,
  lastVisited: true,
});

export type PageVisit = typeof pageVisits.$inferSelect;
export type InsertPageVisit = z.infer<typeof insertPageVisitSchema>;

// Newsletter subscribers
export const subscribers = pgTable("subscriber", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  discountCode: text("discount_code").notNull(),
  discountUsed: boolean("discount_used").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  language: text("language").notNull().default("de"),
});

export const insertSubscriberSchema = createInsertSchema(subscribers).omit({
  id: true,
  createdAt: true,
  discountUsed: true,
});

export const subscriberSchema = z.object({
  email: z.string().email("Gültige E-Mail-Adresse erforderlich"),
  language: z.string().default("de"),
});

export type Subscriber = typeof subscribers.$inferSelect;
export type InsertSubscriber = z.infer<typeof insertSubscriberSchema>;
