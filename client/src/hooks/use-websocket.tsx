import { useState, useEffect, useCallback, useRef } from 'react';

interface WebSocketMessage {
  type: string;
  data?: any;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (event: Event) => void;
  reconnectInterval?: number;
  reconnectAttempts?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectIntervalRef = useRef<number | null>(null);
  
  const {
    onMessage,
    onOpen,
    onClose,
    onError,
    reconnectInterval = 3000,
    reconnectAttempts = 5
  } = options;
  
  // Connect to WebSocket
  const connect = useCallback(() => {
    // Determine the correct WebSocket protocol based on the page URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    // Close any existing connection
    if (socketRef.current) {
      socketRef.current.close();
    }
    
    // Create a new WebSocket connection
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;
    
    socket.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      if (onOpen) onOpen();
    };
    
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        setLastMessage(message);
        if (onMessage) onMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    socket.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      if (onClose) onClose();
      
      // Always attempt to reconnect with a reset attempt counter after a longer period
      // to account for server restarts or temporary network issues
      if (reconnectAttemptsRef.current < reconnectAttempts) {
        reconnectAttemptsRef.current++;
        if (reconnectIntervalRef.current) {
          window.clearTimeout(reconnectIntervalRef.current);
        }
        
        // Use a shorter interval for quick reconnects
        reconnectIntervalRef.current = window.setTimeout(() => {
          console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${reconnectAttempts})...`);
          connect();
        }, reconnectInterval);
      } else {
        // Reset attempts counter and try again after a longer delay
        console.log('Maximum reconnect attempts reached, will try again in 10 seconds');
        if (reconnectIntervalRef.current) {
          window.clearTimeout(reconnectIntervalRef.current);
        }
        
        reconnectIntervalRef.current = window.setTimeout(() => {
          reconnectAttemptsRef.current = 0;
          console.log('Resetting reconnect attempts and trying again...');
          connect();
        }, 10000); // Try again after 10 seconds
      }
    };
    
    socket.onerror = (event) => {
      console.error('WebSocket error:', event);
      if (onError) onError(event);
    };
  }, [onMessage, onOpen, onClose, onError, reconnectInterval, reconnectAttempts]);
  
  // Send message to the WebSocket server
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);
  
  // Register client with a user ID
  const registerClient = useCallback((userId: string | number) => {
    return sendMessage({
      type: 'register',
      data: { userId: String(userId) }
    });
  }, [sendMessage]);
  
  // Ping the server to check connection
  const ping = useCallback(() => {
    return sendMessage({
      type: 'ping',
      data: { timestamp: Date.now() }
    });
  }, [sendMessage]);
  
  // Connect on component mount, disconnect on unmount
  useEffect(() => {
    connect();
    
    // Set up ping interval to keep connection alive
    const pingInterval = setInterval(() => {
      if (isConnected) {
        ping();
      }
    }, 30000); // Every 30 seconds
    
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      
      if (reconnectIntervalRef.current) {
        window.clearTimeout(reconnectIntervalRef.current);
      }
      
      clearInterval(pingInterval);
    };
  }, [connect, ping, isConnected]);
  
  return {
    isConnected,
    lastMessage,
    sendMessage,
    registerClient,
    ping
  };
}