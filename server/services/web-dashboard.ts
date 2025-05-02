import { Router, Request, Response } from "express";
import { db } from "@db";
import { cases, aiFeedback, medicalFeedback, caseRecommendations, doctors, primaryHealthCenters } from "@shared/schema";
import { Case, AiFeedback, User, MedicalFeedback, CaseStatus } from "@shared/types";
import { eq, and, desc } from "drizzle-orm";
import { storage } from "../storage";

// For request.user typing
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Routes for the web dashboard interface
 */
export function webDashboardRoutes() {
  const router = Router();

  // Rest of the code ...
  // Skipping to the doctor assignment endpoint

  /**
   * Assign a doctor to a case
   */
  router.post('/:id/assign', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { doctorId } = req.body;
      
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      if (!doctorId) {
        return res.status(400).json({ error: 'Doctor ID is required' });
      }
      
      const caseId = parseInt(id, 10);
      
      // Get the case to check if it exists
      const existingCase = await storage.getCaseById(caseId);
      if (!existingCase) {
        return res.status(404).json({ error: 'Case not found' });
      }
      
      // Update the case with doctor assignment
      const updatedCase = await db.update(cases)
        .set({
          assignedDoctorId: doctorId,
          updatedAt: new Date()
        })
        .where(eq(cases.id, caseId))
        .returning();
      
      // 1. Store the doctor assignment event in the database using the caseRecommendations table
      await db.insert(caseRecommendations).values({
        caseId: caseId,
        text: `Doctor (ID: ${doctorId}) has been assigned to this case`,
        createdAt: new Date()
      });
      
      // 2. Send notification to the health worker
      if (existingCase.healthWorkerId) {
        const healthWorkerId = String(existingCase.healthWorkerId);
        
        // Get doctor information to include in the notification
        const doctorInfo = await db.query.doctors.findFirst({
          where: eq(doctors.id, doctorId),
          with: {
            user: true
          }
        });
        
        const doctorName = doctorInfo?.user?.name || `Doctor #${doctorId}`;
        
        // Send direct WebSocket notification to the connected client
        const notificationSent = (global as any).notifyClient(healthWorkerId, {
          type: 'doctor_assigned',
          data: {
            caseId: caseId,
            doctorId: doctorId,
            doctorName: doctorName,
            message: `Dr. ${doctorName} has been assigned to your case`,
            timestamp: new Date()
          }
        });
        
        // Also broadcast to all clients (this helps when client reconnects)
        (global as any).notifyClients({
          type: 'doctor_assigned',
          data: {
            caseId: caseId,
            doctorId: doctorId,
            doctorName: doctorName,
            healthWorkerId: healthWorkerId, // Include this so clients can filter
            message: `Dr. ${doctorName} has been assigned to case #${caseId}`,
            timestamp: new Date()
          }
        });
        
        console.log(`WebSocket doctor assignment notification ${notificationSent ? 'sent' : 'not sent'} to health worker ${healthWorkerId}`);
      }
      
      res.status(200).json(updatedCase[0]);
    } catch (error) {
      console.error('Error assigning doctor:', error);
      res.status(500).json({ error: 'Failed to assign doctor to case' });
    }
  });

  /**
   * Refer a case to a healthcare center
   */
  router.post('/:id/refer', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { centerId } = req.body;
      
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      if (!centerId) {
        return res.status(400).json({ error: 'Center ID is required' });
      }
      
      const caseId = parseInt(id, 10);
      
      // Get the case to check if it exists
      const existingCase = await storage.getCaseById(caseId);
      if (!existingCase) {
        return res.status(404).json({ error: 'Case not found' });
      }
      
      // Get center information
      const centerInfo = await db.query.primaryHealthCenters.findFirst({
        where: eq(primaryHealthCenters.id, centerId)
      });
      
      const centerName = centerInfo?.name || `Center #${centerId}`;
      
      // Update the case with referral information
      const updatedCase = await db.update(cases)
        .set({
          referredToCenterId: centerId,
          updatedAt: new Date()
        })
        .where(eq(cases.id, caseId))
        .returning();
      
      // Store the referral event in the database using the caseRecommendations table
      await db.insert(caseRecommendations).values({
        caseId: caseId,
        text: `Case has been referred to ${centerName}`,
        createdAt: new Date()
      });
      
      // Send notification to the health worker
      if (existingCase.healthWorkerId) {
        const healthWorkerId = String(existingCase.healthWorkerId);
        const notificationSent = (global as any).notifyClient(healthWorkerId, {
          type: 'case_referred',
          data: {
            caseId: caseId,
            centerId: centerId,
            centerName: centerName,
            message: `Your case has been referred to ${centerName}`,
            timestamp: new Date()
          }
        });
        
        // Also broadcast to all clients
        (global as any).notifyClients({
          type: 'case_referred',
          data: {
            caseId: caseId,
            centerId: centerId,
            centerName: centerName,
            healthWorkerId: healthWorkerId, // Include this so clients can filter
            message: `Case #${caseId} has been referred to ${centerName}`,
            timestamp: new Date()
          }
        });
        
        console.log(`WebSocket referral notification ${notificationSent ? 'sent' : 'not sent'} to health worker ${healthWorkerId}`);
      }
      
      res.status(200).json(updatedCase[0]);
    } catch (error) {
      console.error('Error referring case:', error);
      res.status(500).json({ error: 'Failed to refer case to center' });
    }
  });

  /**
   * Trigger emergency action for a case
   */
  router.post('/:id/emergency', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const caseId = parseInt(id, 10);
      
      // Get the case to check if it exists
      const existingCase = await storage.getCaseById(caseId);
      if (!existingCase) {
        return res.status(404).json({ error: 'Case not found' });
      }
      
      // Update the case with emergency information
      const updatedCase = await db.update(cases)
        .set({
          status: 'CRITICAL' as CaseStatus,
          emergencyNotes: notes || null,
          updatedAt: new Date()
        })
        .where(eq(cases.id, caseId))
        .returning();
      
      // Store the emergency action event in the case history
      const emergencyMessage = notes 
        ? `EMERGENCY: Case marked as CRITICAL. Notes: ${notes}`
        : `EMERGENCY: Case marked as CRITICAL`;
        
      await db.insert(caseRecommendations).values({
        caseId: caseId,
        text: emergencyMessage,
        createdAt: new Date()
      });
      
      // Send emergency notification to the health worker
      if (existingCase.healthWorkerId) {
        const healthWorkerId = String(existingCase.healthWorkerId);
        const notificationSent = (global as any).notifyClient(healthWorkerId, {
          type: 'emergency_action',
          data: {
            caseId: caseId,
            message: 'EMERGENCY: Immediate action required for your case',
            notes: notes,
            timestamp: new Date()
          }
        });
        
        console.log(`WebSocket emergency notification ${notificationSent ? 'sent' : 'not sent'} to health worker ${healthWorkerId}`);
      }
      
      // Broadcast emergency to all clients
      (global as any).notifyClients({
        type: 'emergency_triggered',
        data: {
          caseId: caseId,
          updatedAt: new Date()
        }
      });
      
      res.status(200).json(updatedCase[0]);
    } catch (error) {
      console.error('Error triggering emergency:', error);
      res.status(500).json({ error: 'Failed to trigger emergency action' });
    }
  });

  /**
   * Schedule follow-up for a case
   */
  router.post('/:id/follow-up', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { followUpDate } = req.body;
      
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      if (!followUpDate) {
        return res.status(400).json({ error: 'Follow-up date is required' });
      }
      
      const caseId = parseInt(id, 10);
      
      // Get the case to check if it exists
      const existingCase = await storage.getCaseById(caseId);
      if (!existingCase) {
        return res.status(404).json({ error: 'Case not found' });
      }
      
      // Update the case with follow-up date
      const updatedCase = await db.update(cases)
        .set({
          followUpDate: new Date(followUpDate),
          status: existingCase.status === 'PENDING' ? 'NEEDS_ATTENTION' as CaseStatus : existingCase.status,
          updatedAt: new Date()
        })
        .where(eq(cases.id, caseId))
        .returning();
      
      // Format date to a readable string
      const date = new Date(followUpDate);
      const formattedDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      // Store the follow-up event in the case history
      await db.insert(caseRecommendations).values({
        caseId: caseId,
        text: `Follow-up scheduled for ${formattedDate}`,
        createdAt: new Date()
      });
      
      // Send notification to the health worker
      if (existingCase.healthWorkerId) {
        const healthWorkerId = String(existingCase.healthWorkerId);
        const notificationSent = (global as any).notifyClient(healthWorkerId, {
          type: 'follow_up_scheduled',
          data: {
            caseId: caseId,
            followUpDate: followUpDate,
            message: `Follow-up scheduled for ${formattedDate}`,
            timestamp: new Date()
          }
        });
        
        console.log(`WebSocket follow-up notification ${notificationSent ? 'sent' : 'not sent'} to health worker ${healthWorkerId}`);
      }
      
      res.status(200).json(updatedCase[0]);
    } catch (error) {
      console.error('Error scheduling follow-up:', error);
      res.status(500).json({ error: 'Failed to schedule follow-up' });
    }
  });

  return router;
}
