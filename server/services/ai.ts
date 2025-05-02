import { Case, AIAnalysisResult, CaseSeverity } from "@shared/types";

// Import Google Gemini API if available
// In a real application, we would use the actual API
// For now, we'll implement rule-based triage as a fallback
let useGeminiApi = false;

try {
  // This would be replaced with actual Gemini API import
  // const { GoogleGenerativeAI } = require("@google/generative-ai");
  useGeminiApi = !!process.env.GEMINI_API_KEY;
} catch (error) {
  console.warn("Google Gemini API not available, using rule-based fallback logic");
}

// Initialize Gemini API client if available
// This would be uncommented in a real application
// const genAI = useGeminiApi 
//   ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
//   : null;

/**
 * Analyze patient case data using AI
 * Falls back to rule-based triage if AI API is not available
 */
export async function analyzeCase(caseData: Partial<Case>): Promise<AIAnalysisResult> {
  if (useGeminiApi) {
    try {
      return await analyzeWithGemini(caseData);
    } catch (error) {
      console.error("Error with Gemini API:", error);
      // Fall back to rule-based if AI fails
      return ruleBasedTriage(caseData);
    }
  } else {
    return ruleBasedTriage(caseData);
  }
}

/**
 * Analyze case with Google Gemini API
 * This would be implemented with the actual API in production
 */
async function analyzeWithGemini(caseData: Partial<Case>): Promise<AIAnalysisResult> {
  // This is a placeholder for the actual Gemini API implementation
  // In a real app, we would create a proper prompt and call the API
  
  // const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  
  // Format the case data into a prompt
  const prompt = createCasePrompt(caseData);
  
  // const result = await model.generateContent(prompt);
  // const response = await result.response;
  // const text = response.text();
  
  // Parse the AI response to extract structured data
  // For now, we'll just call our rule-based function
  return ruleBasedTriage(caseData);
}

/**
 * Create a prompt for the AI model based on the case data
 */
function createCasePrompt(caseData: Partial<Case>): string {
  const vitals = [];
  if (caseData.temperature) vitals.push(`Temperature: ${caseData.temperature}°F`);
  if (caseData.pulse) vitals.push(`Pulse: ${caseData.pulse} bpm`);
  if (caseData.bpSystolic && caseData.bpDiastolic) {
    vitals.push(`Blood Pressure: ${caseData.bpSystolic}/${caseData.bpDiastolic} mmHg`);
  }
  if (caseData.respiratoryRate) vitals.push(`Respiratory Rate: ${caseData.respiratoryRate} breaths/min`);
  if (caseData.oxygenSaturation) vitals.push(`Oxygen Saturation: ${caseData.oxygenSaturation}%`);
  
  const symptoms = [];
  if (caseData.chiefComplaint) symptoms.push(`Chief Complaint: ${caseData.chiefComplaint}`);
  if (caseData.symptoms) {
    if (caseData.symptoms.fever) symptoms.push("Fever");
    if (caseData.symptoms.cough) symptoms.push("Cough");
    if (caseData.symptoms.headache) symptoms.push("Headache");
    if (caseData.symptoms.pain) symptoms.push("Pain");
    if (caseData.symptoms.shortnessOfBreath) symptoms.push("Shortness of breath");
    if (caseData.symptoms.vomiting) symptoms.push("Vomiting");
  }
  if (caseData.symptomDescription) symptoms.push(`Details: ${caseData.symptomDescription}`);
  
  return `
    You are a medical triage AI assistant for rural healthcare workers. Analyze this patient case and classify its urgency:
    
    Patient: ${caseData.patientName}, ${caseData.age}${caseData.gender}
    
    Vital Signs:
    ${vitals.join('\n')}
    
    Symptoms:
    ${symptoms.join('\n')}
    
    Additional Notes:
    ${caseData.additionalNotes || 'None'}
    
    Please classify this case as:
    1. EMERGENCY (requires immediate medical attention)
    2. MODERATE (requires attention within 24 hours)
    3. LOW (can be managed routinely)
    
    Provide the following in your response:
    - Severity classification
    - A short assessment title
    - A brief assessment summary
    - Detailed reasoning
    - 3-5 recommended actions for the healthcare worker
  `;
}

/**
 * Rule-based triage for when AI is not available
 * This implements basic clinical rules for emergency, moderate, and low severity cases
 */
function ruleBasedTriage(caseData: Partial<Case>): AIAnalysisResult {
  // Convert string values to numbers for comparison
  const temperature = caseData.temperature ? parseFloat(caseData.temperature) : undefined;
  const pulse = caseData.pulse ? parseInt(caseData.pulse, 10) : undefined;
  const systolic = caseData.bpSystolic ? parseInt(caseData.bpSystolic, 10) : undefined;
  const diastolic = caseData.bpDiastolic ? parseInt(caseData.bpDiastolic, 10) : undefined;
  const respiratoryRate = caseData.respiratoryRate ? parseInt(caseData.respiratoryRate, 10) : undefined;
  const oxygenSaturation = caseData.oxygenSaturation ? parseInt(caseData.oxygenSaturation, 10) : undefined;
  
  // Check for emergency conditions first
  if (
    (temperature && temperature > 103) ||
    (pulse && pulse > 120) ||
    (systolic && systolic > 180) ||
    (diastolic && diastolic > 120) ||
    (respiratoryRate && respiratoryRate > 30) ||
    (oxygenSaturation && oxygenSaturation < 90) ||
    caseData.symptoms?.shortnessOfBreath ||
    (caseData.chiefComplaint && /chest pain|difficulty breathing|unconscious|bleeding|stroke|seizure/i.test(caseData.chiefComplaint))
  ) {
    return createEmergencyAssessment(caseData);
  }
  
  // Check for moderate conditions
  if (
    (temperature && temperature > 100.5) ||
    (pulse && pulse > 100) ||
    (systolic && systolic > 140) ||
    (diastolic && diastolic > 90) ||
    (respiratoryRate && respiratoryRate > 20) ||
    (oxygenSaturation && oxygenSaturation < 95) ||
    caseData.symptoms?.fever ||
    caseData.symptoms?.vomiting ||
    (caseData.chiefComplaint && /pain|fever|dehydration|infection/i.test(caseData.chiefComplaint))
  ) {
    return createModerateAssessment(caseData);
  }
  
  // Default to low severity
  return createLowAssessment(caseData);
}

/**
 * Generate emergency assessment for critical cases
 */
function createEmergencyAssessment(caseData: Partial<Case>): AIAnalysisResult {
  let title = "Immediate Medical Attention Required";
  let summary = "The patient requires immediate medical attention and transfer to a higher care facility.";
  let reasoning = "The patient presents with critical vital signs and/or symptoms that indicate a potentially life-threatening condition. ";
  let recommendations = [
    "Arrange immediate transport to nearest medical facility",
    "Continuously monitor vital signs during transport",
    "Alert receiving facility about incoming emergency",
    "Provide basic life support as needed"
  ];
  
  // Add specific reasoning based on the case data
  if (caseData.symptoms?.shortnessOfBreath) {
    reasoning += "The patient's shortness of breath may indicate respiratory distress. ";
  }
  
  if (caseData.chiefComplaint && /chest pain/i.test(caseData.chiefComplaint)) {
    reasoning += "The chest pain reported could indicate a cardiac event. ";
    recommendations.push("If available and no contraindications, consider administering aspirin");
  }
  
  if (caseData.temperature && parseFloat(caseData.temperature) > 103) {
    reasoning += `High fever (${caseData.temperature}°F) suggests severe infection. `;
    recommendations = [
      ...recommendations,
      "Implement cooling measures to reduce temperature"
    ];
  }
  
  if (caseData.oxygenSaturation && parseInt(caseData.oxygenSaturation, 10) < 90) {
    reasoning += `Low oxygen saturation (${caseData.oxygenSaturation}%) indicates significant respiratory compromise. `;
    recommendations = [
      "Administer oxygen if available",
      ...recommendations
    ];
  }
  
  return {
    severity: "EMERGENCY",
    assessmentTitle: title,
    assessmentSummary: summary,
    aiReasoning: reasoning,
    recommendations
  };
}

/**
 * Generate moderate assessment for cases requiring attention within 24 hours
 */
function createModerateAssessment(caseData: Partial<Case>): AIAnalysisResult {
  let title = "Prompt Medical Attention Needed";
  let summary = "The patient should be seen by a healthcare provider within 24 hours.";
  let reasoning = "The patient has concerning symptoms or vital signs that require medical evaluation but are not immediately life-threatening. ";
  let recommendations = [
    "Schedule follow-up within 24 hours",
    "Monitor for worsening symptoms",
    "Provide symptomatic relief as appropriate",
    "Ensure adequate hydration and rest"
  ];
  
  // Add specific reasoning based on the case data
  if (caseData.symptoms?.fever) {
    reasoning += "The patient has fever which may indicate infection. ";
    
    if (caseData.symptoms?.cough) {
      reasoning += "The combination of fever and cough suggests a respiratory infection. ";
      recommendations.push("Consider respiratory infection precautions");
    }
  }
  
  if (caseData.symptoms?.vomiting) {
    reasoning += "Vomiting raises concerns about dehydration. ";
    recommendations = [
      "Ensure adequate fluid intake",
      ...recommendations
    ];
  }
  
  if (caseData.bpSystolic && parseInt(caseData.bpSystolic, 10) > 140) {
    reasoning += `Elevated blood pressure (${caseData.bpSystolic}/${caseData.bpDiastolic}) requires monitoring. `;
    recommendations.push("Check blood pressure again in 1-2 hours");
  }
  
  return {
    severity: "MODERATE",
    assessmentTitle: title,
    assessmentSummary: summary,
    aiReasoning: reasoning,
    recommendations
  };
}

/**
 * Generate low severity assessment for routine cases
 */
function createLowAssessment(caseData: Partial<Case>): AIAnalysisResult {
  let title = "Routine Care Appropriate";
  let summary = "The patient's condition can be managed with routine care.";
  let reasoning = "The patient has stable vital signs and mild symptoms that can be managed with standard care and monitoring. ";
  let recommendations = [
    "Provide home care instructions",
    "Advise on over-the-counter medications if appropriate",
    "Return if symptoms worsen",
    "Follow up as needed"
  ];
  
  // Add specific reasoning based on the case data
  if (caseData.symptoms?.cough) {
    reasoning += "The patient's cough appears to be mild without other concerning symptoms. ";
    recommendations.push("Recommend warm fluids and throat lozenges for cough");
  }
  
  if (caseData.symptoms?.headache) {
    reasoning += "The headache reported does not have associated warning signs. ";
    recommendations.push("Suggest appropriate pain relief measures");
  }
  
  if (caseData.additionalNotes) {
    reasoning += "Additional context has been considered in this assessment. ";
  }
  
  return {
    severity: "LOW",
    assessmentTitle: title,
    assessmentSummary: summary,
    aiReasoning: reasoning,
    recommendations
  };
}
