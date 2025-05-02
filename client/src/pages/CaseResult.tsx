import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLanguage } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { AlertCircle, Info } from "lucide-react";
import LoadingOverlay from "@/components/LoadingOverlay";
import { Case, CaseSeverity } from "@shared/types";

export default function CaseResult() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();

  const { data: caseData, isLoading } = useQuery<Case>({
    queryKey: [`/api/cases/${id}`],
  });

  const notifyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/cases/${id}/notify`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t('caseResult.notificationSent'),
        description: t('caseResult.notificationSentDesc'),
      });
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: error.message || t('caseResult.notificationFailed'),
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (updatedCase: Partial<Case>) => {
      const res = await apiRequest("PATCH", `/api/cases/${id}`, updatedCase);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      toast({
        title: t('caseResult.caseSaved'),
        description: t('caseResult.caseSavedDesc'),
      });
      navigate("/");
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: error.message || t('caseResult.saveFailed'),
        variant: "destructive",
      });
    },
  });
  
  const feedbackMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/cases/${id}/feedback`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t('caseResult.feedbackSent'),
        description: t('caseResult.feedbackSentDesc'),
      });
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: error.message || t('caseResult.feedbackFailed'),
        variant: "destructive",
      });
    },
  });

  if (isLoading || !caseData) {
    return <LoadingOverlay message={t('caseResult.loading')} />;
  }

  const getSeverityColor = (severity: CaseSeverity) => {
    switch (severity) {
      case "EMERGENCY":
        return "emergency";
      case "MODERATE":
        return "alert";
      case "LOW":
        return "secondary";
      default:
        return "primary";
    }
  };

  const getSeverityText = (severity: CaseSeverity) => {
    switch (severity) {
      case "EMERGENCY":
        return t('severity.emergency');
      case "MODERATE":
        return t('severity.moderate');
      case "LOW":
        return t('severity.low');
      default:
        return t('severity.unknown');
    }
  };

  const getTimeAgo = (date: string | Date) => {
    try {
      if (date instanceof Date) {
        return formatDistanceToNow(date, { addSuffix: true });
      } else {
        return formatDistanceToNow(new Date(date), { addSuffix: true });
      }
    } catch (e) {
      return typeof date === 'string' ? date : date.toISOString();
    }
  };

  const getVitalIcon = (name: string, value: string, normalRange: [number, number]) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return null;
    
    const isAbnormal = numValue < normalRange[0] || numValue > normalRange[1];
    
    return (
      <div className="flex items-center">
        {isAbnormal ? (
          <AlertCircle className={`text-${colorClass} mr-2 h-4 w-4`} />
        ) : (
          <Info className="text-primary mr-2 h-4 w-4" />
        )}
        <span className="text-sm">{name}: {value}</span>
      </div>
    );
  };

  // Get color class based on severity
  const colorClass = getSeverityColor(caseData.severity);

  return (
    <div className="bg-white min-h-screen">
      {(notifyMutation.isPending || saveMutation.isPending) && (
        <LoadingOverlay message={notifyMutation.isPending ? t('caseResult.sendingNotification') : t('caseResult.saving')} />
      )}

      <Header 
        title={t('caseResult.title')} 
        showBackButton 
        onBackClick={() => navigate("/")}
      />

      <div className="p-4">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-medium">
              {t('caseResult.patient')}: <span>{caseData.patientName}, {caseData.age}{caseData.gender}</span>
            </h2>
            <span className={`px-3 py-1 bg-${colorClass} text-white text-sm rounded-full`}>
              {getSeverityText(caseData.severity)}
            </span>
          </div>
          <p className="text-sm text-neutral-500">
            {t('caseResult.caseAnalyzed')} {getTimeAgo(caseData.createdAt)}
          </p>
        </div>

        {/* Urgency Assessment */}
        <div className={`p-4 rounded-lg bg-${colorClass}-50 border border-${colorClass}-100 mb-6`}>
          <h3 className={`font-medium mb-2 text-${colorClass}-700`}>
            {getSeverityText(caseData.severity)}: {caseData.assessmentTitle}
          </h3>
          <p className="text-sm text-neutral-700 mb-2">{caseData.assessmentSummary}</p>
          <div className="bg-white p-3 rounded-md">
            <p className="text-sm font-medium mb-1">{t('caseResult.aiReasoning')}:</p>
            <p className="text-sm">{caseData.aiReasoning}</p>
          </div>
        </div>

        {/* Key Clinical Indicators */}
        <div className="mb-6">
          <h3 className="font-medium mb-3">{t('caseResult.keyIndicators')}</h3>
          <div className="space-y-2">
            {caseData.temperature && getVitalIcon(t('newCase.temperature'), caseData.temperature, [97, 99])}
            {caseData.pulse && getVitalIcon(t('newCase.pulse'), caseData.pulse, [60, 100])}
            {caseData.bpSystolic && caseData.bpDiastolic && getVitalIcon(
              t('caseResult.bloodPressure'), 
              `${caseData.bpSystolic}/${caseData.bpDiastolic} mmHg`, 
              [90, 140]
            )}
            {caseData.respiratoryRate && getVitalIcon(t('newCase.respiratoryRate'), caseData.respiratoryRate, [12, 20])}
            {caseData.oxygenSaturation && getVitalIcon(t('newCase.oxygenSaturation'), `${caseData.oxygenSaturation}%`, [95, 100])}
            
            {caseData.chiefComplaint && (
              <div className="flex items-center">
                <AlertCircle className={`text-${colorClass} mr-2 h-4 w-4`} />
                <span className="text-sm">{caseData.chiefComplaint}</span>
              </div>
            )}
          </div>
        </div>

        {/* Recommended AI Actions */}
        {caseData.recommendations && caseData.recommendations.length > 0 && Array.isArray(caseData.recommendations) && (
          <div className="mb-6">
            <h3 className="font-medium mb-3">{t('caseResult.recommendedActions')}</h3>
            <ol className="space-y-2 pl-5 list-decimal">
              {caseData.recommendations
                .filter((rec: any) => {
                  // Filter for AI-generated recommendations (which are simple strings or don't have timestamps)
                  return typeof rec === 'string' || !rec.createdAt;
                })
                .map((recommendation: any, index) => (
                  <li key={index} className="text-sm">
                    {typeof recommendation === 'string'
                      ? recommendation
                      : recommendation && typeof recommendation === 'object' && 'text' in recommendation
                        ? recommendation.text
                        : 'Unknown recommendation'}
                  </li>
                ))}
            </ol>
          </div>
        )}
        
        {/* Case Activity History */}
        {caseData.recommendations && caseData.recommendations.length > 0 && Array.isArray(caseData.recommendations) && (
          <div className="mb-6">
            <h3 className="font-medium mb-3">{t('caseResult.caseHistory') || "Case History"}</h3>
            <div className="border rounded-lg overflow-hidden">
              <ul className="divide-y">
                {caseData.recommendations
                  .filter((rec: any) => {
                    // Only include case activity entries (which have timestamps)
                    return rec && typeof rec === 'object' && rec.createdAt;
                  })
                  .sort((a: any, b: any) => {
                    // Sort by createdAt timestamp (newest first)
                    const dateA = new Date(a.createdAt).getTime();
                    const dateB = new Date(b.createdAt).getTime();
                    return dateB - dateA;
                  })
                  .map((recommendation: any, index) => (
                    <li key={index} className="p-3 bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="text-sm">{recommendation.text}</div>
                        <div className="text-xs text-gray-500 ml-2">
                          {getTimeAgo(recommendation.createdAt)}
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {caseData.severity === "EMERGENCY" && (
            <Button 
              className={`w-full bg-${colorClass} hover:bg-${colorClass}/90`}
              onClick={() => notifyMutation.mutate()}
              disabled={notifyMutation.isPending}
            >
              {t('caseResult.notifyMedicalTeam')}
            </Button>
          )}
          
          <Button 
            className="w-full"
            variant="outline"
            onClick={() => saveMutation.mutate(caseData)}
            disabled={saveMutation.isPending}
          >
            {t('caseResult.saveCase')}
          </Button>
          
          <div className="text-center">
            <button 
              className="text-neutral-500 text-sm hover:underline"
              onClick={() => feedbackMutation.mutate()}
            >
              {t('caseResult.aiAssessmentCorrection')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
