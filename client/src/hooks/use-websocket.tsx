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
  
  // Connect to WebSocket with anti-initialization-loop protection
  const connect = useCallback(() => {
    // To prevent initialization loops, we'll track the number of connection attempts
    // within a short time window
    const now = Date.now();
    const connectionWindow = 5000; // 5 seconds window to detect loops
    const maxConnectionsInWindow = 3;
    
    // Store connection attempts with timestamps
    if (!window._wsConnectionAttempts) {
      window._wsConnectionAttempts = [];
    }
    
    // Add current attempt
    window._wsConnectionAttempts.push(now);
    
    // Only keep attempts within the recent window
    window._wsConnectionAttempts = window._wsConnectionAttempts.filter(
      time => now - time < connectionWindow
    );
    
    // Check if we're in a connection loop
    if (window._wsConnectionAttempts.length >= maxConnectionsInWindow) {
      log('Detected potential connection loop, enforcing long cooldown');
      if (reconnectIntervalRef.current) {
        window.clearTimeout(reconnectIntervalRef.current);
      }
      
      // Add a much longer cooldown to break out of any potential loops
      reconnectIntervalRef.current = window.setTimeout(() => {
        // Clear the attempts when we try again after the cooldown
        window._wsConnectionAttempts = [];
        log('Long cooldown complete, attempting fresh connection');
        connect();
      }, 15000); // 15-second emergency cooldown
      return;
    }
    
    // Normal cooldown check
    if (lastSuccessfulConnectionRef.current && 
        now - lastSuccessfulConnectionRef.current < 8000) {
      log('Enforcing standard cooldown period before reconnection');
      if (reconnectIntervalRef.current) {
        window.clearTimeout(reconnectIntervalRef.current);
      }
      
      // Standard cooldown to reduce connection thrashing
      reconnectIntervalRef.current = window.setTimeout(() => {
        log('Cooldown period complete, attempting connection');
        connect();
      }, 8000);
      return;
    }
    
    // Determine the correct WebSocket protocol based on the page URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    log(`Connecting to ${wsUrl}`);
    
    // Close any existing connection - with extra safeguards
    if (socketRef.current) {
      log('Closing existing connection');
      // Store a reference to avoid null pointer issues if something changes during cleanup
      const oldSocket = socketRef.current;
      
      // Clear the reference BEFORE closing to prevent reentrant issues
      socketRef.current = null;
      
      try {
        // Remove all handlers first to prevent reconnect loops
        oldSocket.onopen = null;
        oldSocket.onmessage = null;
        oldSocket.onclose = null;
        oldSocket.onerror = null;
        
        // Then close the connection
        if (oldSocket.readyState === WebSocket.OPEN || 
            oldSocket.readyState === WebSocket.CONNECTING) {
          oldSocket.close();
        }
      } catch (error) {
        logError('Error cleaning up old socket:', error);
      }
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
      // Create the socket outside the ref assignment to catch immediate errors
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      
      // Handle connection established
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
      
      // Handle incoming messages
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
      
      // Handle connection closed
      socket.onclose = (event) => {
        // Only log and act if this is the current socket - prevents stale socket issues
        if (socket !== socketRef.current && socketRef.current !== null) {
          log('Ignoring close event from old socket');
          return;
        }
        
        log(`WebSocket disconnected with code ${event.code}, reason: ${event.reason || 'No reason provided'}`);
        setIsConnected(false);
        setConnectionStable(false);
        
        // Clean up the stability timer
        if (stabilityTimerRef.current) {
          window.clearTimeout(stabilityTimerRef.current);
          stabilityTimerRef.current = null;
        }
        
        // Call user-provided onClose callback
        if (onClose) onClose();
        
        // Handle different close events specially
        // 1000-1001: Normal closures
        // 1005: No status code present (common during page reloads/navigations)
        // 1006: Abnormal closure (network loss)
        // 1012: Service restart
        // 1013: Try again later (server too busy)
        
        // Normal closure or user navigated away - don't reconnect
        if (event.code === 1000 || event.code === 1001) {
          log('Clean disconnection, not reconnecting');
          return;
        }
        
        // No status (probably navigation) - don't aggressively reconnect
        if (event.code === 1005) {
          log('No status code in close frame, likely page navigation');
          // Use a longer delay for no-status closes which are often related to
          // client-side issues rather than connectivity
          reconnectIntervalRef.current = window.setTimeout(() => {
            log('Attempting a single reconnect after no-status close');
            connect();
          }, 5000);
          return;
        }
        
        // Server busy or restarting - use increasing backoff
        if (event.code === 1012 || event.code === 1013) {
          const backoff = 5000 * Math.pow(1.5, reconnectAttemptsRef.current); // Start with 5s, increase exponentially
          log(`Server busy or restarting, backing off for ${backoff/1000}s before retry`);
          
          reconnectIntervalRef.current = window.setTimeout(() => {
            reconnectAttemptsRef.current = 0; // Reset attempts since this is a known server issue
            log('Attempting reconnect after server issue');
            connect();
          }, backoff);
          return;
        }
        
        // Connection lost (1006 or other) - implement progressive retry logic
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
      
      // Handle connection errors
      socket.onerror = (event) => {
        // Only act on current socket
        if (socket !== socketRef.current && socketRef.current !== null) {
          log('Ignoring error event from old socket');
          return;
        }
        
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
  
  // Forcefully reconnect the socket with enhanced error handling
  const reconnect = useCallback(() => {
    log('Forcing reconnection');
    
    // Reset the connection state to make UI feedback immediate
    setConnectionStable(false);
    
    // Always track reconnection attempts for user feedback
    reconnectAttemptsRef.current++;
    
    // Close any existing connection properly
    if (socketRef.current) {
      // First, store a reference to the socket to avoid null issues
      const oldSocket = socketRef.current;
      
      // Clear the reference immediately to prevent concurrent operations
      socketRef.current = null;
      
      // Remove listeners to prevent double reconnection attempts
      oldSocket.onclose = null;
      oldSocket.onopen = null;
      oldSocket.onmessage = null;
      oldSocket.onerror = null;
      
      try {
        // Close the socket if it's still open
        if (oldSocket.readyState === WebSocket.OPEN) {
          oldSocket.close();
        }
      } catch (err) {
        logError('Error closing socket during reconnect:', err);
      }
    }
    
    // Clear any lingering timers
    if (reconnectIntervalRef.current) {
      window.clearTimeout(reconnectIntervalRef.current);
      reconnectIntervalRef.current = null;
    }
    
    // Initiate a new connection with a small delay to ensure clean slate
    reconnectIntervalRef.current = window.setTimeout(() => {
      log('Starting fresh connection after reconnect request');
      connect();
    }, 2000);
  }, [connect, log, logError]);
  
  // Connect on component mount, disconnect on unmount
  // Connection setup and cleanup effect
  useEffect(() => {
    // A flag to track if the component is still mounted
    let isMounted = true;
    
    log('Initializing WebSocket connection');
    
    // Create a function to safely connect only if the component is still mounted
    const safeConnect = () => {
      if (isMounted) {
        connect();
      }
    };
    
    // Initial connection
    safeConnect();
    
    // Set up ping interval to keep connection alive
    const pingInterval = setInterval(() => {
      if (isMounted && isConnected && socketRef.current?.readyState === WebSocket.OPEN) {
        ping();
      }
    }, 25000); // Every 25 seconds
    
    // Keep track of sequential reconnection attempts for exponential backoff
    let reconnectionAttempt = 0;
    
    // Set up a special interval to periodically check connection and reconnect if needed
    const connectionCheckInterval = setInterval(() => {
      if (isMounted && !isConnected && !reconnectIntervalRef.current) {
        // Exponential backoff with a max of 30 seconds
        const backoffTime = Math.min(5000 * Math.pow(1.5, reconnectionAttempt), 30000);
        log(`Connection check - not connected, scheduling reconnect in ${backoffTime/1000}s`);
        
        reconnectionAttempt++;
        reconnectIntervalRef.current = window.setTimeout(() => {
          log('Reconnecting from periodic check');
          safeConnect();
        }, backoffTime);
      } else if (isConnected) {
        // Reset reconnection counter when connected
        reconnectionAttempt = 0;
      }
    }, 30000); // Check every 30 seconds
    
    return () => {
      // Mark as unmounted to prevent further state updates
      isMounted = false;
      
      log('Cleaning up WebSocket connection');
      
      // Clear all intervals immediately
      clearInterval(pingInterval);
      clearInterval(connectionCheckInterval);
      
      // Clean up the socket
      if (socketRef.current) {
        // Remove all event handlers to prevent reconnection attempts during unmount
        socketRef.current.onclose = null;
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        
        // Close the socket if it's open
        if (socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.close();
        }
        
        socketRef.current = null;
      }
      
      // Clear all timers
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