import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/lib/i18n';
import { 
  BarChart, Bar, 
  LineChart, Line, 
  PieChart, Pie, Cell, 
  CartesianGrid, XAxis, YAxis, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from '@/components/ui/card';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Case, CaseSeverity } from '@shared/types';
import { 
  Calendar, 
  Download, 
  ArrowUpDown,
  Users, 
  Activity, 
  Zap, 
  Clock,
  Map,
  AlertTriangle,
  CheckCircle2,
  TimerReset
} from 'lucide-react';

// Analytics page for the RuTAI web dashboard
export default function Analytics() {
  const { t } = useLanguage();
  const [timeRange, setTimeRange] = useState<string>('week');
  
  // Fetch cases data
  const { data: cases, isLoading } = useQuery<Case[]>({
    queryKey: ['/api/cases'],
  });
  
  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">{t('analytics.title')}</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-[180px]" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[150px] w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-[240px]" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[350px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Prepare data for charts
  const severityData = [
    { name: t('severity.emergency'), value: cases?.filter(c => c.severity === 'EMERGENCY').length || 0, color: '#ef4444' },
    { name: t('severity.moderate'), value: cases?.filter(c => c.severity === 'MODERATE').length || 0, color: '#f97316' },
    { name: t('severity.low'), value: cases?.filter(c => c.severity === 'LOW').length || 0, color: '#22c55e' },
  ];
  
  // Status breakdown
  const statusData = [
    { name: t('caseStatus.pending'), value: cases?.filter(c => c.status === 'PENDING').length || 0 },
    { name: t('caseStatus.stable'), value: cases?.filter(c => c.status === 'STABLE').length || 0 },
    { name: t('caseStatus.needsAttention'), value: cases?.filter(c => c.status === 'NEEDS_ATTENTION').length || 0 },
    { name: t('caseStatus.critical'), value: cases?.filter(c => c.status === 'CRITICAL').length || 0 },
    { name: t('caseStatus.closed'), value: cases?.filter(c => c.status === 'CLOSED').length || 0 },
  ];
  
  // Time trend data (mock data for now - would be replaced with actual historical data)
  const getDateXDaysAgo = (daysAgo: number) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  // Filter cases by date range for trend data
  const getFilteredCasesByDay = (daysAgo: number): Case[] => {
    if (!cases) return [];
    
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(0, 0, 0, 0);
    
    return cases.filter(c => {
      const caseDate = new Date(c.createdAt);
      return caseDate >= date && caseDate < new Date(date.getTime() + 24 * 60 * 60 * 1000);
    });
  };
  
  const trendData = [...Array(timeRange === 'week' ? 7 : 30)].map((_, i) => {
    const daysAgo = timeRange === 'week' ? 6 - i : 29 - i;
    const dayCases = getFilteredCasesByDay(daysAgo);
    
    return {
      name: getDateXDaysAgo(daysAgo),
      total: dayCases.length,
      emergency: dayCases.filter(c => c.severity === 'EMERGENCY').length,
      moderate: dayCases.filter(c => c.severity === 'MODERATE').length,
      low: dayCases.filter(c => c.severity === 'LOW').length,
    };
  });
  
  const reviewedPercentage = cases && cases.length > 0
    ? (cases.filter(c => c.reviewed).length / cases.length) * 100
    : 0;
  
  const assignedPercentage = cases && cases.length > 0
    ? (cases.filter(c => c.assignedDoctorId).length / cases.length) * 100
    : 0;
  
  const avgResponseTime = 35; // This would be calculated from actual data
  
  // Generate area-wise case distribution (mocked - would be replaced with actual geographic data)
  const areaData = [
    { name: 'North Region', value: Math.floor(Math.random() * 30) + 10 },
    { name: 'South Region', value: Math.floor(Math.random() * 30) + 10 },
    { name: 'East Region', value: Math.floor(Math.random() * 30) + 10 },
    { name: 'West Region', value: Math.floor(Math.random() * 30) + 10 },
    { name: 'Central', value: Math.floor(Math.random() * 30) + 5 },
  ];
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t('analytics.title')}</h1>
        <div className="flex gap-4">
          <Tabs value={timeRange} onValueChange={setTimeRange}>
            <TabsList>
              <TabsTrigger value="week">
                <Calendar className="mr-2 h-4 w-4" />
                {t('analytics.thisWeek')}
              </TabsTrigger>
              <TabsTrigger value="month">
                <Calendar className="mr-2 h-4 w-4" />
                {t('analytics.thisMonth')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            {t('analytics.exportReport')}
          </Button>
        </div>
      </div>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {t('analytics.totalCases')}
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cases?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {t('analytics.casesRegistered')}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {t('analytics.reviewRate')}
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reviewedPercentage.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">
              {t('analytics.casesReviewed')}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {t('analytics.assignmentRate')}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignedPercentage.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">
              {t('analytics.casesAssigned')}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {t('analytics.responseTime')}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgResponseTime} {t('analytics.mins')}</div>
            <p className="text-xs text-muted-foreground">
              {t('analytics.avgResponseTime')}
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Case Severity Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>{t('analytics.severityDistribution')}</CardTitle>
            <CardDescription>
              {t('analytics.caseSeverityBreakdown')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={severityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {severityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{t('analytics.statusDistribution')}</CardTitle>
            <CardDescription>
              {t('analytics.caseStatusBreakdown')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {/* Cases Trend Over Time */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('analytics.caseTrends')}</CardTitle>
          <CardDescription>
            {timeRange === 'week' 
              ? t('analytics.weekTrendDescription') 
              : t('analytics.monthTrendDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="total" 
                stroke="#3b82f6" 
                strokeWidth={2} 
                name={t('analytics.totalCases')} 
              />
              <Line 
                type="monotone" 
                dataKey="emergency" 
                stroke="#ef4444" 
                name={t('severity.emergency')} 
              />
              <Line 
                type="monotone" 
                dataKey="moderate" 
                stroke="#f97316" 
                name={t('severity.moderate')} 
              />
              <Line 
                type="monotone" 
                dataKey="low" 
                stroke="#22c55e" 
                name={t('severity.low')} 
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      {/* Additional Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.geographicDistribution')}</CardTitle>
            <CardDescription>
              {t('analytics.areaDistributionDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={areaData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.healthWorkerPerformance')}</CardTitle>
            <CardDescription>
              {t('analytics.healthWorkerDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center h-[250px]">
            <Users className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-center text-muted-foreground">
              {t('analytics.comingSoon')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}