import { pgTable, text, serial, integer, timestamp, boolean, json, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// User table for all user types
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  password: text("password"),
  role: text("role", { enum: ["HEALTH_WORKER", "DOCTOR", "ADMIN"] }).notNull(),
  language: text("language").default("en"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Health workers (field workers)
export const healthWorkers = pgTable("health_workers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  areaCode: text("area_code"),
  primaryHealthCenterId: integer("phc_id").references(() => primaryHealthCenters.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Doctors
export const doctors = pgTable("doctors", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  specialization: text("specialization"),
  primaryHealthCenterId: integer("phc_id").references(() => primaryHealthCenters.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Primary Health Centers
export const primaryHealthCenters = pgTable("primary_health_centers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  contactNumber: text("contact_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// OTP verification
export const otps = pgTable("otps", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isUsed: boolean("is_used").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Cases (patient triage cases)
export const cases = pgTable("cases", {
  id: serial("id").primaryKey(),
  patientName: text("patient_name").notNull(),
  age: text("age").notNull(),
  gender: text("gender").notNull(),
  contactNumber: text("contact_number"),
  
  // Vital signs
  temperature: text("temperature"),
  pulse: text("pulse"),
  bpSystolic: text("bp_systolic"),
  bpDiastolic: text("bp_diastolic"),
  respiratoryRate: text("respiratory_rate"),
  oxygenSaturation: text("oxygen_saturation"),
  
  // Symptoms
  chiefComplaint: text("chief_complaint"),
  symptoms: json("symptoms").default({}),
  symptomDescription: text("symptom_description"),
  additionalNotes: text("additional_notes"),
  
  // AI assessment
  severity: text("severity", { enum: ["EMERGENCY", "MODERATE", "LOW", "UNKNOWN"] }).default("UNKNOWN"),
  assessmentTitle: text("assessment_title"),
  assessmentSummary: text("assessment_summary"),
  aiReasoning: text("ai_reasoning"),
  
  // Status tracking
  isDraft: boolean("is_draft").default(false),
  notificationSent: boolean("notification_sent").default(false),
  notificationTime: timestamp("notification_time"),
  reviewed: boolean("reviewed").default(false),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  
  // Enhanced case management
  status: text("status", { enum: ["PENDING", "STABLE", "NEEDS_ATTENTION", "CRITICAL", "CLOSED"] }).default("PENDING"),
  assignedDoctorId: integer("assigned_doctor_id").references(() => users.id),
  assignedAt: timestamp("assigned_at"),
  assignedBy: integer("assigned_by").references(() => users.id),
  referredToCenterId: integer("referred_to_center_id").references(() => primaryHealthCenters.id),
  referredAt: timestamp("referred_at"),
  followUpRequired: boolean("follow_up_required").default(false),
  followUpDate: timestamp("follow_up_date"),
  closedAt: timestamp("closed_at"),
  closedBy: integer("closed_by").references(() => users.id),
  closedReason: text("closed_reason"),
  
  // Relations
  healthWorkerId: integer("health_worker_id").references(() => healthWorkers.id),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Case recommendations (separate table for list of recommendations)
export const caseRecommendations = pgTable("case_recommendations", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").references(() => cases.id).notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI feedback for model improvement
export const aiFeedback = pgTable("ai_feedback", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").references(() => cases.id).notNull(),
  originalSeverity: text("original_severity", { enum: ["EMERGENCY", "MODERATE", "LOW", "UNKNOWN"] }),
  correctedSeverity: text("corrected_severity", { enum: ["EMERGENCY", "MODERATE", "LOW", "UNKNOWN"] }),
  feedbackNotes: text("feedback_notes"),
  userId: integer("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Medical feedback from professionals
export const medicalFeedback = pgTable("medical_feedback", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").references(() => cases.id).notNull(),
  feedbackType: text("feedback_type", { enum: ["TREATMENT_SUGGESTION", "REFERRAL", "FOLLOW_UP", "EMERGENCY_ACTION", "OTHER"] }).notNull(),
  feedbackText: text("feedback_text").notNull(),
  actionRequired: boolean("action_required").default(false),
  actionCompleted: boolean("action_completed").default(false),
  actionCompletedAt: timestamp("action_completed_at"),
  actionCompletedBy: integer("action_completed_by").references(() => users.id),
  userId: integer("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Session table for storing session data
export const sessions = pgTable("sessions", {
  sid: text("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

// Relations
export const userRelations = relations(users, ({ one, many }) => ({
  healthWorker: one(healthWorkers, {
    fields: [users.id],
    references: [healthWorkers.userId],
  }),
  doctor: one(doctors, {
    fields: [users.id],
    references: [doctors.userId],
  }),
}));

export const healthWorkerRelations = relations(healthWorkers, ({ one, many }) => ({
  user: one(users, {
    fields: [healthWorkers.userId],
    references: [users.id],
  }),
  primaryHealthCenter: one(primaryHealthCenters, {
    fields: [healthWorkers.primaryHealthCenterId],
    references: [primaryHealthCenters.id],
  }),
  cases: many(cases),
}));

export const doctorRelations = relations(doctors, ({ one }) => ({
  user: one(users, {
    fields: [doctors.userId],
    references: [users.id],
  }),
  primaryHealthCenter: one(primaryHealthCenters, {
    fields: [doctors.primaryHealthCenterId],
    references: [primaryHealthCenters.id],
  }),
}));

export const caseRelations = relations(cases, ({ one, many }) => ({
  healthWorker: one(healthWorkers, {
    fields: [cases.healthWorkerId],
    references: [healthWorkers.id],
  }),
  recommendations: many(caseRecommendations),
  aiFeedback: many(aiFeedback),
  medicalFeedback: many(medicalFeedback),
  assignedDoctor: one(users, {
    fields: [cases.assignedDoctorId],
    references: [users.id],
  }),
  assignedByUser: one(users, {
    fields: [cases.assignedBy],
    references: [users.id],
  }),
  referredToCenter: one(primaryHealthCenters, {
    fields: [cases.referredToCenterId],
    references: [primaryHealthCenters.id],
  }),
  reviewedByUser: one(users, {
    fields: [cases.reviewedBy],
    references: [users.id],
  }),
  closedByUser: one(users, {
    fields: [cases.closedBy],
    references: [users.id],
  }),
}));

export const caseRecommendationsRelations = relations(caseRecommendations, ({ one }) => ({
  case: one(cases, {
    fields: [caseRecommendations.caseId],
    references: [cases.id],
  }),
}));

export const aiFeedbackRelations = relations(aiFeedback, ({ one }) => ({
  case: one(cases, {
    fields: [aiFeedback.caseId],
    references: [cases.id],
  }),
  user: one(users, {
    fields: [aiFeedback.userId],
    references: [users.id],
  }),
}));

export const medicalFeedbackRelations = relations(medicalFeedback, ({ one }) => ({
  case: one(cases, {
    fields: [medicalFeedback.caseId],
    references: [cases.id],
  }),
  user: one(users, {
    fields: [medicalFeedback.userId],
    references: [users.id],
  }),
  actionCompletedByUser: one(users, {
    fields: [medicalFeedback.actionCompletedBy],
    references: [users.id],
  }),
}));

// Create validation schemas
export const userInsertSchema = createInsertSchema(users);
export const healthWorkerInsertSchema = createInsertSchema(healthWorkers);
export const doctorInsertSchema = createInsertSchema(doctors);
export const primaryHealthCenterInsertSchema = createInsertSchema(primaryHealthCenters);
export const otpInsertSchema = createInsertSchema(otps);
export const caseInsertSchema = createInsertSchema(cases);
export const caseRecommendationInsertSchema = createInsertSchema(caseRecommendations);
export const aiFeedbackInsertSchema = createInsertSchema(aiFeedback);
export const medicalFeedbackInsertSchema = createInsertSchema(medicalFeedback);

// Export types
export type User = typeof users.$inferSelect;
export type HealthWorker = typeof healthWorkers.$inferSelect;
export type Doctor = typeof doctors.$inferSelect;
export type PrimaryHealthCenter = typeof primaryHealthCenters.$inferSelect;
export type Otp = typeof otps.$inferSelect;
export type CaseData = typeof cases.$inferSelect;
export type CaseRecommendation = typeof caseRecommendations.$inferSelect;
export type AiFeedback = typeof aiFeedback.$inferSelect;
export type MedicalFeedback = typeof medicalFeedback.$inferSelect;

// Export insert types
export type InsertUser = typeof userInsertSchema._type;
export type InsertHealthWorker = typeof healthWorkerInsertSchema._type;
export type InsertDoctor = typeof doctorInsertSchema._type;
export type InsertPrimaryHealthCenter = typeof primaryHealthCenterInsertSchema._type;
export type InsertOtp = typeof otpInsertSchema._type;
export type InsertCase = typeof caseInsertSchema._type;
export type InsertCaseRecommendation = typeof caseRecommendationInsertSchema._type;
export type InsertAiFeedback = typeof aiFeedbackInsertSchema._type;
export type InsertMedicalFeedback = typeof medicalFeedbackInsertSchema._type;
