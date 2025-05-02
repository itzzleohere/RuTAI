import { createContext, useState, useContext, useEffect, ReactNode } from 'react';
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
}

// Create the context
const NotificationContext = createContext<NotificationContextType | null>(null);

// Provider component
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  
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
  const { isConnected, registerClient } = useWebSocket({
    onMessage: handleWebSocketMessage,
    onOpen: () => {
      console.log('WebSocket connection established');
      // Register this client with the user ID if available
      if (user) {
        registerClient(user.id);
      }
    }
  });
  
  // Register client when user changes
  useEffect(() => {
    if (isConnected && user) {
      registerClient(user.id);
    }
  }, [isConnected, user, registerClient]);
  
  // Context value
  const contextValue: NotificationContextType = {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    isWebSocketConnected: isConnected
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