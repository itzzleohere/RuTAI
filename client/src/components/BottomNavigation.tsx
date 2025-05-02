import { useState } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/lib/i18n";
import { Home, Search, RefreshCw, User, Laptop } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function BottomNavigation() {
  const [location, navigate] = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [syncingData, setSyncingData] = useState(false);

  const isActive = (path: string) => {
    return location === path;
  };

  const handleSync = async () => {
    setSyncingData(true);
    
    try {
      // Try to sync any offline data
      const storedDrafts = localStorage.getItem('case_draft');
      
      if (storedDrafts) {
        // In a real app, we would send the stored drafts to the server
        localStorage.removeItem('case_draft');
      }
      
      // Invalidate queries to refresh data
      await queryClient.invalidateQueries();
      
      toast({
        title: t('sync.success'),
        description: t('sync.successDesc'),
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('sync.failed'),
        variant: "destructive",
      });
    } finally {
      setSyncingData(false);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-neutral-100 flex justify-around py-2">
      <button 
        className={`flex flex-col items-center p-2 ${isActive('/') ? 'text-primary' : 'text-neutral-500'}`}
        onClick={() => navigate('/')}
      >
        <Home className="h-5 w-5" />
        <span className="text-xs mt-1">{t('nav.home')}</span>
      </button>
      
      <button 
        className="flex flex-col items-center p-2 text-neutral-500"
        onClick={() => {
          toast({
            title: t('feature.comingSoon'),
            description: t('feature.comingSoonDesc')
          });
        }}
      >
        <Search className="h-5 w-5" />
        <span className="text-xs mt-1">{t('nav.search')}</span>
      </button>
      
      <button 
        className="flex flex-col items-center p-2 text-neutral-500"
        onClick={handleSync}
        disabled={syncingData}
      >
        <RefreshCw className={`h-5 w-5 ${syncingData ? 'animate-spin' : ''}`} />
        <span className="text-xs mt-1">{t('nav.sync')}</span>
      </button>
      
      <button 
        className={`flex flex-col items-center p-2 ${isActive('/web-dashboard') ? 'text-primary' : 'text-neutral-500'}`}
        onClick={() => navigate('/web-dashboard')}
      >
        <Laptop className="h-5 w-5" />
        <span className="text-xs mt-1">{t('nav.webDashboard') || 'Web Dashboard'}</span>
      </button>
    </div>
  );
}
