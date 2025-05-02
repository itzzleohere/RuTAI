import { useState } from 'react';
import { Bell, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useLocation } from 'wouter';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useNotifications } from '@/hooks/use-notifications';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/lib/i18n';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function NotificationBell() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [_, navigate] = useLocation();
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    isWebSocketConnected,
    connectionStatus,
    reconnectWebSocket,
    lastReconnectAttempt
  } = useNotifications();

  // Get the last 5 notifications for display
  const recentNotifications = notifications.slice(0, 5);

  // Handle clicking on a notification
  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    
    // Navigate based on notification type
    if (notification.data?.caseId) {
      navigate(`/web-case/${notification.data.caseId}`);
    }
    
    setOpen(false);
  };

  // Get connection status details for UI display
  const getConnectionDetails = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          color: 'text-green-500',
          bgColor: 'bg-green-500',
          icon: <Wifi className="h-3 w-3 mr-2" />,
          text: t('notifications.connected'),
          tooltip: t('notifications.stableConnection')
        };
      case 'unstable':
        return {
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500',
          icon: <Wifi className="h-3 w-3 mr-2" />,
          text: t('notifications.unstable'),
          tooltip: t('notifications.unstableConnectionDesc')
        };
      case 'disconnected':
        return {
          color: 'text-red-500',
          bgColor: 'bg-red-500',
          icon: <WifiOff className="h-3 w-3 mr-2" />,
          text: t('notifications.disconnected'),
          tooltip: t('notifications.noConnection')
        };
      case 'connecting':
      default:
        return {
          color: 'text-blue-500',
          bgColor: 'bg-blue-500',
          icon: <RefreshCw className="h-3 w-3 mr-2 animate-spin" />,
          text: t('notifications.connecting'),
          tooltip: t('notifications.establishingConnection')
        };
    }
  };

  const connectionDetails = getConnectionDetails();

  // Attempt to reconnect manually
  const handleManualReconnect = () => {
    if (reconnectWebSocket) {
      reconnectWebSocket();
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative">
                <Bell className={`h-5 w-5 ${connectionDetails.color}`} />
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="h-5 w-5 absolute -top-2 -right-2 flex items-center justify-center p-0 text-xs"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>{connectionDetails.tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between p-2">
          <div className="font-medium">{t('notifications.title')}</div>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs" 
              onClick={() => markAllAsRead()}
            >
              {t('notifications.markAllRead')}
            </Button>
          )}
        </div>

        <DropdownMenuSeparator />

        {recentNotifications.length > 0 ? (
          <>
            {recentNotifications.map((notification) => (
              <DropdownMenuItem 
                key={notification.id} 
                onClick={() => handleNotificationClick(notification)}
                className={`p-3 cursor-pointer ${!notification.read ? 'bg-muted/50' : ''}`}
              >
                <div className="flex flex-col gap-1 w-full">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{notification.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{notification.description}</p>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        ) : (
          <div className="p-4 text-center text-muted-foreground">
            {t('notifications.noNotifications')}
          </div>
        )}

        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs font-normal text-center">
            {t('notifications.connectionStatus')}
          </DropdownMenuLabel>
          <div className="p-2 text-xs text-center">
            <div className="flex items-center justify-center mb-1">
              {connectionDetails.icon}
              <span className={connectionDetails.color}>{connectionDetails.text}</span>
            </div>
            
            {!isWebSocketConnected && (
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs mt-2 w-full"
                onClick={handleManualReconnect}
              >
                <RefreshCw className="h-3 w-3 mr-2" />
                {t('notifications.reconnect')}
              </Button>
            )}
            
            {lastReconnectAttempt && !isWebSocketConnected && (
              <div className="text-xs text-muted-foreground mt-1">
                {t('notifications.lastReconnect')}: {formatDistanceToNow(lastReconnectAttempt, { addSuffix: true })}
              </div>
            )}
          </div>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}