import { drizzle } from 'drizzle-orm/neon-serverless';
import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from './shared/schema';
import { sql } from 'drizzle-orm';

// Setup websocket for Neon connection
neonConfig.webSocketConstructor = ws;

// Connect to database
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function createTables() {
  console.log('Starting database setup...');

  try {
    // Create users table
    console.log('Creating users table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        first_name TEXT,
        last_name TEXT,
        address TEXT,
        city TEXT,
        postal_code TEXT,
        country TEXT,
        phone TEXT,
        is_admin BOOLEAN NOT NULL DEFAULT false,
        email_verified BOOLEAN NOT NULL DEFAULT false,
        discount_amount DECIMAL(10, 2) DEFAULT 0,
        discount_minimum_order DECIMAL(10, 2) DEFAULT 0,
        discount_expiry_date TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create verification_tokens table
    console.log('Creating verification_tokens table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS verification_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create products table
    console.log('Creating products table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        image_url TEXT,
        category_id INTEGER,
        stock INTEGER NOT NULL DEFAULT 0,
        scent TEXT,
        color TEXT,
        burn_time TEXT,
        featured BOOLEAN NOT NULL DEFAULT false,
        has_color_options BOOLEAN NOT NULL DEFAULT true,
        allow_multiple_colors BOOLEAN NOT NULL DEFAULT false,
        active BOOLEAN NOT NULL DEFAULT true,
        dimensions TEXT,
        weight TEXT,
        materials TEXT,
        instructions TEXT,
        maintenance TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create categories table
    console.log('Creating categories table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        image_url TEXT
      );
    `);

    // Create scents table
    console.log('Creating scents table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS scents (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        active BOOLEAN NOT NULL DEFAULT true
      );
    `);

    // Create colors table
    console.log('Creating colors table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS colors (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        hex_value TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT true
      );
    `);

    // Create orders table
    console.log('Creating orders table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        total DECIMAL(10, 2) NOT NULL,
        subtotal DECIMAL(10, 2),
        discount_amount DECIMAL(10, 2) DEFAULT 0,
        shipping_cost DECIMAL(10, 2) DEFAULT 0,
        payment_method TEXT NOT NULL,
        payment_status TEXT NOT NULL DEFAULT 'pending',
        customer_note TEXT,
        shipping_address TEXT,
        shipping_city TEXT,
        shipping_postal_code TEXT,
        shipping_country TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create order_items table
    console.log('Creating order_items table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT,
        quantity INTEGER NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        scent_id INTEGER,
        scent_name TEXT,
        color_id INTEGER,
        color_name TEXT,
        color_ids TEXT,
        has_multiple_colors BOOLEAN NOT NULL DEFAULT false
      );
    `);

    // Create cart_items table
    console.log('Creating cart_items table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cart_items (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        scent_id INTEGER,
        color_id INTEGER,
        color_name TEXT,
        color_ids TEXT,
        has_multiple_colors BOOLEAN NOT NULL DEFAULT false
      );
    `);

    // Create product_scents table
    console.log('Creating product_scents table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS product_scents (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL,
        scent_id INTEGER NOT NULL
      );
    `);

    // Create product_colors table
    console.log('Creating product_colors table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS product_colors (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL,
        color_id INTEGER NOT NULL
      );
    `);

    // Create reviews table
    console.log('Creating reviews table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        rating INTEGER NOT NULL,
        comment TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create settings table
    console.log('Creating settings table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create pages table
    console.log('Creating pages table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pages (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create collections table
    console.log('Creating collections table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS collections (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        image_url TEXT,
        featured_on_home BOOLEAN NOT NULL DEFAULT false,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create product_collections table
    console.log('Creating product_collections table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS product_collections (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL,
        collection_id INTEGER NOT NULL
      );
    `);

    // Create invoices and invoice_items tables
    console.log('Creating invoices table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT now(),
        order_id INTEGER,
        invoice_number VARCHAR(255) NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255),
        customer_address VARCHAR(255),
        customer_city VARCHAR(255),
        customer_postal_code VARCHAR(255),
        customer_country VARCHAR(255),
        customer_phone VARCHAR(255),
        subtotal VARCHAR(255) NOT NULL,
        tax VARCHAR(255) NOT NULL,
        total VARCHAR(255) NOT NULL,
        language VARCHAR(255) NOT NULL
      );
    `);

    console.log('Creating invoice_items table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL,
        price VARCHAR(255) NOT NULL,
        selected_scent VARCHAR(255),
        selected_color VARCHAR(255)
      );
    `);

    // Create page_visits table
    console.log('Creating page_visits table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS page_visits (
        id SERIAL PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        count INTEGER NOT NULL DEFAULT 0,
        last_visited TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create subscriber table for newsletter
    console.log('Creating subscriber table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS subscriber (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        discount_code TEXT NOT NULL,
        discount_used BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        language TEXT NOT NULL DEFAULT 'de'
      );
    `);

    console.log('Database setup completed successfully!');
  } catch (error) {
    console.error('Error setting up database:', error);
  } finally {
    await pool.end();
  }
}

createTables();