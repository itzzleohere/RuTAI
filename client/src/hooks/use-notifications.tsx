import { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { useToast } from './use-toast';
import { useWebSocket } from './use-websocket';
import { useAuth } from '../store/auth';
import { CaseSeverity } from '@shared/types';

// Types for notification messages
interface NotificationMessage {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
  data?: any;
}

interface NotificationContextType {
  notifications: NotificationMessage[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  isWebSocketConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'unstable' | 'disconnected';
  reconnectWebSocket: () => void;
  lastReconnectAttempt: Date | null;
  disconnectionReason: string | null;
  reconnectCount: number;
}

// Create the context
const NotificationContext = createContext<NotificationContextType | null>(null);

// Provider component
export function NotificationProvider({ children }: { children: ReactNode }) {
  // Notification state
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Connection state tracking
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'unstable' | 'disconnected'>('connecting');
  const [lastReconnectAttempt, setLastReconnectAttempt] = useState<Date | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [disconnectionReason, setDisconnectionReason] = useState<string | null>(null);
  
  // Get the unread notification count
  const unreadCount = notifications.filter(n => !n.read).length;
  
  // Mark a notification as read
  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, read: true } 
          : notification
      )
    );
  };
  
  // Mark all notifications as read
  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
  };
  
  // Clear all notifications
  const clearNotifications = () => {
    setNotifications([]);
  };
  
  // Handle WebSocket messages
  const handleWebSocketMessage = (message: any) => {
    console.log('WebSocket message received:', message);
    
    const now = new Date();
    const id = `notification-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // For broadcast messages that include healthWorkerId, only process if it matches the current user
    if (message.data && message.data.healthWorkerId && user && 
        message.data.healthWorkerId !== String(user.id)) {
      console.log('Skipping notification meant for another user');
      return;
    }
    
    switch (message.type) {
      case 'case_updated':
        // Case was updated, we could refresh the case list or show a notification
        toast({
          title: 'Case Updated',
          description: `Case #${message.data.caseId} was updated`,
        });
        
        setNotifications(prev => [
          {
            id,
            title: 'Case Updated',
            description: `Case #${message.data.caseId} was updated at ${now.toLocaleTimeString()}`,
            type: 'info',
            timestamp: now,
            read: false,
            data: message.data
          },
          ...prev
        ]);
        break;
        
      case 'case_reviewed':
        toast({
          title: 'Case Reviewed',
          description: `Case #${message.data.caseId} was reviewed by a medical professional`,
        });
        
        setNotifications(prev => [
          {
            id,
            title: 'Case Reviewed',
            description: `Case #${message.data.caseId} was reviewed at ${now.toLocaleTimeString()}`,
            type: 'success',
            timestamp: now,
            read: false,
            data: message.data
          },
          ...prev
        ]);
        break;
        
      case 'severity_updated':
        // Create a mapping of severity values to display labels
        const severityMap: Record<string, string> = {
          'EMERGENCY': 'Emergency',
          'MODERATE': 'Moderate',
          'LOW': 'Low',
          'UNKNOWN': 'Unknown'
        };
        
        const severityLabel = severityMap[message.data.newSeverity] || 'Unknown';
        
        toast({
          title: 'Severity Updated',
          description: `Case #${message.data.caseId} severity changed to ${severityLabel}`,
        });
        
        setNotifications(prev => [
          {
            id,
            title: 'Severity Updated',
            description: `Case #${message.data.caseId} severity changed to ${severityLabel}`,
            type: message.data.newSeverity === 'EMERGENCY' ? 'warning' : 'info',
            timestamp: now,
            read: false,
            data: message.data
          },
          ...prev
        ]);
        break;
        
      case 'case_feedback_added':
        toast({
          title: 'Feedback Added',
          description: `New feedback added to case #${message.data.caseId}`,
        });
        
        setNotifications(prev => [
          {
            id,
            title: 'Feedback Added',
            description: `New feedback was added to case #${message.data.caseId}`,
            type: 'info',
            timestamp: now,
            read: false,
            data: message.data
          },
          ...prev
        ]);
        break;
        
      case 'doctor_assigned':
        toast({
          title: 'Doctor Assigned',
          description: `A doctor has been assigned to case #${message.data.caseId}`,
          variant: 'default',
        });
        
        setNotifications(prev => [
          {
            id,
            title: 'Doctor Assigned',
            description: `A doctor has been assigned to your case #${message.data.caseId}`,
            type: 'success',
            timestamp: now,
            read: false,
            data: message.data
          },
          ...prev
        ]);
        break;
        
      case 'medical_feedback':
        toast({
          title: 'Medical Feedback Received',
          description: `You have received medical feedback for case #${message.data.caseId}`,
          variant: message.data.actionRequired ? 'destructive' : 'default',
        });
        
        setNotifications(prev => [
          {
            id,
            title: 'Medical Feedback',
            description: `Medical feedback received for case #${message.data.caseId}${message.data.actionRequired ? ' - Action Required!' : ''}`,
            type: message.data.actionRequired ? 'warning' : 'info',
            timestamp: now,
            read: false,
            data: message.data
          },
          ...prev
        ]);
        break;
    }
  };
  
  // Initialize WebSocket with notification handlers
  const { 
    isConnected, 
    connectionStable, 
    registerClient, 
    reconnect 
  } = useWebSocket({
    debug: true, // Enable detailed logging
    onMessage: handleWebSocketMessage,
    onOpen: () => {
      console.log('WebSocket connection established');
      setConnectionStatus('connected');
      setDisconnectionReason(null);
      
      // Add notification about reconnection if this wasn't the first connection
      if (reconnectCount > 0) {
        toast({
          title: 'Connection Restored',
          description: 'Your connection has been restored. Any pending updates will now be processed.',
          variant: 'default',
        });
      }
      
      // Register this client with the user ID if available
      if (user) {
        registerClient(user.id);
      }
    },
    onClose: (event: any) => {
      console.log(`WebSocket connection closed with code ${event?.code}, reason: ${event?.reason || 'Unknown'}`);
      setConnectionStatus('disconnected');
      
      // Track reconnection attempts for UI feedback
      setLastReconnectAttempt(new Date());
      
      // Set disconnection reason based on close code for better user feedback
      if (event?.code === 1000 || event?.code === 1001) {
        setDisconnectionReason('Normal closure, likely page navigation');
      } else if (event?.code === 1006) {
        setDisconnectionReason('Abnormal closure, possible network issue');
      } else if (event?.code === 1012) {
        setDisconnectionReason('Server is restarting');
      } else if (event?.code === 1013) {
        setDisconnectionReason('Server is too busy');
      } else {
        setDisconnectionReason('Connection lost');
      }
    },
    onError: (error: any) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('unstable');
      
      // Increment reconnect count for UI feedback
      setReconnectCount(count => count + 1);
      
      // Force reconnection after an error with progressive backoff
      setTimeout(() => {
        if (user) {
          reconnect();
        }
      }, Math.min(5000 + (reconnectCount * 1000), 15000)); // Progressive backoff capped at 15 seconds
    },
    // Increase reconnection attempts for rural areas with poor connectivity
    reconnectAttempts: 10,
    // Use exponential backoff for reconnections
    reconnectInterval: 2000
  });
  
  // Handle browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('Browser reports network is online');
      setTimeout(() => {
        if (!isConnected) {
          reconnect();
        }
      }, 1000);
    };
    
    const handleOffline = () => {
      console.log('Browser reports network is offline');
      setConnectionStatus('disconnected');
      setDisconnectionReason('Network connection lost');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isConnected, reconnect]);
  
  // Update connection status based on connection stability
  useEffect(() => {
    if (isConnected) {
      if (connectionStable) {
        setConnectionStatus('connected');
        // Reset reconnect count after stable connection achieved
        if (reconnectCount > 0) {
          setTimeout(() => setReconnectCount(0), 5000);
        }
      } else {
        setConnectionStatus('unstable');
      }
    } else {
      setConnectionStatus('disconnected');
    }
  }, [isConnected, connectionStable, reconnectCount]);
  
  // Register client when user changes or reconnects
  useEffect(() => {
    if (isConnected && user) {
      const registered = registerClient(user.id);
      console.log(`Client registration ${registered ? 'successful' : 'failed'}`);
      
      // If registration fails, try to reconnect
      if (!registered) {
        setTimeout(() => {
          reconnect();
        }, 2000);
      }
    }
  }, [isConnected, user, registerClient, reconnect]);
  
  // Create a function to manually reconnect the WebSocket
  const reconnectWebSocket = useCallback(() => {
    setLastReconnectAttempt(new Date());
    reconnect();
  }, [reconnect]);
  
  // Context value
  const contextValue: NotificationContextType = {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    isWebSocketConnected: isConnected,
    connectionStatus,
    reconnectWebSocket,
    lastReconnectAttempt,
    disconnectionReason,
    reconnectCount
  };
  
  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

// Hook to use the notification context
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}