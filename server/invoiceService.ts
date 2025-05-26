import { db } from "./db";
import { storage } from "./storage";
import { 
  orders, 
  invoices, 
  invoiceItems,
  users
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export interface InvoiceGenerationOptions {
  language?: string;
}

/**
 * Generira račun za navedenu narudžbu
 * @param orderId ID narudžbe za koju se generira račun
 * @param options Dodatne opcije (jezik itd.)
 * @returns ID kreiranog računa ili null u slučaju greške
 */
export async function generateInvoiceFromOrder(
  orderIdParam: number, 
  options: InvoiceGenerationOptions = {}
): Promise<number | null> {
  try {
    console.log(`Pokretanje generiranja računa za narudžbu ${orderIdParam}...`);
    
    // Dohvati narudžbu
    const order = await storage.getOrder(orderIdParam);
    
    if (!order) {
      console.error(`Narudžba s ID: ${orderIdParam} nije pronađena`);
      return null;
    }
    
    // Dohvati korisnika
    const user = await storage.getUser(order.userId);
    
    if (!user) {
      console.error(`Korisnik s ID: ${order.userId} nije pronađen`);
      return null;
    }
    
    // Dohvati stavke narudžbe s proizvod detaljima
    const orderItems = await storage.getOrderItems(orderIdParam);
    
    if (orderItems.length === 0) {
      console.error(`Narudžba s ID: ${orderIdParam} nema stavki`);
      return null;
    }
    
    // Provjeri postoji li već račun za ovu narudžbu
    const existingInvoices = await db
      .select()
      .from(invoices)
      .where(eq(invoices.orderId, orderIdParam));
    
    if (existingInvoices.length > 0) {
      console.log(`Račun za narudžbu ${orderIdParam} već postoji (ID: ${existingInvoices[0].id})`);
      return existingInvoices[0].id;
    }
    
    // Generiraj broj računa - koristimo isti broj kao narudžba, ali s 'i' prefiksom
    // Potrebno je osigurati da nikad nemamo duplikate
    const invoicePrefix = 'i';
    let invoiceNumber;
    
    // Dohvati posljednji račun iz baze sortirano po ID-ju silazno
    const lastInvoice = await db
      .select()
      .from(invoices)
      .orderBy(desc(invoices.id))
      .limit(1);
    
    // Početni broj računa je 450
    const baseNumber = 450;
    
    // Ako postoji prethodni račun, izvuci broj iz njegovog broja računa
    let lastInvoiceNumber = baseNumber - 1; // Početno stanje ako nema prethodnih računa
    
    if (lastInvoice.length > 0 && lastInvoice[0].invoiceNumber) {
      // Izvuci broj iz formata "i450" -> 450
      const matches = lastInvoice[0].invoiceNumber.match(/i(\d+)/);
      if (matches && matches[1]) {
        lastInvoiceNumber = parseInt(matches[1]);
      }
    }
    
    // Generiraj sljedeći broj računa - uvijek povećaj za 1 od posljednjeg
    const nextInvoiceNumber = lastInvoiceNumber + 1;
    invoiceNumber = `${invoicePrefix}${nextInvoiceNumber}`;
    
    console.log(`Generiranje računa za narudžbu ${order.id}, broj računa: ${invoiceNumber}`);
    
    // Pripremi podatke za račun
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    
    const invoiceData = {
      invoiceNumber,
      orderId: order.id,
      userId: order.userId,
      customerName: fullName,
      customerEmail: user.email,
      customerAddress: order.shippingAddress,
      customerCity: order.shippingCity,
      customerPostalCode: order.shippingPostalCode,
      customerCountry: order.shippingCountry,
      customerPhone: user.phone || null, // Koristimo telefon iz korisničkih podataka
      customerNote: order.customerNote,
      total: order.total,
      subtotal: order.subtotal || "0.00",
      tax: "0.00", // Austrija nema PDV za male poduzetnike
      paymentMethod: order.paymentMethod,
      language: options.language || "hr" // Default to Croatian if not specified
    };
    
    console.log("Kreiranje računa s podacima:", invoiceData);
    
    // Spremi račun u bazu
    const [invoice] = await db
      .insert(invoices)
      .values(invoiceData)
      .returning();
    
    console.log(`Kreiran račun ${invoice.invoiceNumber} (ID: ${invoice.id})`);
    
    // Spremi stavke računa
    console.log("Sve stavke narudžbe za unos u račun:", JSON.stringify(orderItems, null, 2));
    
    for (const item of orderItems) {
      try {
        const invoiceItem = {
          invoiceId: invoice.id,
          productId: item.productId,
          productName: item.productName || "Nepoznat proizvod", // Osiguramo da nikad nije null
          quantity: item.quantity,
          price: item.price,
          selectedScent: item.scentName || null,
          selectedColor: item.colorName || null
        };
        
        console.log("Dodajem stavku računa:", JSON.stringify(invoiceItem, null, 2));
        
        await db.insert(invoiceItems).values([invoiceItem]);
        console.log(`Uspješno dodana stavka računa: ${item.productName}, količina: ${item.quantity}`);
      } catch (itemError) {
        console.error(`Greška pri dodavanju stavke (${item.productName}) računa:`, itemError);
      }
    }
    
    console.log(`Uspješno kreiran račun ${invoiceNumber} za narudžbu ${orderIdParam}`);
    return invoice.id;
  } catch (error) {
    console.error("Greška kod generiranja računa:", error);
    return null;
  }
}