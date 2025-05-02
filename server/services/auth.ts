import { Router } from "express";
import { storage } from "../storage";
import { z } from "zod";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { db } from "@db";
import * as schema from "@shared/schema";
import { User } from "@shared/types";

const JWT_SECRET = process.env.JWT_SECRET || "rural-health-triage-secret";
const JWT_EXPIRES_IN = "7d";

export function authRoutes() {
  const router = Router();

  // Request OTP for phone number
  router.post("/request-otp", async (req, res) => {
    try {
      const schema = z.object({
        phone: z.string().regex(/^\d{10}$/, "Phone must be a 10-digit number"),
      });

      const { phone } = schema.parse(req.body);

      // Generate and store OTP
      // In a real app, this would send an SMS through a service like Twilio
      const otp = await storage.createOtp(phone);

      // For development, we'll log the OTP to console
      console.log(`OTP for ${phone}: ${otp}`);

      return res.status(200).json({
        success: true,
        message: "OTP sent successfully",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error requesting OTP:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Verify OTP and login
  router.post("/verify-otp", async (req, res) => {
    try {
      const otpSchema = z.object({
        phone: z.string().regex(/^\d{10}$/, "Phone must be a 10-digit number"),
        otp: z.string().regex(/^\d{4}$/, "OTP must be a 4-digit number"),
      });

      const { phone, otp } = otpSchema.parse(req.body);

      // Verify OTP
      const isValid = await storage.verifyOtp(phone, otp);

      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired OTP",
        });
      }

      // Get or create user
      let user = await storage.getUserByPhone(phone);

      if (!user) {
        // For development/demo purposes, we'll auto-create a new user as a health worker
        try {
          // Create a user with default password
          const hashedPassword = await hashPassword("password123");
          const [newUser] = await db.insert(schema.users)
            .values({
              name: `User ${phone.substring(0, 4)}...`,
              phone: phone,
              password: hashedPassword,
              role: "HEALTH_WORKER",
              language: "en"
            })
            .returning();
            
          // Create a health worker profile for this user
          const [healthWorker] = await db.insert(schema.healthWorkers)
            .values({
              userId: newUser.id,
              areaCode: "IN-123"
            })
            .returning();
            
          user = {
            ...newUser,
            healthWorker
          } as any;
          
          console.log(`Auto-created user for phone: ${phone}`);
        } catch (createError) {
          console.error("Error creating new user:", createError);
          return res.status(500).json({
            success: false,
            message: "Failed to create new user account"
          });
        }
      }

      // We should have a user at this point, either existing or newly created
      if (!user) {
        return res.status(500).json({
          success: false,
          message: "Failed to retrieve or create user account"
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Exclude password from response
      const { password, ...userWithoutPassword } = user as any;

      return res.status(200).json({
        success: true,
        token,
        user: userWithoutPassword,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error verifying OTP:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}

// Utility functions for password handling
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

export async function validatePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}
