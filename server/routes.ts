import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { authRoutes } from "./services/auth";
import { caseRoutes } from "./services/triage";
import { webAuthRoutes, authenticateJwt } from "./services/auth-web";
import { webDashboardRoutes } from "./services/web-dashboard";
import { analyticsRoutes } from "./services/analytics";
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
  
  // Analytics routes for dashboard
  app.use(`${apiPrefix}/analytics`, analyticsRoutes());
  
  // Health workers list endpoint for filtering
  app.get(`${apiPrefix}/health-workers`, authenticateJwt, async (req, res) => {
    try {
      const healthWorkers = await storage.getHealthWorkersWithUsers();
      res.json(healthWorkers);
    } catch (error) {
      console.error('Error fetching health workers:', error);
      res.status(500).json({ message: 'Failed to fetch health workers' });
    }
  });

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
    path: '/ws',
    // Enable client tracking for connection management
    clientTracking: true,
    // Enable compression for efficiency in limited bandwidth scenarios
    perMessageDeflate: {
      zlibDeflateOptions: {
        // Optimize for mobile connections
        chunkSize: 1024,
        memLevel: 7,
        level: 3 // Balance between speed and compression ratio
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024
      },
      // Limit concurrent compression to avoid overloading
      concurrencyLimit: 5,
      // Take over compression context to improve efficiency
      clientNoContextTakeover: false, 
      serverNoContextTakeover: false,
      // More compatible window bits setting
      serverMaxWindowBits: 15,
      // Threshold below which compression is skipped (for small messages)
      threshold: 512 // Smaller threshold to compress more messages
    }
  });
  
  // Store connected clients with additional metadata
  interface ClientInfo {
    socket: WebSocket;
    userId?: string;     // User ID when registered
    lastActive: number;  // Timestamp of last activity
    pendingMessages: any[]; // Messages queued for delivery
  }
  
  // Store both connection IDs and user IDs
  const connectedClients: Map<string, ClientInfo> = new Map();
  const userIdToConnectionId: Map<string, string> = new Map();
  
  // Heartbeat detection to clean up dead connections with more aggressive timeouts
  const HEARTBEAT_INTERVAL = 20000; // 20 seconds
  const PING_INTERVAL = 15000; // 15 seconds
  const CONNECTION_TIMEOUT = 60000;  // 60 seconds without activity = dead connection
  
  // Improved connection state tracking
  const connectionStates: Map<string, { 
    lastPing: number, 
    pingsSent: number,
    pingsReceived: number,
    pingAttempts: number,
    lastActivity: number 
  }> = new Map();
  
  // Set up interval to check for dead connections and send pings
  const heartbeatInterval = setInterval(() => {
    const now = Date.now();
    
    // Manually iterate over the Map to avoid TypeScript issues
    connectedClients.forEach((clientInfo, clientId) => {
      // Get or create connection state
      let connectionState = connectionStates.get(clientId);
      if (!connectionState) {
        connectionState = { 
          lastPing: now, 
          pingsSent: 0,
          pingsReceived: 0,
          pingAttempts: 0,
          lastActivity: clientInfo.lastActive
        };
        connectionStates.set(clientId, connectionState);
      }
      
      // If the client hasn't been active in CONNECTION_TIMEOUT milliseconds, close the connection
      if (now - clientInfo.lastActive > CONNECTION_TIMEOUT) {
        console.log(`Connection ${clientId} timed out (no activity for ${(now - clientInfo.lastActive)/1000}s), closing`);
        try {
          if (clientInfo.socket.readyState === WebSocket.OPEN) {
            // Send a close frame with status code 1000 (normal closure) before terminating
            clientInfo.socket.close(1000, "Connection timeout");
            
            // Give it a moment to send the close frame before forceful termination
            setTimeout(() => {
              if (connectedClients.has(clientId)) {
                clientInfo.socket.terminate();
                connectedClients.delete(clientId);
                connectionStates.delete(clientId);
                
                // Also clean up the userIdToConnectionId mapping
                if (clientInfo.userId) {
                  userIdToConnectionId.delete(clientInfo.userId);
                }
              }
            }, 500);
          } else {
            // If already closed or closing, just clean up
            connectedClients.delete(clientId);
            connectionStates.delete(clientId);
            
            // Also clean up the userIdToConnectionId mapping
            if (clientInfo.userId) {
              userIdToConnectionId.delete(clientInfo.userId);
            }
          }
        } catch (error) {
          console.error(`Error closing timed out connection ${clientId}:`, error);
          // Still attempt to clean up
          connectedClients.delete(clientId);
          connectionStates.delete(clientId);
          if (clientInfo.userId) {
            userIdToConnectionId.delete(clientInfo.userId);
          }
        }
      }
      // Send pings regularly to keep the connection alive and detect dead connections early
      else if (clientInfo.socket.readyState === WebSocket.OPEN && now - connectionState.lastPing > PING_INTERVAL) {
        try {
          clientInfo.socket.ping();
          connectionState.lastPing = now;
          connectionState.pingsSent++;
          connectionState.pingAttempts++;
          
          // Log ping statistics periodically
          if (connectionState.pingAttempts % 10 === 0) {
            console.log(`Connection ${clientId} ping stats - sent: ${connectionState.pingsSent}, received: ${connectionState.pingsReceived}, success rate: ${Math.round((connectionState.pingsReceived/connectionState.pingsSent) * 100)}%`);
          }
        } catch (error) {
          console.error(`Error sending ping to client ${clientId}:`, error);
        }
      }
    });
  }, HEARTBEAT_INTERVAL);
  
  // Make sure to clear the interval when the server is shutting down
  process.on('SIGINT', () => {
    clearInterval(heartbeatInterval);
    process.exit(0);
  });
  
  wss.on('connection', (ws, req) => {
    console.log('WebSocket client connected');
    
    // Assign a unique ID to this connection
    const clientId = Date.now().toString();
    
    // Store client info
    connectedClients.set(clientId, {
      socket: ws,
      lastActive: Date.now(),
      pendingMessages: []
    });
    
    // Send welcome message
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({
          type: 'connection',
          data: { status: 'connected', id: clientId }
        }));
      } catch (error) {
        console.error('Error sending welcome message:', error);
      }
    }
    
    // Update last active timestamp and track pong responses for connection health
    ws.on('pong', () => {
      const clientInfo = connectedClients.get(clientId);
      if (clientInfo) {
        clientInfo.lastActive = Date.now();
        
        // Update ping stats
        const connectionState = connectionStates.get(clientId);
        if (connectionState) {
          connectionState.lastActivity = Date.now();
          connectionState.pingsReceived++;
        }
      }
    });

    // Handle messages from clients
    ws.on('message', (message) => {
      try {
        // Update last active timestamp
        const clientInfo = connectedClients.get(clientId);
        if (clientInfo) {
          clientInfo.lastActive = Date.now();
        }
        
        const parsedMessage = JSON.parse(message.toString());
        console.log('Received message:', parsedMessage);
        
        // Handle different message types
        switch (parsedMessage.type) {
          case 'register':
            // Register client by user ID or health worker ID
            if (parsedMessage.data && parsedMessage.data.userId) {
              const userId = parsedMessage.data.userId;
              
              // Store the user ID with this connection
              const clientInfo = connectedClients.get(clientId);
              if (clientInfo) {
                clientInfo.userId = userId;
                
                // Map user ID to connection ID
                userIdToConnectionId.set(userId, clientId);
                
                // Log registration
                console.log(`Client registered with ID: ${userId} (connection: ${clientId})`);
                
                // Send any pending messages for this user
                if (clientInfo.pendingMessages.length > 0) {
                  console.log(`Sending ${clientInfo.pendingMessages.length} pending messages to user ${userId}`);
                  
                  for (const pendingMsg of clientInfo.pendingMessages) {
                    try {
                      if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify(pendingMsg));
                      }
                    } catch (error) {
                      console.error(`Error sending pending message to client ${userId}:`, error);
                    }
                  }
                  
                  // Clear pending messages
                  clientInfo.pendingMessages = [];
                }
              }
            }
            break;
            
          case 'ping':
            // Respond to ping requests
            try {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ 
                  type: 'pong', 
                  timestamp: Date.now() 
                }));
              }
            } catch (error) {
              console.error('Error sending pong response:', error);
            }
            break;
            
          default:
            console.log(`Unknown message type: ${parsedMessage.type}`);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });
    
    // Handle errors
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      // Remove the client on error
      connectedClients.delete(clientId);
    });
    
    // Handle disconnection
    ws.on('close', (code, reason) => {
      console.log(`Client ${clientId} disconnected with code ${code}, reason: ${reason}`);
      
      // Get client info before removing
      const clientInfo = connectedClients.get(clientId);
      
      // If this connection had a user ID, remove that mapping
      if (clientInfo && clientInfo.userId) {
        userIdToConnectionId.delete(clientInfo.userId);
      }
      
      // Remove from the connected clients
      connectedClients.delete(clientId);
    });
  });
  
  // Add broadcast method to notify all connected clients
  (global as any).notifyClients = (message: any) => {
    const messageJson = JSON.stringify(message);
    let successCount = 0;
    let failureCount = 0;
    
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageJson);
          successCount++;
        } catch (error) {
          console.error('Error broadcasting message:', error);
          failureCount++;
        }
      }
    });
    
    console.log(`Broadcast complete: ${successCount} successful, ${failureCount} failed`);
    return { success: successCount, failure: failureCount };
  };
  
  // Add method to notify specific client - with enhanced reliability
  (global as any).notifyClient = (userId: string, message: any) => {
    // Get the connection ID for this user
    const connectionId = userIdToConnectionId.get(userId);
    
    // Debug logging
    console.log(`User ID ${userId} maps to connection ID: ${connectionId || 'not found'}`);
    
    // Safely get connected users as an array
    const connectedUsers: string[] = [];
    userIdToConnectionId.forEach((_, key) => {
      connectedUsers.push(key);
    });
    
    console.log(`Current connected users: ${connectedUsers.join(', ')}`);
    console.log(`Attempting to send notification of type ${message.type} to user ${userId}`);
    
    if (connectionId) {
      const clientInfo = connectedClients.get(connectionId);
      
      if (clientInfo && clientInfo.socket.readyState === WebSocket.OPEN) {
        try {
          clientInfo.socket.send(JSON.stringify(message));
          console.log(`Successfully sent notification to user ${userId}`);
          return true;
        } catch (error) {
          console.error(`Error sending notification to user ${userId}:`, error);
          
          // Queue message for later delivery
          clientInfo.pendingMessages.push(message);
          return false;
        }
      } else {
        // Connection exists but isn't open
        console.log(`Connection for user ${userId} exists but is not in OPEN state`);
        
        // Store for later if we have client info
        if (clientInfo) {
          clientInfo.pendingMessages.push(message);
          console.log(`Queued message for later delivery to user ${userId}`);
        }
        
        return false;
      }
    } else {
      console.log(`User ${userId} not currently connected`);
      
      // Create a pending messages store for this user for when they reconnect
      // We could store this in a more persistent way if needed
      return false;
    }
  };

  return httpServer;
}
