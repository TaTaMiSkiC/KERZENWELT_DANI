import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { sendVerificationEmail } from "./sendgrid";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  try {
    // Provjeri je li stored lozinka u ispravnom formatu ("hash.salt")
    if (!stored || !stored.includes('.')) {
      console.error("Stored password is not in the correct format");
      return false;
    }
    
    const [hashed, salt] = stored.split(".");
    if (!hashed || !salt) {
      console.error("Could not extract hash or salt from stored password");
      return false;
    }
    
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Error comparing passwords:", error);
    return false;
  }
}

// Dodajte ovaj kod prije export function setupAuth
export function authMiddleware(req: Request, res: Response, next: Function) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

export function adminMiddleware(req: Request, res: Response, next: Function) {
  if (req.isAuthenticated && req.isAuthenticated() && req.user?.isAdmin) {
    return next();
  }
  res.status(403).json({ message: "Forbidden: Admin access required" });
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "kerzenwelt-session-secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else if (user.emailVerified === false) {
          // User exists but email is not verified
          return done(null, false, { message: "email_not_verified" });
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      // Check if user already exists
      const existingUserByUsername = await storage.getUserByUsername(req.body.username);
      if (existingUserByUsername) {
        return res.status(400).json({ message: "Korisničko ime već postoji" });
      }
      
      const existingUserByEmail = await storage.getUserByEmail(req.body.email);
      if (existingUserByEmail) {
        return res.status(400).json({ message: "Email adresa već postoji" });
      }

      // Create the user with hashed password and set emailVerified to false
      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
        emailVerified: false
      });

      // Generate a verification token
      const tokenString = randomBytes(32).toString("hex");
      const expirationDate = new Date();
      expirationDate.setHours(expirationDate.getHours() + 24); // Token valid for 24 hours
      
      const token = await storage.createVerificationToken({
        userId: user.id,
        token: tokenString,
        expiresAt: expirationDate
      });

      // Generate verification link
      const verificationLink = `${req.protocol}://${req.get('host')}/verify-email?token=${tokenString}`;
      
      // Send verification email
      try {
        // Get language preference from request or default to German
        const language = req.body.language || req.body.preferredLanguage || 'de';
        console.log("Sending verification email to:", user.email, "with token:", tokenString);
        await sendVerificationEmail(user.email, user.username, tokenString, language);
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        // Still create the user, but log the error
      }

      // Respond with success but don't log the user in yet
      res.status(201).json({ 
        message: "registration_success_verify_email",
        userId: user.id
      });
    } catch (error) {
      next(error);
    }
  });
  
  // Email verification endpoint
  app.get("/api/verify-email/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      // Verify the token
      const verificationToken = await storage.getVerificationToken(token);
      
      if (!verificationToken) {
        return res.status(400).json({ message: "Invalid or expired verification token" });
      }
      
      // Check if token is expired
      if (new Date() > verificationToken.expiresAt) {
        // Delete the expired token
        await storage.deleteVerificationToken(token);
        return res.status(400).json({ message: "Verification token has expired" });
      }
      
      // Verify the user's email
      const user = await storage.verifyUserEmail(verificationToken.userId);
      
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }
      
      // Delete the used token
      await storage.deleteVerificationToken(token);
      
      // Log the user in automatically after verification
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Failed to login after verification" });
        }
        return res.status(200).json({ message: "Email verified successfully" });
      });
      
    } catch (error) {
      console.error("Error verifying email:", error);
      res.status(500).json({ message: "Server error during verification" });
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
  
  // Update user profile
  app.put("/api/user", async (req, res, next) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const updatedUser = await storage.updateUser(req.user.id, req.body);
      res.json(updatedUser);
    } catch (error) {
      next(error);
    }
  });
}
