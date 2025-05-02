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
  ChevronLeft, XCircle, PieChart, Clock,
  UserCheck, Building, MoveRight, Ambulance, CalendarClock
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import LoadingOverlay from "@/components/LoadingOverlay";
import { 
  Case, CaseSeverity, AiFeedback, CaseStatus, 
  FeedbackType, MedicalFeedback, User, PrimaryHealthCenter 
} from "@shared/types";

export default function WebCaseView() {
  const params = useParams();
  const id = params.id;
  console.log("WebCaseView params:", params, "id:", id);
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [referDialogOpen, setReferDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [emergencyDialogOpen, setEmergencyDialogOpen] = useState(false);
  
  // Form state
  const [feedbackNote, setFeedbackNote] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<CaseSeverity | null>(null);
  const [reviewCompleted, setReviewCompleted] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<CaseStatus>('PENDING');
  const [selectedFeedbackType, setSelectedFeedbackType] = useState<FeedbackType>('TREATMENT_SUGGESTION');
  const [actionRequired, setActionRequired] = useState(false);
  const [selectedFollowUpDate, setSelectedFollowUpDate] = useState<Date | undefined>(undefined);
  const [emergencyNotes, setEmergencyNotes] = useState('');
  
  // For assignment & referral
  const [selectedDoctor, setSelectedDoctor] = useState<number | null>(null);
  const [selectedCenter, setSelectedCenter] = useState<number | null>(null);

  // Fetch case data
  const { data: caseData, isLoading, error } = useQuery<Case>({
    queryKey: [`/api/cases/${id}`],
    enabled: !!id, // Only run query if id exists
    retry: 3,
    onError: (error) => console.error("Error fetching case data:", error)
  });
  
  console.log("Case data fetch status:", { id, isLoading, hasData: !!caseData, error });
  
  // Set initial page title with case ID
  useEffect(() => {
    document.title = `RuTAI - ${t('webCaseView.title')} #${id}`;
  }, [t, id]);
  
  // Update title with patient name once data is loaded
  useEffect(() => {
    if (caseData && caseData.patientName) {
      document.title = `RuTAI - ${caseData.patientName} - ${t('webCaseView.title')}`;
    }
  }, [caseData, t]);

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
      const res = await apiRequest("POST", `/api/web-cases/${id}/feedback`, {
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
      const res = await apiRequest("POST", `/api/web-cases/${id}/severity`, data);
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
      const res = await apiRequest("POST", `/api/web-cases/${id}/review`, {
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
      const res = await apiRequest("POST", `/api/web-cases/${id}/notify`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
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
  
  // Update case status
  const updateStatusMutation = useMutation({
    mutationFn: async (status: CaseStatus) => {
      const res = await apiRequest("POST", `/api/web-cases/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      toast({
        title: t('webCaseView.statusUpdated'),
        description: t('webCaseView.statusUpdatedDesc'),
      });
      setStatusDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: error.message || t('webCaseView.statusUpdateFailed'),
        variant: "destructive",
      });
    },
  });
  
  // Send medical feedback
  const medicalFeedbackMutation = useMutation({
    mutationFn: async (data: Partial<MedicalFeedback>) => {
      const res = await apiRequest("POST", `/api/web-cases/${id}/medical-feedback`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${id}`] });
      toast({
        title: t('webCaseView.feedbackSaved'),
        description: t('webCaseView.feedbackSavedDesc'),
      });
      setFeedbackDialogOpen(false);
      setFeedbackNote('');
      setSelectedFeedbackType('TREATMENT_SUGGESTION');
      setActionRequired(false);
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: error.message || t('webCaseView.feedbackSaveFailed'),
        variant: "destructive",
      });
    },
  });
  
  // Assign doctor
  const assignDoctorMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/web-cases/${id}/assign`, { 
        doctorId: selectedDoctor 
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${id}`] });
      toast({
        title: t('webCaseView.doctorAssigned'),
        description: t('webCaseView.doctorAssignedDesc'),
      });
      setAssignDialogOpen(false);
      setSelectedDoctor(null);
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: error.message || t('webCaseView.assignmentFailed'),
        variant: "destructive",
      });
    },
  });
  
  // Refer to center
  const referToCenterMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/web-cases/${id}/refer`, { 
        centerId: selectedCenter 
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${id}`] });
      toast({
        title: t('webCaseView.referred'),
        description: t('webCaseView.referredDesc'),
      });
      setReferDialogOpen(false);
      setSelectedCenter(null);
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: error.message || t('webCaseView.referralFailed'),
        variant: "destructive",
      });
    },
  });
  
  // Schedule follow-up
  const scheduleFollowUpMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/web-cases/${id}/follow-up`, { 
        followUpDate: selectedFollowUpDate
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${id}`] });
      toast({
        title: t('webCaseView.followUpScheduled'),
        description: t('webCaseView.followUpScheduledDesc'),
      });
      setFollowUpDialogOpen(false);
      setSelectedFollowUpDate(undefined);
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: error.message || t('webCaseView.schedulingFailed'),
        variant: "destructive",
      });
    },
  });
  
  // Trigger emergency action
  const triggerEmergencyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/web-cases/${id}/emergency`, { 
        notes: emergencyNotes
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${id}`] });
      toast({
        title: t('webCaseView.emergencyTriggered'),
        description: t('webCaseView.emergencyTriggeredDesc'),
        variant: "destructive",
      });
      setEmergencyDialogOpen(false);
      setEmergencyNotes('');
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: error.message || t('webCaseView.emergencyTriggerFailed'),
        variant: "destructive",
      });
    },
  });

  // Handle missing ID parameter
  if (!id) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-4">
        <h1 className="text-2xl font-bold text-red-600 mb-4">{t('common.error')}</h1>
        <p className="mb-6 text-center">Case ID is missing from the URL. Please go back to the dashboard and try again.</p>
        <Button onClick={() => navigate('/web-dashboard')}>
          Return to Dashboard
        </Button>
      </div>
    );
  }
  
  // Handle loading state
  if (isLoading) {
    return <LoadingOverlay message={t('caseResult.loading')} />;
  }
  
  // Handle error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-4">
        <h1 className="text-2xl font-bold text-red-600 mb-4">{t('common.error')}</h1>
        <p className="mb-6 text-center">Error loading case data. The case may not exist or you might not have permission to view it.</p>
        <Button onClick={() => navigate('/web-dashboard')}>
          Return to Dashboard
        </Button>
      </div>
    );
  }
  
  // Handle missing data after loading completes
  if (!caseData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-4">
        <h1 className="text-2xl font-bold text-red-600 mb-4">{t('common.notFound')}</h1>
        <p className="mb-6 text-center">The requested case could not be found. It may have been deleted or you might not have permission to view it.</p>
        <Button onClick={() => navigate('/web-dashboard')}>
          Return to Dashboard
        </Button>
      </div>
    );
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
  
  // Get status text
  const getCaseStatusText = (status: CaseStatus): string => {
    switch(status) {
      case "PENDING": return t('caseStatus.pending');
      case "STABLE": return t('caseStatus.stable');
      case "NEEDS_ATTENTION": return t('caseStatus.needsAttention');
      case "CRITICAL": return t('caseStatus.critical');
      case "CLOSED": return t('caseStatus.closed');
      default: return t('caseStatus.pending');
    }
  };
  
  // Get status color
  const getCaseStatusColor = (status: CaseStatus | string): string => {
    switch(status) {
      case "PENDING": return "text-amber-600";
      case "STABLE": return "text-green-600";
      case "NEEDS_ATTENTION": return "text-blue-600";
      case "CRITICAL": return "text-red-600";
      case "CLOSED": return "text-gray-600";
      default: return "text-amber-600";
    }
  };
  
  // Get feedback type text
  const getFeedbackTypeText = (type: FeedbackType): string => {
    switch(type) {
      case "TREATMENT_SUGGESTION": return t('feedbackType.treatmentSuggestion');
      case "REFERRAL": return t('feedbackType.referral');
      case "FOLLOW_UP": return t('feedbackType.followUp');
      case "EMERGENCY_ACTION": return t('feedbackType.emergencyAction');
      case "OTHER": return t('feedbackType.other');
      default: return t('feedbackType.other');
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
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                className="mr-4"
                onClick={() => navigate("/web-dashboard")}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t('common.back')}
              </Button>
              <div>
                <h1 className="text-xl font-semibold flex items-center">
                  {t('webCaseView.title')} 
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
            <NotificationBell />
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
                  onClick={() => setStatusDialogOpen(true)}
                >
                  <PieChart className="h-4 w-4 mr-2" />
                  {t('webCaseView.updateStatus')}
                </Button>

                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => setFeedbackDialogOpen(true)}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {t('webCaseView.sendMedicalFeedback')}
                </Button>
                
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => setAssignDialogOpen(true)}
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  {t('webCaseView.assignDoctor')}
                </Button>
                
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => setReferDialogOpen(true)}
                >
                  <MoveRight className="h-4 w-4 mr-2" />
                  {t('webCaseView.referToCenter')}
                </Button>
                
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => setFollowUpDialogOpen(true)}
                >
                  <CalendarClock className="h-4 w-4 mr-2" />
                  {t('webCaseView.scheduleFollowUp')}
                </Button>
                
                <Button 
                  className="w-full justify-start" 
                  variant={caseData.severity === 'EMERGENCY' ? 'destructive' : 'outline'}
                  onClick={() => setEmergencyDialogOpen(true)}
                >
                  <Ambulance className="h-4 w-4 mr-2" />
                  {t('webCaseView.triggerEmergency')}
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
                    <PieChart className="h-4 w-4 mr-2 text-gray-500" />
                    <span className="text-sm">{t('webCaseView.caseStatus')}</span>
                  </div>
                  <span className={`text-sm font-medium ${getCaseStatusColor(caseData.status || 'PENDING')}`}>
                    {getCaseStatusText(caseData.status as CaseStatus || 'PENDING')}
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
                
                {caseData.reviewedAt && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2 text-gray-500" />
                      <span className="text-sm">{t('webCaseView.reviewedAt')}</span>
                    </div>
                    <span className="text-sm">{formatDate(caseData.reviewedAt)}</span>
                  </div>
                )}
                
                {caseData.reviewedBy && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <UserCheck className="h-4 w-4 mr-2 text-gray-500" />
                      <span className="text-sm">{t('webCaseView.reviewedBy')}</span>
                    </div>
                    <span className="text-sm">ID: {caseData.reviewedBy}</span>
                  </div>
                )}
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
                defaultValue={caseData.severity || "UNKNOWN"} 
                value={selectedSeverity || ""} 
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

      {/* Medical Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('webCaseView.sendMedicalFeedback')}</DialogTitle>
            <DialogDescription>
              {t('webCaseView.medicalFeedbackDialogDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feedbackType">{t('webCaseView.feedbackType')}</Label>
              <Select
                value={selectedFeedbackType}
                onValueChange={(value) => setSelectedFeedbackType(value as FeedbackType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('webCaseView.selectFeedbackType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TREATMENT_SUGGESTION">{t('feedbackType.treatmentSuggestion')}</SelectItem>
                  <SelectItem value="REFERRAL">{t('feedbackType.referral')}</SelectItem>
                  <SelectItem value="FOLLOW_UP">{t('feedbackType.followUp')}</SelectItem>
                  <SelectItem value="EMERGENCY_ACTION">{t('feedbackType.emergencyAction')}</SelectItem>
                  <SelectItem value="OTHER">{t('feedbackType.other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="feedbackNote">{t('webCaseView.feedbackContent')}</Label>
              <Textarea
                id="feedbackNote"
                placeholder={t('webCaseView.enterMedicalFeedbackPlaceholder')}
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                rows={6}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="actionRequired" 
                checked={actionRequired}
                onCheckedChange={(checked) => setActionRequired(checked as boolean)}
              />
              <Label 
                htmlFor="actionRequired"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t('webCaseView.actionRequired')}
              </Label>
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
              onClick={() => medicalFeedbackMutation.mutate({
                caseId: Number(id),
                doctorId: 1, // Replace with actual doctor ID from auth
                feedbackType: selectedFeedbackType,
                content: feedbackNote,
                actionRequired,
                status: 'SENT'
              })}
              disabled={medicalFeedbackMutation.isPending || !feedbackNote.trim()}
            >
              {medicalFeedbackMutation.isPending ? t('common.sending') : t('webCaseView.sendFeedback')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Case Status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('webCaseView.updateCaseStatus')}</DialogTitle>
            <DialogDescription>
              {t('webCaseView.updateCaseStatusDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label>{t('webCaseView.selectStatus')}</Label>
              <RadioGroup 
                defaultValue={caseData.status || "PENDING"} 
                value={selectedStatus} 
                onValueChange={(value) => setSelectedStatus(value as CaseStatus)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PENDING" id="pending" />
                  <Label htmlFor="pending" className="text-amber-600 font-medium">
                    {t('caseStatus.pending')}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="STABLE" id="stable" />
                  <Label htmlFor="stable" className="text-green-600 font-medium">
                    {t('caseStatus.stable')}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="NEEDS_ATTENTION" id="needs_attention" />
                  <Label htmlFor="needs_attention" className="text-blue-600 font-medium">
                    {t('caseStatus.needsAttention')}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="CRITICAL" id="critical" />
                  <Label htmlFor="critical" className="text-red-600 font-medium">
                    {t('caseStatus.critical')}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="CLOSED" id="closed" />
                  <Label htmlFor="closed" className="text-gray-600 font-medium">
                    {t('caseStatus.closed')}
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setStatusDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              onClick={() => updateStatusMutation.mutate(selectedStatus)}
              disabled={updateStatusMutation.isPending || !selectedStatus}
            >
              {updateStatusMutation.isPending ? t('common.updating') : t('webCaseView.updateStatus')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Assign Doctor Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('webCaseView.assignDoctor')}</DialogTitle>
            <DialogDescription>
              {t('webCaseView.assignDoctorDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label htmlFor="doctorSelect">{t('webCaseView.selectDoctor')}</Label>
              <Select
                value={selectedDoctor?.toString() || ""}
                onValueChange={(value) => setSelectedDoctor(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('webCaseView.selectDoctorPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {/* This would be populated from a query to get doctors */}
                  <SelectItem value="1">Dr. Aarav Patel</SelectItem>
                  <SelectItem value="2">Dr. Priya Sharma</SelectItem>
                  <SelectItem value="3">Dr. Vikram Singh</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setAssignDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              onClick={() => assignDoctorMutation.mutate()}
              disabled={assignDoctorMutation.isPending || !selectedDoctor}
            >
              {assignDoctorMutation.isPending ? t('common.assigning') : t('webCaseView.assignDoctor')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Refer to Center Dialog */}
      <Dialog open={referDialogOpen} onOpenChange={setReferDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('webCaseView.referToCenter')}</DialogTitle>
            <DialogDescription>
              {t('webCaseView.referToCenterDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label htmlFor="centerSelect">{t('webCaseView.selectCenter')}</Label>
              <Select
                value={selectedCenter?.toString() || ""}
                onValueChange={(value) => setSelectedCenter(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('webCaseView.selectCenterPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {/* This would be populated from a query to get centers */}
                  <SelectItem value="1">Kanchipuram District Hospital</SelectItem>
                  <SelectItem value="2">Chennai General Hospital</SelectItem>
                  <SelectItem value="3">Vellore Medical Center</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setReferDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              onClick={() => referToCenterMutation.mutate()}
              disabled={referToCenterMutation.isPending || !selectedCenter}
            >
              {referToCenterMutation.isPending ? t('common.referring') : t('webCaseView.refer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Follow-up Dialog */}
      <Dialog open={followUpDialogOpen} onOpenChange={setFollowUpDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('webCaseView.scheduleFollowUp')}</DialogTitle>
            <DialogDescription>
              {t('webCaseView.scheduleFollowUpDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label>{t('webCaseView.selectFollowUpDate')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarClock className="mr-2 h-4 w-4" />
                    {selectedFollowUpDate ? (
                      format(selectedFollowUpDate, 'PPP')
                    ) : (
                      <span>{t('webCaseView.pickFollowUpDate')}</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedFollowUpDate}
                    onSelect={setSelectedFollowUpDate}
                    initialFocus
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setFollowUpDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              onClick={() => scheduleFollowUpMutation.mutate()}
              disabled={scheduleFollowUpMutation.isPending || !selectedFollowUpDate}
            >
              {scheduleFollowUpMutation.isPending ? t('common.scheduling') : t('webCaseView.scheduleFollowUp')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Emergency Dialog */}
      <Dialog open={emergencyDialogOpen} onOpenChange={setEmergencyDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">{t('webCaseView.triggerEmergencyAction')}</DialogTitle>
            <DialogDescription>
              {t('webCaseView.emergencyActionDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label htmlFor="emergencyNotes">{t('webCaseView.emergencyNotes')}</Label>
              <Textarea
                id="emergencyNotes"
                placeholder={t('webCaseView.emergencyNotesPlaceholder')}
                value={emergencyNotes}
                onChange={(e) => setEmergencyNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEmergencyDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              onClick={() => triggerEmergencyMutation.mutate()}
              disabled={triggerEmergencyMutation.isPending}
            >
              {triggerEmergencyMutation.isPending 
                ? t('common.triggering') 
                : t('webCaseView.triggerEmergency')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}