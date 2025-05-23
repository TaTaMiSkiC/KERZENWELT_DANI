import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./initDb";
import { initDatabase } from "./db";
import compression from "compression";

const app = express();
// Dodajemo kompresiju za brži prijenos podataka
app.use(compression({
  level: 9, // Maksimalna kompresija za sve resurse
  threshold: 0, // Kompresija za sve veličine odgovora
  filter: (req, res) => {
    if (req.headers['accept-encoding']?.includes('gzip')) {
      // Ne kompresiraj već komprimirane formate
      const type = res.getHeader('Content-Type');
      if (type && 
         (type.toString().includes('image/webp') || 
          type.toString().includes('image/png') || 
          type.toString().includes('image/jpeg') || 
          type.toString().includes('image/gif') || 
          type.toString().includes('application/font-woff') || 
          type.toString().includes('application/font-woff2'))) {
        return false;
      }
      return true;
    }
    return false;
  }
}));

// Middleware za kompresiju
app.use(compression({
  level: 9, // Maksimalni nivo kompresije
  threshold: 0, // Kompresija svih odgovora bez obzira na veličinu
  filter: (req, res) => {
    // Ne kompresiraj već kompresovane resurse
    if (req.headers['accept-encoding']?.includes('gzip') === false) return false;
    const contentType = res.getHeader('Content-Type') as string || '';
    return /text|javascript|json|css|svg|html|xml/.test(contentType);
  }
}));

// Middleware za HTTP zaglavlja performansi i sigurnosti
app.use((req, res, next) => {
  // Dodajemo zaglavlja za poboljšanje sigurnosti
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Dodatna sigurnosna i performance poboljšanja
  res.setHeader('X-DNS-Prefetch-Control', 'on');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Postavke cache kontrole bazirane na tipu resursa
  const url = req.url.toLowerCase();
  if (url.match(/\.(js|css|json)$/)) {
    // Agresivni cache za statičke resurse
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // Dodaj Brotli/Gzip kompresiju za JavaScript i CSS
    if (url.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Vary', 'Accept-Encoding');
    } else if (url.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      res.setHeader('Vary', 'Accept-Encoding');
    }
  } else if (url.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/)) {
    // Agresivni cache za slike
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Vary', 'Accept');
    
    // Poboljšani Content-Type za moderne formate slika
    if (url.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    } else if (url.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    }
  } else if (url.match(/\.(woff|woff2|ttf|eot)$/)) {
    // Agresivni cache za fontove
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (url === '/' || url === '/index.html') {
    // Umjeren cache za glavnu stranicu
    res.setHeader('Cache-Control', 'public, max-age=3600');
  } else {
    // Default cache za ostalo
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
  
  // Optimizacija za preuzimanje kritičnih resursa
  if (req.url === '/' || req.url === '/index.html') {
    // Dodajemo preload za kritične resurse na glavnoj stranici
    res.setHeader('Link', '<logo.webp>; rel=preload; as=image; fetchpriority=high, </src/main.tsx>; rel=preload; as=script');
    
    // Preconnect s ključnim vanjskim domenama
    res.setHeader('Link', '<https://fonts.googleapis.com>; rel=preconnect; crossorigin, <https://fonts.gstatic.com>; rel=preconnect; crossorigin');
  }
  
  // Za statičke resurse postavljamo optimizirano keširanje
  if (req.url.match(/\.(css|js)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 godina za CSS i JS
    
    // Dodajemo kompresiju za JavaScript
    if (req.url.endsWith('.js')) {
      res.setHeader('Content-Encoding', 'gzip');
    }
  } else if (req.url.match(/\.(png|jpg|jpeg|gif|webp|avif|ico|svg)$/)) {
    // Za slike dodajemo posebne optimizacije
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 godina za slike
    
    // Dodaj width i height atribute za sve slike (kako bi smanjili CLS)
    if (req.headers.accept && req.headers.accept.includes('image/webp')) {
      res.setHeader('Vary', 'Accept');
    }
  } else if (req.url.match(/\.(woff|woff2|ttf|eot)$/)) {
    // Posebno keširanje za fontove
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 godina za fontove
  }
  
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Inicijaliziraj bazu podataka prije registriranja ruta
  try {
    await initializeDatabase();
    // Također inicijaliziraj i tablice za račune
    await initDatabase();
    console.log("Baza podataka je uspješno inicijalizirana");
  } catch (error) {
    console.error("Greška prilikom inicijalizacije baze podataka:", error);
  }
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
