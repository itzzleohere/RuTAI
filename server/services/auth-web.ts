import { Request, Response } from "express";
import { storage } from "../storage";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { User, UserRole } from "../../shared/types";

// Secret for JWT - should be moved to environment variables in production
const JWT_SECRET = "rutai-web-secret";

/**
 * Web dashboard authentication routes
 */
export function webAuthRoutes() {
  return {
    // Web login with username/password
    async webLogin(req: Request, res: Response) {
      try {
        const { phone, password, role } = req.body;
        
        if (!phone || !password) {
          return res.status(400).json({ message: "Phone and password are required" });
        }
        
        // Find user by phone number
        const user = await storage.getUserByPhone(phone);
        
        if (!user) {
          return res.status(401).json({ message: "Invalid credentials" });
        }
        
        // Additional role verification
        if (role && user.role !== role) {
          return res.status(403).json({ message: "Unauthorized access for this role" });
        }
        
        // Compare passwords (mock implementation - would use proper hashing in production)
        const passwordMatch = await bcrypt.compare(password, user.password || "");
        
        if (!passwordMatch) {
          return res.status(401).json({ message: "Invalid credentials" });
        }
        
        // Generate JWT token
        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
        
        // Return user data and token
        return res.status(200).json({
          user: {
            id: user.id,
            name: user.name,
            phone: user.phone,
            role: user.role,
            language: user.language
          },
          token
        });
      } catch (error) {
        console.error("Web login error:", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    },
    
    // Verify OTP for web dashboard
    async verifyWebOtp(req: Request, res: Response) {
      try {
        const { phone, otp, role } = req.body;
        
        if (!phone || !otp) {
          return res.status(400).json({ message: "Phone and OTP are required" });
        }
        
        // Verify OTP
        const isValid = await storage.verifyOtp(phone, otp);
        
        if (!isValid) {
          return res.status(401).json({ message: "Invalid OTP" });
        }
        
        // Get or create user
        let user = await storage.getUserByPhone(phone);
        
        // For web dashboard, we need to ensure the user has the proper role
        if (user && role && user.role !== role) {
          return res.status(403).json({ message: "Your account doesn't have the required role" });
        }
        
        // If user doesn't exist, create a new one with the specified role (this may require approval in a real system)
        if (!user) {
          // In a real system, we'd have a proper registration flow for web dashboard users
          // For demo purposes, we're auto-creating them based on role
          const newUser = {
            name: `User ${phone.slice(-4)}`,
            phone,
            role: role as UserRole,
            language: "en",
            password: await bcrypt.hash("password123", 10) // Default password - would be changed by user
          };
          
          user = await storage.createUser(newUser);
        }
        
        // Generate JWT token
        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
        
        // Return user data and token
        return res.status(200).json({
          user: {
            id: user.id,
            name: user.name,
            phone: user.phone,
            role: user.role,
            language: user.language
          },
          token
        });
      } catch (error) {
        console.error("Web OTP verification error:", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  };
}