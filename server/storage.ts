import { db } from "@db";
import * as schema from "@shared/schema";
import { eq, and, desc, like } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { validatePassword, hashPassword } from "./services/auth";
import { Case, CaseSeverity, User, HealthWorker, Doctor } from "@shared/types";

export const storage = {
  // User management
  async getUserByPhone(phone: string): Promise<User | null> {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.phone, phone),
    });
    
    if (!user) return null;
    
    // Get the related health worker or doctor
    if (user.role === "HEALTH_WORKER") {
      const healthWorker = await db.query.healthWorkers.findFirst({
        where: eq(schema.healthWorkers.userId, user.id),
      });
      
      if (healthWorker) {
        return { 
          ...user, 
          healthWorker 
        } as User;
      }
    } else if (user.role === "DOCTOR") {
      const doctor = await db.query.doctors.findFirst({
        where: eq(schema.doctors.userId, user.id),
      });
      
      if (doctor) {
        return { 
          ...user, 
          doctor 
        } as User;
      }
    }
    
    return user;
  },
  
  async verifyOtp(phone: string, otp: string): Promise<boolean> {
    const otpRecord = await db.query.otps.findFirst({
      where: and(
        eq(schema.otps.phone, phone),
        eq(schema.otps.code, otp),
        eq(schema.otps.isUsed, false)
      ),
    });
    
    if (!otpRecord || new Date() > otpRecord.expiresAt) {
      return false;
    }
    
    // Mark OTP as used
    await db.update(schema.otps)
      .set({ isUsed: true })
      .where(eq(schema.otps.id, otpRecord.id));
    
    return true;
  },
  
  async createOtp(phone: string): Promise<string> {
    // Generate a random 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Set expiration to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    
    await db.insert(schema.otps).values({
      phone,
      code: otp,
      expiresAt,
      isUsed: false,
    });
    
    return otp;
  },
  
  // Case management
  async getAllCases(): Promise<Case[]> {
    return db.query.cases.findMany({
      orderBy: [desc(schema.cases.createdAt)],
      with: {
        recommendations: true,
      },
    });
  },
  
  async getCaseById(id: number): Promise<Case | null> {
    return db.query.cases.findFirst({
      where: eq(schema.cases.id, id),
      with: {
        recommendations: true,
      },
    });
  },
  
  async getCasesByHealthWorkerId(healthWorkerId: number): Promise<Case[]> {
    return db.query.cases.findMany({
      where: eq(schema.cases.healthWorkerId, healthWorkerId),
      orderBy: [desc(schema.cases.createdAt)],
      with: {
        recommendations: true,
      },
    });
  },
  
  async createCase(caseData: any): Promise<Case> {
    // Extract recommendations to insert separately
    const { recommendations, ...caseValues } = caseData;
    
    // Insert the case
    const [newCase] = await db.insert(schema.cases)
      .values(caseValues)
      .returning();
    
    // Insert recommendations if provided
    if (recommendations && recommendations.length) {
      await db.insert(schema.caseRecommendations).values(
        recommendations.map((text: string) => ({
          caseId: newCase.id,
          text,
        }))
      );
    }
    
    // Return the complete case with recommendations
    return this.getCaseById(newCase.id) as Promise<Case>;
  },
  
  async updateCase(id: number, caseData: Partial<Case>): Promise<Case | null> {
    const { recommendations, ...caseValues } = caseData;
    
    // Update the case
    await db.update(schema.cases)
      .set(caseValues)
      .where(eq(schema.cases.id, id));
    
    // Update recommendations if provided
    if (recommendations) {
      // Delete existing recommendations
      await db.delete(schema.caseRecommendations)
        .where(eq(schema.caseRecommendations.caseId, id));
      
      // Insert new recommendations
      if (recommendations.length) {
        await db.insert(schema.caseRecommendations).values(
          recommendations.map((text: string) => ({
            caseId: id,
            text,
          }))
        );
      }
    }
    
    return this.getCaseById(id);
  },
  
  // Analytics and dashboard
  async getCasesByUrgency(urgency: CaseSeverity): Promise<Case[]> {
    return db.query.cases.findMany({
      where: eq(schema.cases.severity, urgency),
      orderBy: [desc(schema.cases.createdAt)],
      with: {
        recommendations: true,
      },
    });
  },
  
  async getRecentCases(limit: number = 10): Promise<Case[]> {
    return db.query.cases.findMany({
      orderBy: [desc(schema.cases.createdAt)],
      limit,
      with: {
        recommendations: true,
      },
    });
  },
  
  async searchCases(query: string): Promise<Case[]> {
    return db.query.cases.findMany({
      where: like(schema.cases.patientName, `%${query}%`),
      orderBy: [desc(schema.cases.createdAt)],
      with: {
        recommendations: true,
      },
    });
  }
};
