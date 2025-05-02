import { z } from "zod";

// Enum for case severity levels
export type CaseSeverity = "EMERGENCY" | "MODERATE" | "LOW" | "UNKNOWN";

// User roles
export type UserRole = "HEALTH_WORKER" | "DOCTOR" | "ADMIN";

// Symptoms schema for the form
export const symptomsSchema = z.object({
  fever: z.boolean().default(false),
  cough: z.boolean().default(false),
  headache: z.boolean().default(false),
  pain: z.boolean().default(false),
  shortnessOfBreath: z.boolean().default(false),
  vomiting: z.boolean().default(false),
});

// Case form schema - used for form validation
export const caseFormSchema = z.object({
  patientName: z.string().min(1, "Patient name is required"),
  age: z.string().min(1, "Age is required"),
  gender: z.string().min(1, "Gender is required"),
  contactNumber: z.string().optional(),
  
  // Vital signs - all optional but should be numbers if provided
  temperature: z.string().optional(),
  pulse: z.string().optional(),
  bpSystolic: z.string().optional(),
  bpDiastolic: z.string().optional(),
  respiratoryRate: z.string().optional(),
  oxygenSaturation: z.string().optional(),
  
  // Symptoms
  chiefComplaint: z.string().optional(),
  symptoms: symptomsSchema,
  symptomDescription: z.string().optional(),
  additionalNotes: z.string().optional(),
});

// Case schema - for API validation
export const caseSchema = caseFormSchema.extend({
  // Added by AI service
  severity: z.enum(["EMERGENCY", "MODERATE", "LOW", "UNKNOWN"]).optional(),
  assessmentTitle: z.string().optional(),
  assessmentSummary: z.string().optional(),
  aiReasoning: z.string().optional(),
  
  // Added by server
  recommendations: z.array(z.string()).optional(),
  healthWorkerId: z.number().optional(),
  isDraft: z.boolean().optional(),
  notificationSent: z.boolean().optional(),
  notificationTime: z.date().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// AI analysis result type
export interface AIAnalysisResult {
  severity: CaseSeverity;
  assessmentTitle: string;
  assessmentSummary: string;
  aiReasoning: string;
  recommendations: string[];
}

// Main Case type for the application
export interface Case {
  id: number;
  patientName: string;
  age: string;
  gender: string;
  contactNumber?: string;
  
  // Vital signs
  temperature?: string;
  pulse?: string;
  bpSystolic?: string;
  bpDiastolic?: string;
  respiratoryRate?: string;
  oxygenSaturation?: string;
  
  // Symptoms
  chiefComplaint?: string;
  symptoms?: {
    fever: boolean;
    cough: boolean;
    headache: boolean;
    pain: boolean;
    shortnessOfBreath: boolean;
    vomiting: boolean;
  };
  symptomDescription?: string;
  additionalNotes?: string;
  
  // AI assessment
  severity: CaseSeverity;
  assessmentTitle?: string;
  assessmentSummary?: string;
  aiReasoning?: string;
  recommendations?: string[];
  
  // Status
  isDraft?: boolean;
  notificationSent?: boolean;
  notificationTime?: string;
  
  // Relations
  healthWorkerId?: number;
  
  // Timestamps
  createdAt: string | Date;
  updatedAt: string | Date;
}

// User types
export interface User {
  id: number;
  name: string;
  phone: string;
  role: UserRole;
  language?: string;
  password?: string;
  healthWorker?: HealthWorker;
  doctor?: Doctor;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface HealthWorker {
  id: number;
  userId: number;
  areaCode?: string;
  primaryHealthCenterId?: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Doctor {
  id: number;
  userId: number;
  specialization?: string;
  primaryHealthCenterId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PrimaryHealthCenter {
  id: number;
  name: string;
  location: string;
  contactNumber?: string;
  createdAt: string;
  updatedAt: string;
}

// OTP verification types
export interface OtpRequest {
  phone: string;
}

export interface OtpVerification {
  phone: string;
  otp: string;
}

// AI feedback type
export interface AiFeedback {
  caseId: number;
  originalSeverity: CaseSeverity;
  correctedSeverity: CaseSeverity;
  feedbackNotes?: string;
  userId: number;
}
