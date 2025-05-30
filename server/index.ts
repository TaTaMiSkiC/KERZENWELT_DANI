import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./initDb";
import { initDatabase } from "./db";
import { handleStripeWebhook } from "./stripeWebhookHandler";
import compression from "compression";

const app = express();
// Dodajemo kompresiju za brži prijenos podataka
app.use(
  compression({
    level: 6, // Balans između brzine kompresije i omjera kompresije
    threshold: 0, // Kompresija za sve veličine odgovora
  }),
);

// Middleware za HTTP zaglavlja performansi i sigurnosti
app.use((req, res, next) => {
  // Dodajemo zaglavlja za poboljšanje sigurnosti
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Za statičke resurse postavljamo optimizirano keširanje
  if (req.url.match(/\.(css|js)$/)) {
    res.setHeader("Cache-Control", "public, max-age=31536000"); // 1 godina za CSS i JS
  } else if (req.url.match(/\.(png|jpg|jpeg|gif|webp|avif|ico|svg)$/)) {
    res.setHeader("Cache-Control", "public, max-age=31536000"); // 1 godina za slike
  } else if (req.url.match(/\.(woff|woff2|ttf|eot)$/)) {
    res.setHeader("Cache-Control", "public, max-age=31536000"); // 1 godina za fontove
  }

  next();
});

// Webhook ruta MORA biti prije JSON parsiranja
app.post(
  "/api/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    await handleStripeWebhook(req, res);
  },
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ✅ OVDJE DODAJTE KOD ZA /api/client-log RUTU
app.post("/api/client-log", (req, res) => {
  const { timestamp, message, data, url, userAgent } = req.body;
  console.log("--- CLIENT LOG ---");
  console.log(`Vrijeme: ${timestamp}`);
  console.log(`Poruka: ${message}`);
  if (data) {
    console.log("Podaci:", JSON.stringify(data, null, 2));
  }
  console.log(`URL: ${url}`);
  console.log(`User Agent: ${userAgent}`);
  console.log("------------------");
  res.status(200).send("Log received");
});

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
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
