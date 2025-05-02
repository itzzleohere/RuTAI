import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useRoute } from 'wouter';
import { Plus, ChevronDown, Filter, Search, BarChart4, Map, Users, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Case, CaseSeverity } from '@shared/types';
import { useAuth } from '@/store/auth';
import NotificationBell from '@/components/NotificationBell';
import { useLanguage } from '@/lib/i18n';

export default function WebDashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const [activeView, setActiveView] = useState<string>('overview');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fetch cases data
  const { data: cases, isLoading } = useQuery<Case[]>({
    queryKey: ['/api/cases'],
  });

  // Filter cases based on active tab and search query
  const filteredCases = cases?.filter(caseItem => {
    const matchesTab = activeTab === 'all' || 
      (activeTab === 'emergency' && caseItem.severity === 'EMERGENCY') ||
      (activeTab === 'moderate' && caseItem.severity === 'MODERATE') ||
      (activeTab === 'low' && caseItem.severity === 'LOW');
    
    const matchesSearch = searchQuery === '' || 
      caseItem.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      caseItem.chiefComplaint?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesTab && matchesSearch;
  });

  // Calculate summary stats
  const totalCases = cases?.length || 0;
  const emergencyCases = cases?.filter(c => c.severity === 'EMERGENCY').length || 0;
  const moderateCases = cases?.filter(c => c.severity === 'MODERATE').length || 0;
  const lowCases = cases?.filter(c => c.severity === 'LOW').length || 0;

  // Get most recent cases
  const recentCases = [...(cases || [])].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 5);

  const getSeverityColor = (severity: CaseSeverity): string => {
    switch(severity) {
      case "EMERGENCY": return "emergency";
      case "MODERATE": return "alert";
      case "LOW": return "secondary";
      default: return "muted";
    }
  };
  
  // Helper function to create dynamic class names for Tailwind JIT
  const getSeverityClass = (severity: CaseSeverity, type: string): string => {
    const color = getSeverityColor(severity).toLowerCase();
    return `${type}-${color}`;
  };
  
  const getSeverityText = (severity: CaseSeverity): string => {
    switch(severity) {
      case "EMERGENCY": return t('severity.emergency');
      case "MODERATE": return t('severity.moderate');
      case "LOW": return t('severity.low');
      default: return t('severity.unknown');
    }
  };

  // Format date for display
  const formatDate = (date: string | Date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // No longer need to modify container as it's handled at the App level
  // This space intentionally left blank

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 p-4">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">RuTAI {t('webDashboard.title')}</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder={t('webDashboard.searchPatients')}
                className="pl-10 pr-4 py-2 border rounded-md w-64 focus:outline-none focus:ring-2 focus:ring-primary"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <NotificationBell />
            <div className="flex items-center gap-2 text-sm">
              <span>{user?.name}</span>
              <span className="bg-primary text-white px-2 py-1 rounded-md text-xs">
                {user?.role === 'DOCTOR' ? t('webDashboard.doctor') : 
                  user?.role === 'ADMIN' ? t('webDashboard.admin') : 
                  t('webDashboard.healthWorker')}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto p-6">
        {/* Navigation/View Selector */}
        <div className="mb-6 flex justify-between">
          <Tabs value={activeView} onValueChange={setActiveView} className="w-auto">
            <TabsList>
              <TabsTrigger value="overview">
                <BarChart4 className="mr-2 h-4 w-4" />
                {t('webDashboard.overview')}
              </TabsTrigger>
              <TabsTrigger value="map">
                <Map className="mr-2 h-4 w-4" />
                {t('webDashboard.map')}
              </TabsTrigger>
              <TabsTrigger value="analytics">
                <Activity className="mr-2 h-4 w-4" />
                {t('webDashboard.analytics')}
              </TabsTrigger>
              <TabsTrigger value="healthWorkers">
                <Users className="mr-2 h-4 w-4" />
                {t('webDashboard.healthWorkers')}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              {t('webDashboard.filters')}
            </Button>
            <Button variant="outline" size="sm">
              <ChevronDown className="mr-2 h-4 w-4" />
              {t('webDashboard.export')}
            </Button>
          </div>
        </div>

        {activeView === 'overview' && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl">{t('webDashboard.totalCases')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{totalCases}</div>
                  <p className="text-sm text-muted-foreground">{t('webDashboard.allRegisteredCases')}</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-emergency">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl text-emergency">{t('severity.emergency')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-emergency">{emergencyCases}</div>
                  <p className="text-sm text-muted-foreground">
                    {((emergencyCases / totalCases) * 100 || 0).toFixed(1)}% {t('webDashboard.ofTotalCases')}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-alert">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl text-alert">{t('severity.moderate')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-alert">{moderateCases}</div>
                  <p className="text-sm text-muted-foreground">
                    {((moderateCases / totalCases) * 100 || 0).toFixed(1)}% {t('webDashboard.ofTotalCases')}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-secondary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl text-secondary">{t('severity.low')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-secondary">{lowCases}</div>
                  <p className="text-sm text-muted-foreground">
                    {((lowCases / totalCases) * 100 || 0).toFixed(1)}% {t('webDashboard.ofTotalCases')}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Filter Tabs for Case List */}
            <div className="mb-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full justify-start overflow-x-auto">
                  <TabsTrigger value="all">{t('dashboard.allCases')}</TabsTrigger>
                  <TabsTrigger value="emergency">{t('severity.emergency')}</TabsTrigger>
                  <TabsTrigger value="moderate">{t('severity.moderate')}</TabsTrigger>
                  <TabsTrigger value="low">{t('severity.low')}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Recent Cases */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">{t('webDashboard.recentCases')}</h2>
              
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white p-6 rounded-lg shadow-sm border">
                      <div className="flex justify-between">
                        <div>
                          <Skeleton className="h-6 w-48 mb-2" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                        <Skeleton className="h-8 w-24 rounded-full" />
                      </div>
                      <div className="mt-4">
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {recentCases.map((caseItem) => (
                    <div 
                      key={caseItem.id}
                      className={`bg-white p-6 rounded-lg shadow-sm border-l-4 ${getSeverityClass(caseItem.severity, 'border')} cursor-pointer hover:shadow-md transition-shadow`}
                      onClick={() => navigate(`/web-case/${caseItem.id}`)}
                    >
                      <div className="flex justify-between">
                        <div>
                          <h3 className="font-medium text-lg">{caseItem.patientName}, {caseItem.age} {caseItem.gender}</h3>
                          <p className="text-sm text-neutral-500">
                            {t('caseResult.caseId')}: #{caseItem.id} • {formatDate(caseItem.createdAt)}
                          </p>
                        </div>
                        <span className={`px-3 py-1 ${getSeverityClass(caseItem.severity, 'bg')} text-white text-sm rounded-full flex items-center`}>
                          {getSeverityText(caseItem.severity)}
                        </span>
                      </div>
                      <div className="mt-4">
                        <p className="text-sm font-medium mb-1">{t('newCase.symptoms')}:</p>
                        <p className="text-sm">{caseItem.chiefComplaint || t('webDashboard.noChiefComplaint')}</p>
                        <p className="text-sm mt-2">{caseItem.assessmentSummary}</p>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button 
                          variant="link" 
                          className="text-primary hover:text-primary/80"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/web-case/${caseItem.id}`);
                          }}
                        >
                          {t('webDashboard.viewDetails')}
                        </Button>
                      </div>
                    </div>
                  ))}
                  {recentCases.length === 0 && (
                    <div className="text-center py-8 text-neutral-500 bg-white rounded-lg shadow-sm">
                      {t('dashboard.noCases')}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* View All Cases Button */}
            <div className="flex justify-center">
              <Button 
                variant="outline" 
                className="w-full md:w-auto"
                onClick={() => setActiveView('cases')}
              >
                {t('webDashboard.viewAllCases')}
              </Button>
            </div>
          </>
        )}

        {activeView === 'map' && (
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-center py-16">
              <h3 className="text-lg font-medium mb-2">{t('webDashboard.geographicDistribution')}</h3>
              <p className="text-neutral-500">
                {t('webDashboard.mapViewComingSoon')}
              </p>
            </div>
          </div>
        )}

        {activeView === 'analytics' && (
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-center py-16">
              <h3 className="text-lg font-medium mb-2">{t('webDashboard.analyticsAndReporting')}</h3>
              <p className="text-neutral-500">
                {t('webDashboard.analyticsComingSoon')}
              </p>
            </div>
          </div>
        )}

        {activeView === 'healthWorkers' && (
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-center py-16">
              <h3 className="text-lg font-medium mb-2">{t('webDashboard.healthWorkerManagement')}</h3>
              <p className="text-neutral-500">
                {t('webDashboard.healthWorkerManagementComingSoon')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}