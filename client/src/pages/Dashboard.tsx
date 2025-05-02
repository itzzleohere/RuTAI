import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useLanguage } from "@/lib/i18n";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import CaseCard from "@/components/CaseCard";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Case, CaseSeverity } from "@shared/types";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<string>("all");

  const { data: cases, isLoading } = useQuery<Case[]>({
    queryKey: ['/api/cases'],
  });

  const getSeverityValue = (severity: CaseSeverity): string => {
    switch(severity) {
      case "EMERGENCY": return "emergency";
      case "MODERATE": return "moderate";
      case "LOW": return "low";
      default: return "unknown";
    }
  };

  const filteredCases = cases?.filter(caseItem => {
    if (activeTab === "all") return true;
    return getSeverityValue(caseItem.severity) === activeTab;
  });

  const handleCreateNewCase = () => {
    navigate("/case/new");
  };

  return (
    <>
      <Header title={t('dashboard.title')} showUserMenu />
      
      <div className="p-4 pb-20">
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
