import { formatDistanceToNow } from "date-fns";
import { useLanguage } from "@/lib/i18n";
import { Case, CaseSeverity } from "@shared/types";

interface CaseCardProps {
  caseData: Case;
  onClick: () => void;
}

export default function CaseCard({ caseData, onClick }: CaseCardProps) {
  const { t } = useLanguage();

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

  const getSymptomText = () => {
    if (caseData.chiefComplaint) {
      return caseData.chiefComplaint;
    }
    
    const symptoms = [];
    if (caseData.symptoms?.fever) symptoms.push(t('symptoms.fever'));
    if (caseData.symptoms?.cough) symptoms.push(t('symptoms.cough'));
    if (caseData.symptoms?.headache) symptoms.push(t('symptoms.headache'));
    if (caseData.symptoms?.pain) symptoms.push(t('symptoms.pain'));
    if (caseData.symptoms?.shortnessOfBreath) symptoms.push(t('symptoms.shortnessOfBreath'));
    if (caseData.symptoms?.vomiting) symptoms.push(t('symptoms.vomiting'));
    
    return symptoms.join(', ') || t('symptoms.none');
  };

  const getVitalsText = () => {
    const vitals = [];
    
    if (caseData.bpSystolic && caseData.bpDiastolic) {
      vitals.push(`BP ${caseData.bpSystolic}/${caseData.bpDiastolic}`);
    }
    
    if (caseData.pulse) {
      vitals.push(`${t('newCase.pulse')} ${caseData.pulse}`);
    }
    
    if (caseData.temperature) {
      vitals.push(`${t('newCase.temperature')} ${caseData.temperature}°F`);
    }
    
    return vitals.join(', ') || t('caseResult.noVitals');
  };

  // Determine color classes based on severity
  const colorClass = getSeverityColor(caseData.severity);
  
  return (
    <div 
      className={`bg-white p-4 rounded-lg shadow-sm border-l-4 border-${colorClass} cursor-pointer hover:shadow-md transition-shadow`}
      onClick={onClick}
    >
      <div className="flex justify-between">
        <div>
          <h3 className="font-medium">{caseData.patientName}, {caseData.age}{caseData.gender}</h3>
          <p className="text-sm text-neutral-500">{t('caseResult.caseId')}: #{caseData.id}</p>
        </div>
        <span className={`px-2 py-1 bg-${colorClass} text-white text-xs rounded-full flex items-center`}>
          {getSeverityText(caseData.severity)}
        </span>
      </div>
      
      <div className="mt-2">
        <p className="text-sm mb-1">
          <span className="font-medium">{t('newCase.symptoms')}:</span> {getSymptomText()}
        </p>
        <p className="text-sm mb-1">
          <span className="font-medium">{t('newCase.vitalSigns')}:</span> {getVitalsText()}
        </p>
        <p className="text-sm">
          <span className="font-medium">{t('caseResult.aiAssessment')}:</span> {caseData.assessmentSummary}
        </p>
      </div>
      
      <div className="mt-3 flex justify-between">
        <span className="text-xs text-neutral-500">{getTimeAgo(caseData.createdAt)}</span>
        <button className="text-primary text-sm hover:underline">
          {t('caseResult.viewDetails')}
        </button>
      </div>
    </div>
  );
}
