import { useState } from "react";
import { useAuth } from "@/store/auth";
import { ArrowLeft, User } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

interface HeaderProps {
  title: string;
  showBackButton?: boolean;
  showUserMenu?: boolean;
  onBackClick?: () => void;
}

export default function Header({ 
  title, 
  showBackButton = false, 
  showUserMenu = false,
  onBackClick 
}: HeaderProps) {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Check for offline status
  useState(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  });

  const toggleUserMenu = () => {
    setShowMenu(!showMenu);
  };

  const handleLogout = () => {
    logout();
    setShowMenu(false);
  };

  return (
    <div className="bg-primary text-white p-4 relative">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          {showBackButton && (
            <button 
              className="mr-2" 
              onClick={onBackClick}
              aria-label={t('common.back')}
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
          )}
          <h1 className="text-xl font-medium">{title}</h1>
        </div>
        
        {showUserMenu && (
          <div className="flex items-center">
            {isOffline && (
              <span className="mr-2 px-2 py-1 bg-alert text-white text-xs rounded-full">
                {t('common.offline')}
              </span>
            )}
            <div className="relative">
              <button 
                className="flex items-center focus:outline-none" 
                onClick={toggleUserMenu}
                aria-label={t('common.userMenu')}
              >
                <span className="mr-2 font-medium text-sm">
                  {user?.name || t('common.user')}
                </span>
                <User className="h-5 w-5" />
              </button>
              
              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                  <a href="#" className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
                    {t('common.profile')}
                  </a>
                  <a href="#" className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
                    {t('common.settings')}
                  </a>
                  <a 
                    href="#" 
                    className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50" 
                    onClick={handleLogout}
                  >
                    {t('common.logout')}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
