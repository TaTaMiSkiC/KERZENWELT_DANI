import { db } from "./db";
import {
  users,
  categories,
  products,
  settings,
  companyDocuments,
} from "@shared/schema";
import { hashPassword } from "./auth";
import { eq, sql } from "drizzle-orm";

// Funkcija za provjeru i inicijalizaciju baze podataka
export async function initializeDatabase() {
  console.log("Inicijalizacija baze podataka...");

  // Provjeri postojanje administratora
  const adminExists = await checkAdminExists();
  if (!adminExists) {
    await createDefaultAdmin();
  }

  // Provjeri postojanje kategorija
  const categoriesExist = await checkCategoriesExist();
  if (!categoriesExist) {
    await createDefaultCategories();
  }

  // Provjeri postojanje proizvoda
  const productsExist = await checkProductsExist();
  if (!productsExist) {
    await createDefaultProducts();
  }

  // Provjeri postojanje postavki
  const settingsExist = await checkSettingsExist();
  if (!settingsExist) {
    await createDefaultSettings();
  }

  // Provjeri postojanje kontakt postavki
  const contactSettingsExist = await checkContactSettingsExist();
  if (!contactSettingsExist) {
    await createDefaultContactSettings();
  }

  // Provjeri postojanje općih postavki
  const generalSettingsExist = await checkGeneralSettingsExist();
  if (!generalSettingsExist) {
    await createDefaultGeneralSettings();
  }

  try {
    // Provjeri prisutnost tablice za dokumente tvrtke
    // console.log("Provjera postojanja tablice za dokumente tvrtke...");
    await db.select().from(companyDocuments).limit(1);
    // console.log("Tablica za dokumente tvrtke već postoji");
  } catch (error) {
    // Ako tablica ne postoji, drizzle će automatski stvoriti tablicu kada se
    // pokuša pristupiti nepostojećoj tablici kroz drizzle orm.
    // console.log("Kreiranje tablice za dokumente tvrtke...");
  }

  // console.log("Inicijalizacija baze podataka završena");
}

// Funkcija za provjeru postoji li admin korisnik
async function checkAdminExists() {
  const [admin] = await db.select().from(users).where(eq(users.isAdmin, true));
  return !!admin;
}

// Funkcija za stvaranje admin korisnika
async function createDefaultAdmin() {
  console.log("Kreiranje admin korisnika...");
  const hashedPassword = await hashPassword("Marija2401");

  await db.insert(users).values([
    {
      username: "admin",
      password: hashedPassword,
      email: "admin@example.com",
      isAdmin: true,
      firstName: "Admin",
      lastName: "User",
    },
    {
      username: "MiskicAdmin",
      password: hashedPassword,
      email: "v.miskic2@gmail.com",
      isAdmin: true,
      firstName: "Admin",
      lastName: "Vinko Miskic",
    },
  ]);

  console.log("Admin korisnik uspješno kreiran");
}

// Funkcija za provjeru postojanja kategorija
async function checkCategoriesExist() {
  const count = await db.select({ count: sql`count(*)` }).from(categories);
  return Number(count[0].count) > 0;
}

// Funkcija za stvaranje zadanih kategorija
async function createDefaultCategories() {
  console.log("Kreiranje kategorija...");

  await db.insert(categories).values([
    // {
    //   name: "Kerzenbox",
    //   description: "Kolekcija ručno izrađenih svijeća",
    //   imageUrl: "https://images.unsplash.com/photo-1603204077779-bed963ea7d0e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=880&q=80"
    // },
    // {
    //   name: "Dekorativne svijeće",
    //   description: "Jedinstvene dekorativne svijeće za vaš dom",
    //   imageUrl: "https://images.unsplash.com/photo-1574263039840-82c0aa6c0a68?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=880&q=80"
    // },
    // {
    //   name: "Posebne prigode",
    //   description: "Svijeće za vjenčanja, rođendane i posebne prilike",
    //   imageUrl: "https://images.unsplash.com/photo-1634317542867-0afe3dc09511?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=880&q=80"
    // }
  ]);

  console.log("Kategorije uspješno kreirane");
}

// Funkcija za provjeru postojanja proizvoda
async function checkProductsExist() {
  const count = await db.select({ count: sql`count(*)` }).from(products);
  return Number(count[0].count) > 0;
}

// Funkcija za stvaranje zadanih proizvoda
async function createDefaultProducts() {
  console.log("Kreiranje proizvoda...");

  // Dohvati kategorije
  const categoryList = await db.select().from(categories);
  const mirisneKategorija = categoryList.find(
    (cat) => cat.name === "Mirisne svijeće",
  );
  const dekorativneKategorija = categoryList.find(
    (cat) => cat.name === "Dekorativne svijeće",
  );

  if (!mirisneKategorija || !dekorativneKategorija) {
    console.error("Kategorije nisu pronađene");
    return;
  }

  await db.insert(products).values([
    // {
    //   name: "Vanilla Dreams",
    //   description: "Bogata i topla mirisna svijeća s aromom vanilije za ugodan dom.",
    //   price: "25.99",
    //   imageUrl: "https://images.unsplash.com/photo-1608181831718-c9ffd8685222?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=880&q=80",
    //   categoryId: mirisneKategorija.id,
    //   stock: 12,
    //   scent: "Vanilija",
    //   color: "Krem",
    //   burnTime: "40-50 sati",
    //   featured: true
    // },
    // {
    //   name: "Lavender Relax",
    //   description: "Opuštajuća svijeća s mirisom lavande idealna za spavaću sobu ili kupaonicu.",
    //   price: "22.99",
    //   imageUrl: "https://images.unsplash.com/photo-1607892379596-fb30e44508b5?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=880&q=80",
    //   categoryId: mirisneKategorija.id,
    //   stock: 15,
    //   scent: "Lavanda",
    //   color: "Ljubičasta",
    //   burnTime: "35-45 sati",
    //   featured: true
    // },
    // {
    //   name: "Marble Pillar",
    //   description: "Elegantna mramorna dekorativna svijeća koja će se uklopiti u svaki dom.",
    //   price: "34.99",
    //   imageUrl: "https://images.unsplash.com/photo-1636977564078-d5a893af0564?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=880&q=80",
    //   categoryId: dekorativneKategorija.id,
    //   stock: 10,
    //   color: "Crno-bijela",
    //   burnTime: "60-70 sati",
    //   featured: true
    // }
  ]);

  console.log("Proizvodi uspješno kreirani");
}

// Funkcija za provjeru postojanja postavki
async function checkSettingsExist() {
  const count = await db.select({ count: sql`count(*)` }).from(settings);
  return Number(count[0].count) > 0;
}

// Funkcija za stvaranje zadanih postavki
async function createDefaultSettings() {
  console.log("Kreiranje postavki dostave...");

  await db.insert(settings).values([
    {
      key: "freeShippingThreshold",
      value: "50",
    },
    {
      key: "standardShippingRate",
      value: "5",
    },
    {
      key: "expressShippingRate",
      value: "15",
    },
  ]);

  console.log("Postavke dostave uspješno kreirane");
}

// Funkcija za provjeru postojanja kontakt postavki
async function checkContactSettingsExist() {
  const [setting] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "contact_address"));
  return !!setting;
}

// Funkcija za stvaranje zadanih kontakt postavki
async function createDefaultContactSettings() {
  console.log("Kreiranje kontakt postavki...");

  await db.insert(settings).values([
    {
      key: "contact_address",
      value: "Villach",
    },
    {
      key: "contact_city",
      value: "Villach",
    },
    {
      key: "contact_postal_code",
      value: "9500",
    },
    {
      key: "contact_phone",
      value: "00436603878221",
    },
    {
      key: "contact_email",
      value: "info@kerzenweltbydani.com",
    },
    {
      key: "contact_working_hours",
      value: "Mo - Fr: 13:00 - 20:00",
    },
  ]);

  console.log("Kontakt postavke uspješno kreirane");
}

// Funkcija za provjeru postojanja općih postavki
async function checkGeneralSettingsExist() {
  const [setting] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "store_name"));
  return !!setting;
}

// Funkcija za stvaranje zadanih općih postavki
async function createDefaultGeneralSettings() {
  console.log("Kreiranje općih postavki...");

  await db.insert(settings).values([
    {
      key: "store_name",
      value: "Kerzenwelt by Dani",
    },
    {
      key: "store_email",
      value: "info@kerzenweltbydani.com",
    },
    {
      key: "store_phone",
      value: "00436603878221",
    },
    {
      key: "store_address",
      value: "Ossiacher Zeile 30",
    },
  ]);

  console.log("Opće postavke uspješno kreirane");
}
