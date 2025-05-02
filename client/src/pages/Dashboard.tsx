import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useLanguage } from "@/lib/i18n";
import { useOffline } from "@/hooks/use-offline";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import CaseCard from "@/components/CaseCard";
import { Plus, WifiOff, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Case, CaseSeverity } from "@shared/types";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("all");
  const { isOnline, pendingCases, triggerSync, isSyncing } = useOffline();

  // Fetch online cases
  const { data: cases, isLoading, refetch } = useQuery<Case[]>({
    queryKey: ['/api/cases'],
    enabled: isOnline, // Only fetch if online
  });

  // Effect to handle sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCases.length > 0) {
      toast({
        title: t('sync.pendingCases'),
        description: t('sync.pendingCasesDesc', { count: pendingCases.length.toString() }),
        action: (
          <Button variant="outline" size="sm" onClick={handleSync}>
            {t('sync.syncNow')}
          </Button>
        ),
      });
    }
  }, [isOnline]);

  // Handle sync button click
  const handleSync = async () => {
    if (!isOnline) {
      toast({
        title: t('common.error'),
        description: t('offline.workingOffline'),
        variant: "destructive",
      });
      return;
    }

    try {
      await triggerSync();
      toast({
        title: t('sync.success'),
        description: t('sync.successDesc'),
      });
      refetch(); // Refresh the cases list after sync
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('sync.failed'),
        variant: "destructive",
      });
    }
  };

  const getSeverityValue = (severity: CaseSeverity): string => {
    switch(severity) {
      case "EMERGENCY": return "emergency";
      case "MODERATE": return "moderate";
      case "LOW": return "low";
      default: return "unknown";
    }
  };

  // Combine online and offline cases
  const allCases = [
    ...(cases || []),
    ...pendingCases.map(offlineCase => ({
      ...offlineCase.data,
      id: offlineCase.id,
      isOffline: true, // Mark as offline for UI distinction
    })),
  ];

  const filteredCases = allCases.filter(caseItem => {
    if (activeTab === "all") return true;
    if (activeTab === "offline") return 'isOffline' in caseItem;
    return getSeverityValue(caseItem.severity) === activeTab;
  });

  const handleCreateNewCase = () => {
    navigate("/case/new");
  };

  return (
    <>
      <Header title={t('dashboard.title')} showUserMenu />
      
      <div className="p-4 pb-20">
        {/* Offline notification */}
        {!isOnline && (
          <Alert className="mb-4 border-yellow-400 bg-yellow-50">
            <WifiOff className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">{t('offline.workingOffline')}</AlertTitle>
            <AlertDescription className="text-yellow-600 text-sm">
              {t('offline.caseWillSync')}
            </AlertDescription>
          </Alert>
        )}

        {/* Sync notification */}
        {isOnline && pendingCases.length > 0 && (
          <Alert variant="default" className="mb-4 border-blue-400 bg-blue-50">
            <div className="flex justify-between items-center w-full">
              <div className="flex items-start gap-2">
                <RefreshCw className={`h-4 w-4 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
                <div>
                  <AlertTitle className="text-blue-800">
                    {t('sync.pendingCases')}
                    <Badge variant="outline" className="ml-2 bg-blue-100 text-blue-800 border-blue-300">
                      {pendingCases.length}
                    </Badge>
                  </AlertTitle>
                  <AlertDescription className="text-blue-600 text-sm">
                    {t('sync.pendingCasesDesc', { count: pendingCases.length.toString() })}
                  </AlertDescription>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-white border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={handleSync}
                disabled={isSyncing}
              >
                {isSyncing ? t('sync.syncingCases') : t('sync.syncNow')}
              </Button>
            </div>
          </Alert>
        )}

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">{t('dashboard.patientCases')}</h2>
          <button 
            onClick={handleCreateNewCase}
            className="bg-primary text-white p-2 rounded-full shadow-md hover:bg-primary/90 transition-colors duration-200"
            aria-label={t('dashboard.newCase')}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {/* Filter Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="all">{t('dashboard.allCases')}</TabsTrigger>
            <TabsTrigger value="emergency">{t('severity.emergency')}</TabsTrigger>
            <TabsTrigger value="moderate">{t('severity.moderate')}</TabsTrigger>
            <TabsTrigger value="low">{t('severity.low')}</TabsTrigger>
            {pendingCases.length > 0 && (
              <TabsTrigger value="offline">
                {t('common.offline')}
                <Badge variant="outline" className="ml-1 bg-yellow-100 text-yellow-800 border-yellow-300">
                  {pendingCases.length}
                </Badge>
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>

        {/* Case List */}
        <div className="space-y-4">
          {isLoading ? (
            // Loading skeleton
            [...Array(3)].map((_, i) => (
              <div key={i} className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-neutral-200">
                <div className="flex justify-between">
                  <div>
                    <Skeleton className="h-5 w-40 mb-1" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <div className="mt-2">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <div className="mt-3 flex justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))
          ) : filteredCases && filteredCases.length > 0 ? (
            filteredCases.map((caseItem) => (
              <CaseCard 
                key={caseItem.id}
                caseData={caseItem}
                onClick={() => navigate(`/case/${caseItem.id}`)}
              />
            ))
          ) : (
            <div className="text-center py-8 text-neutral-500">
              {t('dashboard.noCases')}
            </div>
          )}
        </div>
      </div>

      <BottomNavigation />
    </>
  );
}
