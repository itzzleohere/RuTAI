import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useLocation } from 'wouter';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useNotifications } from '@/hooks/use-notifications';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/lib/i18n';

export default function NotificationBell() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [_, navigate] = useLocation();
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    isWebSocketConnected 
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

  // Get appropriate icon color based on connection status
  const getConnectionColor = () => {
    return isWebSocketConnected ? 'text-green-500' : 'text-gray-400';
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className={`h-5 w-5 ${getConnectionColor()}`} />
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

        <div className="p-2 text-xs text-center text-muted-foreground">
          {isWebSocketConnected ? (
            <span className="flex items-center justify-center">
              <span className="h-2 w-2 rounded-full bg-green-500 mr-2"></span>
              {t('notifications.connected')}
            </span>
          ) : (
            <span className="flex items-center justify-center">
              <span className="h-2 w-2 rounded-full bg-gray-400 mr-2"></span>
              {t('notifications.disconnected')}
            </span>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}