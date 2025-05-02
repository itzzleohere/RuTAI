import { useEffect, useState } from 'react';
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLanguage } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  AlertCircle, CheckCircle, ArrowUp, ArrowDown, 
  MessageSquare, RotateCw, Clipboard, Bell,
  ChevronLeft, XCircle, PieChart, Clock
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import LoadingOverlay from "@/components/LoadingOverlay";
import { Case, CaseSeverity, AiFeedback } from "@shared/types";

export default function WebCaseView() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<CaseSeverity | null>(null);
  const [reviewCompleted, setReviewCompleted] = useState(false);

  // Fetch case data
  const { data: caseData, isLoading } = useQuery<Case>({
    queryKey: [`/api/cases/${id}`],
  });

  // Set initial severity based on case data
  useEffect(() => {
    if (caseData) {
      setSelectedSeverity(caseData.severity);
      setReviewCompleted(caseData.reviewed || false);
    }
  }, [caseData]);

  // Send feedback to health worker
  const feedbackMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/cases/${id}/feedback`, {
        feedbackNotes: feedbackNote,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${id}`] });
      toast({
        title: t('webCaseView.feedbackSent'),
        description: t('webCaseView.feedbackSentDesc'),
      });
      setFeedbackDialogOpen(false);
      setFeedbackNote('');
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: error.message || t('webCaseView.feedbackFailed'),
        variant: "destructive",
      });
    },
  });

  // Update case severity
  const updateSeverityMutation = useMutation({
    mutationFn: async (data: AiFeedback) => {
      const res = await apiRequest("POST", `/api/cases/${id}/severity`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      toast({
        title: t('webCaseView.severityUpdated'),
        description: t('webCaseView.severityUpdatedDesc'),
      });
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: error.message || t('webCaseView.severityUpdateFailed'),
        variant: "destructive",
      });
    },
  });

  // Mark case as reviewed
  const markAsReviewedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/cases/${id}/review`, {
        reviewed: true,
        correctedSeverity: selectedSeverity,
        feedbackNotes: feedbackNote,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      toast({
        title: t('webCaseView.caseReviewed'),
        description: t('webCaseView.caseReviewedDesc'),
      });
      setReviewDialogOpen(false);
      setReviewCompleted(true);
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: error.message || t('webCaseView.reviewFailed'),
        variant: "destructive",
      });
    },
  });

  // Notify health worker
  const notifyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/cases/${id}/notify`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${id}`] });
      toast({
        title: t('webCaseView.notificationSent'),
        description: t('webCaseView.notificationSentDesc'),
      });
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: error.message || t('webCaseView.notificationFailed'),
        variant: "destructive",
      });
    },
  });

  if (isLoading || !caseData) {
    return <LoadingOverlay message={t('caseResult.loading')} />;
  }

  const getSeverityColor = (severity: CaseSeverity): string => {
    switch(severity) {
      case "EMERGENCY": return "text-red-600";
      case "MODERATE": return "text-amber-600";
      case "LOW": return "text-green-600";
      default: return "text-gray-600";
    }
  };

  const getBgSeverityColor = (severity: CaseSeverity): string => {
    switch(severity) {
      case "EMERGENCY": return "bg-red-600";
      case "MODERATE": return "bg-amber-600";
      case "LOW": return "bg-green-600";
      default: return "bg-gray-600";
    }
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
    if (!date) return '';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'PPp'); // Format with date-fns 
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto py-4 px-6">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="mr-4"
              onClick={() => navigate("/dashboard")}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {t('common.back')}
            </Button>
            <div>
              <h1 className="text-xl font-semibold flex items-center">
                {t('webCaseView.caseDetails')} 
                <span className="text-gray-500 ml-2">#{caseData.id}</span>
                {reviewCompleted && (
                  <span className="ml-2 bg-green-100 text-green-800 px-2 py-1 text-xs rounded-full flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {t('webCaseView.reviewed')}
                  </span>
                )}
              </h1>
              <p className="text-sm text-gray-500">
                {t('webCaseView.created')} {formatDate(caseData.createdAt)}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto py-6 px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="md:col-span-2 space-y-6">
            {/* Patient Info Card */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle>{t('webCaseView.patientInformation')}</CardTitle>
                  <div className={`px-3 py-1 rounded-full text-white text-sm ${getBgSeverityColor(caseData.severity)}`}>
                    {getSeverityText(caseData.severity)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">{t('webCaseView.name')}</p>
                    <p className="font-medium">{caseData.patientName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t('webCaseView.ageGender')}</p>
                    <p className="font-medium">{caseData.age} / {caseData.gender}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t('webCaseView.contact')}</p>
                    <p className="font-medium">{caseData.contactNumber || t('webCaseView.notProvided')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t('webCaseView.healthWorker')}</p>
                    <p className="font-medium">{caseData.healthWorkerId || t('webCaseView.notAssigned')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs Navigation */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start mb-6 bg-white border border-gray-200 rounded-md">
                <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                  {t('webCaseView.overview')}
                </TabsTrigger>
                <TabsTrigger value="symptoms" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                  {t('webCaseView.symptoms')}
                </TabsTrigger>
                <TabsTrigger value="vitals" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                  {t('webCaseView.vitalSigns')}
                </TabsTrigger>
                <TabsTrigger value="assessment" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                  {t('webCaseView.aiAssessment')}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>{t('webCaseView.caseSummary')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-2">{t('webCaseView.chiefComplaint')}</h3>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-md">
                        {caseData.chiefComplaint || t('webCaseView.noChiefComplaint')}
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="font-medium mb-2">{t('webCaseView.aiAssessment')}</h3>
                      <div className="bg-gray-50 p-3 rounded-md space-y-2">
                        <h4 className="font-medium">{caseData.assessmentTitle || t('webCaseView.noAssessment')}</h4>
                        <p className="text-gray-700">
                          {caseData.assessmentSummary || t('webCaseView.noAssessmentSummary')}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-medium mb-2">{t('webCaseView.recommendations')}</h3>
                      <div className="bg-gray-50 p-3 rounded-md">
                        {Array.isArray(caseData.recommendations) && caseData.recommendations.length > 0 ? (
                          <ul className="list-disc pl-5 space-y-1">
                            {caseData.recommendations.map((rec, index) => (
                              <li key={index} className="text-gray-700">
                                {typeof rec === 'string' ? rec : rec.text}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-500">{t('webCaseView.noRecommendations')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'symptoms' && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>{t('webCaseView.symptomsDetails')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-2">{t('webCaseView.chiefComplaint')}</h3>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-md">
                        {caseData.chiefComplaint || t('webCaseView.noChiefComplaint')}
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="font-medium mb-2">{t('webCaseView.symptomDescription')}</h3>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-md">
                        {caseData.symptomDescription || t('webCaseView.noSymptomDescription')}
                      </p>
                    </div>

                    <div>
                      <h3 className="font-medium mb-2">{t('webCaseView.reportedSymptoms')}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {caseData.symptoms && Object.entries(caseData.symptoms)
                          .filter(([_, value]) => value === true)
                          .map(([key]) => (
                            <div key={key} className="bg-green-50 text-green-700 px-3 py-2 rounded-md flex items-center">
                              <CheckCircle className="h-4 w-4 mr-2" />
                              {t(`symptoms.${key}`)}
                            </div>
                          ))
                        }
                        {(!caseData.symptoms || Object.values(caseData.symptoms).every(v => v === false)) && (
                          <p className="text-gray-500 col-span-full">{t('webCaseView.noSymptomsReported')}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-medium mb-2">{t('webCaseView.additionalNotes')}</h3>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-md">
                        {caseData.additionalNotes || t('webCaseView.noAdditionalNotes')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'vitals' && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>{t('webCaseView.vitalSigns')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <div>
                      <p className="text-sm text-gray-500">{t('webCaseView.temperature')}</p>
                      <p className="font-medium text-lg">
                        {caseData.temperature ? `${caseData.temperature} °C` : t('webCaseView.notRecorded')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('webCaseView.pulse')}</p>
                      <p className="font-medium text-lg">
                        {caseData.pulse ? `${caseData.pulse} bpm` : t('webCaseView.notRecorded')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('webCaseView.bloodPressure')}</p>
                      <p className="font-medium text-lg">
                        {caseData.bpSystolic && caseData.bpDiastolic 
                          ? `${caseData.bpSystolic}/${caseData.bpDiastolic} mmHg` 
                          : t('webCaseView.notRecorded')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('webCaseView.respiratoryRate')}</p>
                      <p className="font-medium text-lg">
                        {caseData.respiratoryRate ? `${caseData.respiratoryRate} /min` : t('webCaseView.notRecorded')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('webCaseView.oxygenSaturation')}</p>
                      <p className="font-medium text-lg">
                        {caseData.oxygenSaturation ? `${caseData.oxygenSaturation}%` : t('webCaseView.notRecorded')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'assessment' && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>{t('webCaseView.aiAssessmentDetails')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-2">{t('webCaseView.severity')}</h3>
                      <div className={`px-3 py-2 rounded-md inline-flex items-center font-medium ${getBgSeverityColor(caseData.severity)} text-white`}>
                        <AlertCircle className="h-4 w-4 mr-2" />
                        {getSeverityText(caseData.severity)}
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-medium mb-2">{t('webCaseView.assessmentTitle')}</h3>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-md font-medium">
                        {caseData.assessmentTitle || t('webCaseView.noAssessmentTitle')}
                      </p>
                    </div>

                    <div>
                      <h3 className="font-medium mb-2">{t('webCaseView.assessmentSummary')}</h3>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-md">
                        {caseData.assessmentSummary || t('webCaseView.noAssessmentSummary')}
                      </p>
                    </div>

                    <div>
                      <h3 className="font-medium mb-2">{t('webCaseView.aiReasoning')}</h3>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-md">
                        {caseData.aiReasoning || t('webCaseView.noAiReasoning')}
                      </p>
                    </div>

                    <div>
                      <h3 className="font-medium mb-2">{t('webCaseView.recommendations')}</h3>
                      <div className="bg-gray-50 p-3 rounded-md">
                        {Array.isArray(caseData.recommendations) && caseData.recommendations.length > 0 ? (
                          <ul className="list-disc pl-5 space-y-1">
                            {caseData.recommendations.map((rec, index) => (
                              <li key={index} className="text-gray-700">
                                {typeof rec === 'string' ? rec : rec.text}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-500">{t('webCaseView.noRecommendations')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column - Actions */}
          <div className="space-y-6">
            {/* Action buttons */}
            <Card>
              <CardHeader>
                <CardTitle>{t('webCaseView.actions')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full justify-start" 
                  onClick={() => setReviewDialogOpen(true)}
                  disabled={reviewCompleted}
                >
                  <RotateCw className="h-4 w-4 mr-2" />
                  {reviewCompleted 
                    ? t('webCaseView.caseAlreadyReviewed') 
                    : t('webCaseView.reviewCase')}
                </Button>

                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => {
                    setFeedbackDialogOpen(true);
                  }}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {t('webCaseView.sendFeedback')}
                </Button>

                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => notifyMutation.mutate()}
                  disabled={notifyMutation.isPending}
                >
                  <Bell className="h-4 w-4 mr-2" />
                  {t('webCaseView.notifyHealthWorker')}
                </Button>
              </CardContent>
            </Card>

            {/* Case Status */}
            <Card>
              <CardHeader>
                <CardTitle>{t('webCaseView.caseStatus')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-2 text-gray-500" />
                    <span className="text-sm">{t('webCaseView.created')}</span>
                  </div>
                  <span className="text-sm">{formatDate(caseData.createdAt)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2 text-gray-500" />
                    <span className="text-sm">{t('webCaseView.severity')}</span>
                  </div>
                  <span className={`text-sm font-medium ${getSeverityColor(caseData.severity)}`}>
                    {getSeverityText(caseData.severity)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-gray-500" />
                    <span className="text-sm">{t('webCaseView.reviewStatus')}</span>
                  </div>
                  <span className={`text-sm font-medium ${reviewCompleted ? 'text-green-600' : 'text-amber-600'}`}>
                    {reviewCompleted ? t('webCaseView.reviewed') : t('webCaseView.pending')}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Bell className="h-4 w-4 mr-2 text-gray-500" />
                    <span className="text-sm">{t('webCaseView.notificationStatus')}</span>
                  </div>
                  <span className={`text-sm font-medium ${caseData.notificationSent ? 'text-green-600' : 'text-amber-600'}`}>
                    {caseData.notificationSent ? t('webCaseView.sent') : t('webCaseView.notSent')}
                    {caseData.notificationSent && caseData.notificationTime && (
                      <> - {formatDate(caseData.notificationTime)}</>
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('webCaseView.reviewCaseDialog')}</DialogTitle>
            <DialogDescription>
              {t('webCaseView.reviewCaseDialogDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('webCaseView.severityAssessment')}</Label>
              <RadioGroup 
                defaultValue={caseData.severity} 
                value={selectedSeverity || undefined} 
                onValueChange={(value) => setSelectedSeverity(value as CaseSeverity)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="EMERGENCY" id="emergency" />
                  <Label htmlFor="emergency" className="text-red-600 font-medium">
                    {t('severity.emergency')}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="MODERATE" id="moderate" />
                  <Label htmlFor="moderate" className="text-amber-600 font-medium">
                    {t('severity.moderate')}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="LOW" id="low" />
                  <Label htmlFor="low" className="text-green-600 font-medium">
                    {t('severity.low')}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback">{t('webCaseView.feedbackForHealthWorker')}</Label>
              <Textarea
                id="feedback"
                placeholder={t('webCaseView.enterFeedback')}
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setReviewDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              onClick={() => markAsReviewedMutation.mutate()}
              disabled={markAsReviewedMutation.isPending || !selectedSeverity}
            >
              {markAsReviewedMutation.isPending ? t('common.submitting') : t('webCaseView.completeReview')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('webCaseView.sendFeedbackToHealthWorker')}</DialogTitle>
            <DialogDescription>
              {t('webCaseView.feedbackDialogDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label htmlFor="feedbackNote">{t('webCaseView.feedbackNote')}</Label>
              <Textarea
                id="feedbackNote"
                placeholder={t('webCaseView.enterFeedbackPlaceholder')}
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setFeedbackDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              onClick={() => feedbackMutation.mutate()}
              disabled={feedbackMutation.isPending || !feedbackNote.trim()}
            >
              {feedbackMutation.isPending ? t('common.sending') : t('webCaseView.sendFeedback')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}