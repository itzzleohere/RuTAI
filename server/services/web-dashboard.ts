import { Router, Request, Response } from "express";
import { db } from "@db";
import { cases, aiFeedback } from "@shared/schema";
import { Case, AiFeedback, User } from "@shared/types";

// For request.user typing
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
import { eq, and, desc } from "drizzle-orm";
import { storage } from "../storage";

/**
 * Routes for the web dashboard interface
 */
export function webDashboardRoutes() {
  const router = Router();

  /**
   * Mark a case as reviewed by a medical professional
   */
  router.post('/:id/review', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { reviewed, correctedSeverity, feedbackNotes } = req.body;
      
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const userId = req.user.id;
      const caseId = parseInt(id, 10);
      
      // Update the case with review info
      const updatedCase = await db.update(cases)
        .set({
          reviewed: true,
          reviewedAt: new Date(),
          reviewedBy: userId,
          severity: correctedSeverity || undefined,
          updatedAt: new Date()
        })
        .where(eq(cases.id, caseId))
        .returning();
        
      if (!updatedCase || updatedCase.length === 0) {
        return res.status(404).json({ error: 'Case not found' });
      }
      
      // If the severity was changed, log it in AI feedback
      const existingCase = await storage.getCaseById(caseId);
      
      if (correctedSeverity && existingCase && existingCase.severity !== correctedSeverity) {
        await db.insert(aiFeedback).values({
          caseId,
          originalSeverity: existingCase.severity,
          correctedSeverity,
          feedbackNotes: feedbackNotes || null,
          userId
        });
        
        // Notify about severity change
        if (existingCase.healthWorkerId) {
          const healthWorkerId = String(existingCase.healthWorkerId);
          (global as any).notifyClient(healthWorkerId, {
            type: 'severity_change',
            data: {
              caseId: caseId,
              oldSeverity: existingCase.severity,
              newSeverity: correctedSeverity,
              message: 'A medical professional has updated the severity of your case',
              timestamp: new Date()
            }
          });
        }
      }
      
      // Broadcast case review update to all connected clients
      (global as any).notifyClients({
        type: 'case_reviewed',
        data: {
          caseId: caseId,
          reviewedBy: userId,
          reviewedAt: new Date()
        }
      });
      
      res.status(200).json(updatedCase[0]);
    } catch (error) {
      console.error('Error reviewing case:', error);
      res.status(500).json({ error: 'Failed to update case review status' });
    }
  });

  /**
   * Send feedback to a health worker about a case
   */
  router.post('/:id/feedback', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { feedbackNotes } = req.body;
      
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!feedbackNotes) {
        return res.status(400).json({ error: 'Feedback notes are required' });
      }
      
      const caseId = parseInt(id, 10);
      
      // Get the case to check if it exists
      const existingCase = await storage.getCaseById(caseId);
      if (!existingCase) {
        return res.status(404).json({ error: 'Case not found' });
      }
      
      // Store the feedback in the case recommendations
      const recommendation = await storage.addCaseRecommendation(caseId, feedbackNotes);
      
      // Mark the case as having received feedback
      const updatedCase = await db.update(cases)
        .set({
          updatedAt: new Date()
        })
        .where(eq(cases.id, caseId))
        .returning();
      
      // Send real-time notification via WebSocket
      if (existingCase.healthWorkerId) {
        const healthWorkerId = String(existingCase.healthWorkerId);
        const notificationSent = (global as any).notifyClient(healthWorkerId, {
          type: 'feedback_received',
          data: {
            caseId: caseId,
            message: 'A medical professional has sent feedback on your case',
            timestamp: new Date(),
            feedback: feedbackNotes
          }
        });
        
        console.log(`WebSocket feedback notification ${notificationSent ? 'sent' : 'not sent'} to health worker ${healthWorkerId}`);
      }
      
      // Broadcast to all clients that feedback was added
      (global as any).notifyClients({
        type: 'case_feedback_added',
        data: {
          caseId: caseId,
          updatedAt: new Date(),
          recommendationId: recommendation.id
        }
      });
      
      res.status(200).json({ 
        success: true, 
        message: 'Feedback sent successfully',
        recommendation
      });
    } catch (error) {
      console.error('Error sending feedback:', error);
      res.status(500).json({ error: 'Failed to send feedback' });
    }
  });

  /**
   * Update a case's severity (without full review)
   */
  router.post('/:id/severity', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { correctedSeverity, feedbackNotes } = req.body;
      
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      if (!correctedSeverity) {
        return res.status(400).json({ error: 'Corrected severity is required' });
      }
      
      const userId = req.user.id;
      const caseId = parseInt(id, 10);
      
      // Get the case to check if it exists and get original severity
      const existingCase = await storage.getCaseById(caseId);
      if (!existingCase) {
        return res.status(404).json({ error: 'Case not found' });
      }
      
      // Update the case severity
      const updatedCase = await db.update(cases)
        .set({
          severity: correctedSeverity,
          updatedAt: new Date()
        })
        .where(eq(cases.id, caseId))
        .returning();
      
      // Log the severity change in AI feedback and send notifications
      if (existingCase.severity !== correctedSeverity) {
        await db.insert(aiFeedback).values({
          caseId,
          originalSeverity: existingCase.severity,
          correctedSeverity,
          feedbackNotes: feedbackNotes || null,
          userId
        });
        
        // Send notification to the health worker
        if (existingCase.healthWorkerId) {
          const healthWorkerId = String(existingCase.healthWorkerId);
          const notificationSent = (global as any).notifyClient(healthWorkerId, {
            type: 'severity_change',
            data: {
              caseId: caseId,
              oldSeverity: existingCase.severity,
              newSeverity: correctedSeverity,
              message: 'A medical professional has updated the severity of your case',
              timestamp: new Date(),
              feedbackNotes: feedbackNotes || null
            }
          });
          
          console.log(`WebSocket severity notification ${notificationSent ? 'sent' : 'not sent'} to health worker ${healthWorkerId}`);
        }
        
        // Broadcast severity change to all clients
        (global as any).notifyClients({
          type: 'severity_updated',
          data: {
            caseId: caseId,
            newSeverity: correctedSeverity,
            updatedAt: new Date()
          }
        });
      }
      
      res.status(200).json(updatedCase[0]);
    } catch (error) {
      console.error('Error updating severity:', error);
      res.status(500).json({ error: 'Failed to update case severity' });
    }
  });

  /**
   * Send a notification to the health worker
   */
  router.post('/:id/notify', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const caseId = parseInt(id, 10);
      
      // Get the case to determine the health worker
      const existingCase = await storage.getCaseById(caseId);
      if (!existingCase) {
        return res.status(404).json({ error: 'Case not found' });
      }
      
      // Update the case notification status
      const updatedCase = await db.update(cases)
        .set({
          notificationSent: true,
          notificationTime: new Date(),
          updatedAt: new Date()
        })
        .where(eq(cases.id, caseId))
        .returning();
        
      if (!updatedCase || updatedCase.length === 0) {
        return res.status(404).json({ error: 'Case not found' });
      }
      
      // Send real-time notification via WebSocket
      if (existingCase.healthWorkerId) {
        const healthWorkerId = String(existingCase.healthWorkerId);
        const notificationSent = (global as any).notifyClient(healthWorkerId, {
          type: 'case_notification',
          data: {
            caseId: caseId,
            message: 'A medical professional has reviewed your case and sent a notification',
            timestamp: new Date(),
            severity: existingCase.severity
          }
        });
        
        console.log(`WebSocket notification ${notificationSent ? 'sent' : 'not sent'} to health worker ${healthWorkerId}`);
      }
      
      // Broadcast to all clients that a case was updated
      (global as any).notifyClients({
        type: 'case_updated',
        data: {
          caseId: caseId,
          updatedAt: new Date()
        }
      });
      
      res.status(200).json({ 
        success: true, 
        message: 'Notification sent successfully',
        case: updatedCase[0]
      });
    } catch (error) {
      console.error('Error sending notification:', error);
      res.status(500).json({ error: 'Failed to send notification' });
    }
  });

  return router;
}