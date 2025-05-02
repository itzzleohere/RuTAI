import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { authRoutes } from "./services/auth";
import { caseRoutes } from "./services/triage";
import { webAuthRoutes, authenticateJwt } from "./services/auth-web";
import { webDashboardRoutes } from "./services/web-dashboard";
import session from "express-session";
import { db, pool } from "@db";
import PgSession from "connect-pg-simple";

export async function registerRoutes(app: Express): Promise<Server> {
  // Use session middleware
  const PgSessionStore = PgSession(session);
  
  app.use(
    session({
      store: new PgSessionStore({
        conObject: {
          connectionString: process.env.DATABASE_URL,
        },
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
  
  // Web dashboard routes for case management
  app.use(`${apiPrefix}/web-cases`, authenticateJwt, webDashboardRoutes());

  // Basic health check endpoint
  app.get(`${apiPrefix}/health`, (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // 404 for unknown API routes
  app.use(`${apiPrefix}/*`, (req, res) => {
    res.status(404).json({ message: "API endpoint not found" });
  });

  const httpServer = createServer(app);

  // Initialize WebSocket server on a distinct path to avoid conflict with Vite's HMR
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws'
  });
  
  // Store connected clients
  const connectedClients: Map<string, WebSocket> = new Map();
  
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    // Assign a unique ID to this connection
    const clientId = Date.now().toString();
    connectedClients.set(clientId, ws);
    
    // Send welcome message
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'connection',
        data: { status: 'connected', id: clientId }
      }));
    }

    // Handle messages from clients
    ws.on('message', (message) => {
      try {
        const parsedMessage = JSON.parse(message.toString());
        console.log('Received message:', parsedMessage);
        
        // Handle different message types
        switch (parsedMessage.type) {
          case 'register':
            // Example: Register client by user ID or health worker ID
            if (parsedMessage.data && parsedMessage.data.userId) {
              connectedClients.set(parsedMessage.data.userId, ws);
              console.log(`Client registered with ID: ${parsedMessage.data.userId}`);
            }
            break;
            
          case 'ping':
            // Respond to ping requests
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;
            
          default:
            console.log(`Unknown message type: ${parsedMessage.type}`);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });
    
    // Handle disconnection
    ws.on('close', () => {
      console.log('Client disconnected');
      connectedClients.delete(clientId);
    });
  });
  
  // Add broadcast method to notify all connected clients
  (global as any).notifyClients = (message: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  };
  
  // Add method to notify specific client - with enhanced logging
  (global as any).notifyClient = (userId: string, message: any) => {
    const client = connectedClients.get(userId);
    
    // Log all connected client IDs for debugging
    console.log(`Current connected clients: ${Array.from(connectedClients.keys()).join(', ')}`);
    console.log(`Attempting to send notification of type ${message.type} to client with ID: ${userId}`);
    
    if (client && client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
        console.log(`Successfully sent notification to client ${userId}`);
        return true;
      } catch (error) {
        console.error(`Error sending notification to client ${userId}:`, error);
        return false;
      }
    } else {
      console.log(`Client ${userId} not found or not in OPEN state`);
      // Store the notification for later delivery if client reconnects
      return false;
    }
  };

  return httpServer;
}
