import { Router } from "express";
import { storage } from "../storage";
import { caseSchema } from "@shared/types";
import { analyzeCase } from "./ai";
import { z } from "zod";

export function caseRoutes() {
  const router = Router();

  // Get all cases
  router.get("/", async (req, res) => {
    try {
      const cases = await storage.getAllCases();
      return res.status(200).json(cases);
    } catch (error) {
      console.error("Error getting cases:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get case by ID
  router.get("/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid case ID" });
      }

      const caseData = await storage.getCaseById(id);
      if (!caseData) {
        return res.status(404).json({ error: "Case not found" });
      }

      return res.status(200).json(caseData);
    } catch (error) {
      console.error("Error getting case:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create new case with AI analysis
  router.post("/", async (req, res) => {
    try {
      const caseData = req.body;
      
      // Validate case data
      const validatedData = caseSchema.parse(caseData);
      
      // Analyze with AI and get classification
      const aiResult = await analyzeCase(validatedData);
      
      // Merge AI analysis with case data
      const now = new Date();
      const completeCase = {
        ...validatedData,
        ...aiResult,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        // Default to the authenticated user's ID in a real app
        healthWorkerId: 1, // Placeholder
      };
      
      // Save to database
      const newCase = await storage.createCase(completeCase);
      
      return res.status(201).json(newCase);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating case:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Save case as draft (without AI analysis)
  router.post("/draft", async (req, res) => {
    try {
      const draftData = req.body;
      
      // Create a draft case
      const now = new Date();
      const draft = {
        ...draftData,
        isDraft: true,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        severity: "UNKNOWN",
        assessmentTitle: "Draft Case",
        assessmentSummary: "This case has been saved as a draft.",
        // Default to the authenticated user's ID in a real app
        healthWorkerId: 1, // Placeholder
      };
      
      // Save to database
      const newDraft = await storage.createCase(draft);
      
      return res.status(201).json(newDraft);
    } catch (error) {
      console.error("Error saving draft:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update case
  router.patch("/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid case ID" });
      }

      // Verify that case exists before attempting update
      const existingCase = await storage.getCaseById(id);
      if (!existingCase) {
        return res.status(404).json({ error: "Case not found" });
      }

      // Extract data from request body
      const caseData = req.body;
      
      try {
        const updatedCase = await storage.updateCase(id, caseData);
        return res.status(200).json(updatedCase);
      } catch (updateError) {
        console.error("Error updating case:", updateError);
        return res.status(500).json({ error: "Failed to update case" });
      }
    } catch (error) {
      console.error("Error processing update request:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Send notification for emergency case
  router.post("/:id/notify", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid case ID" });
      }

      const caseData = await storage.getCaseById(id);
      if (!caseData) {
        return res.status(404).json({ error: "Case not found" });
      }

      if (caseData.severity !== "EMERGENCY") {
        return res.status(400).json({ error: "Only emergency cases can trigger notifications" });
      }

      // In a real app, this would send notifications to doctors or emergency services
      // via SMS, push notifications, etc.
      console.log(`EMERGENCY NOTIFICATION: Case #${id} requires immediate attention`);

      // Update case to mark notification as sent
      const notificationTime = new Date();
      const updatedCase = await storage.updateCase(id, {
        notificationSent: true,
        notificationTime: notificationTime.toISOString(),
      });

      return res.status(200).json({
        success: true,
        message: "Notification sent successfully",
        case: updatedCase,
      });
    } catch (error) {
      console.error("Error sending notification:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Submit feedback on AI assessment
  router.post("/:id/feedback", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid case ID" });
      }

      // In a real app, this would store feedback for improving the AI model
      console.log(`AI Assessment Feedback for Case #${id}`);

      return res.status(200).json({
        success: true,
        message: "Feedback recorded successfully",
      });
    } catch (error) {
      console.error("Error recording feedback:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
