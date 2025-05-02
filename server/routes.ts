import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authRoutes } from "./services/auth";
import { caseRoutes } from "./services/triage";
import { webAuthRoutes } from "./services/auth-web";
import session from "express-session";
import { db } from "@db";
import PgSession from "connect-pg-simple";

export async function registerRoutes(app: Express): Promise<Server> {
  // Use session middleware
  const PgSessionStore = PgSession(session);
  
  app.use(
    session({
      store: new PgSessionStore({
        pool: db.pool,
        tableName: "sessions",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "rural-health-triage-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    })
  );

  // API routes with prefix
  const apiPrefix = "/api";

  // Mobile auth routes
  app.use(`${apiPrefix}/auth`, authRoutes());

  // Web dashboard auth routes
  const webAuth = webAuthRoutes();
  app.post(`${apiPrefix}/auth/web-login`, webAuth.webLogin);
  app.post(`${apiPrefix}/auth/verify-web-otp`, webAuth.verifyWebOtp);

  // Case routes
  app.use(`${apiPrefix}/cases`, caseRoutes());

  // Basic health check endpoint
  app.get(`${apiPrefix}/health`, (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // 404 for unknown API routes
  app.use(`${apiPrefix}/*`, (req, res) => {
    res.status(404).json({ message: "API endpoint not found" });
  });

  const httpServer = createServer(app);

  return httpServer;
}
