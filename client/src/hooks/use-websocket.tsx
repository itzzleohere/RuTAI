import { useState, useEffect, useCallback, useRef } from 'react';

// Enhanced WebSocket message interface with possible error info
interface WebSocketMessage {
  type: string;
  data?: any;
  error?: string;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (event: Event) => void;
  reconnectInterval?: number;
  reconnectAttempts?: number;
  debug?: boolean; // Option to enable detailed logging
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [connectionStable, setConnectionStable] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectIntervalRef = useRef<number | null>(null);
  const pingTimeoutRef = useRef<number | null>(null);
  const stabilityTimerRef = useRef<number | null>(null);
  
  // Track last successful connection time to prevent rapid reconnection cycles
  const lastSuccessfulConnectionRef = useRef<number | null>(null);
  
  const {
    onMessage,
    onOpen,
    onClose,
    onError,
    reconnectInterval = 3000,
    reconnectAttempts = 5,
    debug = false
  } = options;
  
  // Debug logger - only logs if debug option is enabled
  const log = useCallback((message: string, ...args: any[]) => {
    if (debug) {
      console.log(`[WebSocket] ${message}`, ...args);
    }
  }, [debug]);
  
  // Error logger - always logs errors
  const logError = useCallback((message: string, ...args: any[]) => {
    console.error(`[WebSocket Error] ${message}`, ...args);
  }, []);
  
  // Connect to WebSocket
  const connect = useCallback(() => {
    // Check if we need to enforce a cooldown period to prevent rapid reconnection cycles
    const now = Date.now();
    if (lastSuccessfulConnectionRef.current && 
        now - lastSuccessfulConnectionRef.current < 5000) {
      log('Enforcing cooldown period before reconnection');
      if (reconnectIntervalRef.current) {
        window.clearTimeout(reconnectIntervalRef.current);
      }
      
      reconnectIntervalRef.current = window.setTimeout(() => {
        connect();
      }, 5000); // Force a 5-second cooldown
      return;
    }
    
    // Determine the correct WebSocket protocol based on the page URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    log(`Connecting to ${wsUrl}`);
    
    // Close any existing connection
    if (socketRef.current) {
      log('Closing existing connection');
      // Only clean up references but don't call onclose callbacks
      const oldSocket = socketRef.current;
      socketRef.current = null;
      
      // Remove existing event listeners before closing to prevent duplicate reconnect attempts
      oldSocket.onclose = null;
      oldSocket.onerror = null;
      oldSocket.close();
    }
    
    // Make sure all existing timers are cleared
    if (reconnectIntervalRef.current) {
      window.clearTimeout(reconnectIntervalRef.current);
      reconnectIntervalRef.current = null;
    }
    
    if (pingTimeoutRef.current) {
      window.clearTimeout(pingTimeoutRef.current);
      pingTimeoutRef.current = null;
    }
    
    if (stabilityTimerRef.current) {
      window.clearTimeout(stabilityTimerRef.current);
      stabilityTimerRef.current = null;
    }
    
    // Create a new WebSocket connection
    try {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      
      socket.onopen = () => {
        log('WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        lastSuccessfulConnectionRef.current = Date.now();
        
        // Consider the connection stable after it stays open for 3 seconds
        stabilityTimerRef.current = window.setTimeout(() => {
          log('Connection considered stable');
          setConnectionStable(true);
        }, 3000);
        
        if (onOpen) onOpen();
      };
      
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          log('Received message:', message);
          setLastMessage(message);
          
          // Handle pong responses to reset the ping timeout
          if (message.type === 'pong') {
            log('Received pong from server');
            if (pingTimeoutRef.current) {
              window.clearTimeout(pingTimeoutRef.current);
              pingTimeoutRef.current = null;
            }
          }
          
          if (onMessage) onMessage(message);
        } catch (error) {
          logError('Error parsing WebSocket message:', error);
        }
      };
      
      socket.onclose = (event) => {
        log(`WebSocket disconnected with code ${event.code}, reason: ${event.reason}`);
        setIsConnected(false);
        setConnectionStable(false);
        
        // Clean up the stability timer
        if (stabilityTimerRef.current) {
          window.clearTimeout(stabilityTimerRef.current);
          stabilityTimerRef.current = null;
        }
        
        if (onClose) onClose();
        
        // Normal closure or user navigated away - don't reconnect
        if (event.code === 1000 || event.code === 1001) {
          log('Clean disconnection, not reconnecting');
          return;
        }
        
        // Implementation-specific logic for reconnection
        if (reconnectAttemptsRef.current < reconnectAttempts) {
          reconnectAttemptsRef.current++;
          
          // Exponential backoff: 3s, 6s, 12s...
          const backoff = reconnectInterval * Math.pow(1.5, reconnectAttemptsRef.current - 1);
          log(`Scheduling reconnect attempt ${reconnectAttemptsRef.current}/${reconnectAttempts} in ${backoff}ms`);
          
          reconnectIntervalRef.current = window.setTimeout(() => {
            log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${reconnectAttempts})...`);
            connect();
          }, backoff);
        } else {
          // Reset attempts counter and try again after a longer delay
          log('Maximum reconnect attempts reached, will try again in 15 seconds');
          
          reconnectIntervalRef.current = window.setTimeout(() => {
            reconnectAttemptsRef.current = 0;
            log('Resetting reconnect attempts and trying again...');
            connect();
          }, 15000); // Try again after 15 seconds
        }
      };
      
      socket.onerror = (event) => {
        logError('WebSocket error:', event);
        if (onError) onError(event);
      };
    } catch (error) {
      logError('Error creating WebSocket connection:', error);
      
      // Schedule a reconnect attempt
      reconnectIntervalRef.current = window.setTimeout(() => {
        log('Retrying connection after error...');
        connect();
      }, reconnectInterval);
    }
  }, [onMessage, onOpen, onClose, onError, reconnectInterval, reconnectAttempts, log, logError]);
  
  // Send message to the WebSocket server
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (!socketRef.current) {
      log('Cannot send message - no socket connection');
      return false;
    }
    
    if (socketRef.current.readyState === WebSocket.OPEN) {
      try {
        log('Sending message:', message);
        socketRef.current.send(JSON.stringify(message));
        return true;
      } catch (error) {
        logError('Error sending message:', error);
        return false;
      }
    } else {
      log(`Cannot send message - socket not in OPEN state (state: ${socketRef.current.readyState})`);
      return false;
    }
  }, [log, logError]);
  
  // Register client with a user ID
  const registerClient = useCallback((userId: string | number) => {
    log(`Registering client with userId: ${userId}`);
    return sendMessage({
      type: 'register',
      data: { userId: String(userId) }
    });
  }, [sendMessage, log]);
  
  // Ping the server to check connection
  const ping = useCallback(() => {
    log('Sending ping');
    const sent = sendMessage({
      type: 'ping',
      data: { timestamp: Date.now() }
    });
    
    // Set up a timeout to detect if the pong doesn't come back
    if (sent) {
      // Clear any existing ping timeout
      if (pingTimeoutRef.current) {
        window.clearTimeout(pingTimeoutRef.current);
      }
      
      // Set a new timeout to detect if pong doesn't arrive
      pingTimeoutRef.current = window.setTimeout(() => {
        log('Ping timeout - no pong received');
        // Close the socket to trigger reconnection
        if (socketRef.current) {
          socketRef.current.close();
        }
      }, 5000); // 5 second timeout for pong
    }
    
    return sent;
  }, [sendMessage, log]);
  
  // Forcefully reconnect the socket
  const reconnect = useCallback(() => {
    log('Forcing reconnection');
    if (socketRef.current) {
      socketRef.current.close();
    }
    connect();
  }, [connect, log]);
  
  // Connect on component mount, disconnect on unmount
  useEffect(() => {
    log('Initializing WebSocket connection');
    connect();
    
    // Set up ping interval to keep connection alive
    const pingInterval = setInterval(() => {
      if (isConnected && socketRef.current?.readyState === WebSocket.OPEN) {
        ping();
      }
    }, 30000); // Every 30 seconds
    
    return () => {
      log('Cleaning up WebSocket connection');
      if (socketRef.current) {
        // Remove all event handlers to prevent reconnection attempts during unmount
        socketRef.current.onclose = null;
        socketRef.current.onerror = null;
        socketRef.current.close();
      }
      
      // Clear all timers
      if (reconnectIntervalRef.current) {
        window.clearTimeout(reconnectIntervalRef.current);
      }
      
      if (pingTimeoutRef.current) {
        window.clearTimeout(pingTimeoutRef.current);
      }
      
      if (stabilityTimerRef.current) {
        window.clearTimeout(stabilityTimerRef.current);
      }
      
      clearInterval(pingInterval);
    };
  }, [connect, ping, isConnected, log]);
  
  return {
    isConnected,
    connectionStable,
    lastMessage,
    sendMessage,
    registerClient,
    ping,
    reconnect
  };
}