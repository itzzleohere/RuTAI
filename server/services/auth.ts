import { Router } from "express";
import { storage } from "../storage";
import { z } from "zod";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

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
      const schema = z.object({
        phone: z.string().regex(/^\d{10}$/, "Phone must be a 10-digit number"),
        otp: z.string().regex(/^\d{4}$/, "OTP must be a 4-digit number"),
      });

      const { phone, otp } = schema.parse(req.body);

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
        // In a real app, we might want to register the user here
        // or redirect to a registration page
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Exclude password from response
      const { password, ...userWithoutPassword } = user;

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
