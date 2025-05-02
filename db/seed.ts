import { db } from "./index";
import * as schema from "@shared/schema";
import { hashPassword } from "../server/services/auth";

async function seed() {
  try {
    console.log("Starting database seeding...");

    // Check if we have any users already
    const existingUsers = await db.query.users.findMany({
      limit: 1
    });

    if (existingUsers.length > 0) {
      console.log("Database already has users, skipping seed data creation");
      return;
    }

    // Seed Primary Health Centers
    console.log("Creating Primary Health Centers...");
    const [phc1, phc2] = await db.insert(schema.primaryHealthCenters)
      .values([
        {
          name: "Rajpur Primary Health Center",
          location: "Rajpur Village, Tamil Nadu",
          contactNumber: "9143256780"
        },
        {
          name: "Chandpur Rural Clinic",
          location: "Chandpur, Uttar Pradesh",
          contactNumber: "9876543210"
        }
      ])
      .returning();

    // Create users with hashed passwords
    console.log("Creating users...");
    const defaultPassword = await hashPassword("password123");

    const [healthWorkerUser, doctorUser, adminUser] = await db.insert(schema.users)
      .values([
        {
          name: "Priya Singh",
          phone: "9512368740",
          password: defaultPassword,
          role: "HEALTH_WORKER",
          language: "hi"
        },
        {
          name: "Dr. Amit Sharma",
          phone: "9876543210",
          password: defaultPassword,
          role: "DOCTOR",
          language: "en"
        },
        {
          name: "Admin User",
          phone: "9999999999",
          password: defaultPassword,
          role: "ADMIN",
          language: "en"
        }
      ])
      .returning();

    // Create health worker profile
    console.log("Creating health worker profile...");
    const [healthWorker] = await db.insert(schema.healthWorkers)
      .values({
        userId: healthWorkerUser.id,
        areaCode: "TN-123",
        primaryHealthCenterId: phc1.id
      })
      .returning();

    // Create doctor profile
    console.log("Creating doctor profile...");
    const [doctor] = await db.insert(schema.doctors)
      .values({
        userId: doctorUser.id,
        specialization: "General Medicine",
        primaryHealthCenterId: phc1.id
      })
      .returning();

    // Create sample cases
    console.log("Creating sample cases...");
    
    // Emergency case
    const [emergencyCase] = await db.insert(schema.cases)
      .values({
        patientName: "Ravi Kumar",
        age: "45",
        gender: "M",
        contactNumber: "8765432190",
        temperature: "98.9",
        pulse: "110",
        bpSystolic: "160",
        bpDiastolic: "95",
        respiratoryRate: "22",
        oxygenSaturation: "93",
        chiefComplaint: "Chest pain",
        symptoms: JSON.stringify({
          fever: false,
          cough: false,
          headache: false,
          pain: true,
          shortnessOfBreath: true,
          vomiting: false
        }),
        symptomDescription: "Severe chest pain radiating to left arm, started 1 hour ago, with shortness of breath and sweating",
        severity: "EMERGENCY",
        assessmentTitle: "Possible Cardiac Event",
        assessmentSummary: "Patient requires immediate evaluation and treatment",
        aiReasoning: "Patient presents with chest pain, shortness of breath, and sweating along with elevated blood pressure (160/95) and rapid pulse (110 bpm). These symptoms and vital signs are consistent with a possible cardiac event that requires immediate evaluation and treatment.",
        healthWorkerId: healthWorker.id,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      })
      .returning();

    // Add recommendations for emergency case
    await db.insert(schema.caseRecommendations)
      .values([
        {
          caseId: emergencyCase.id,
          text: "Arrange immediate transport to nearest cardiology facility"
        },
        {
          caseId: emergencyCase.id,
          text: "Administer 325mg aspirin (if available and no known allergies)"
        },
        {
          caseId: emergencyCase.id,
          text: "Monitor vital signs continuously during transport"
        },
        {
          caseId: emergencyCase.id,
          text: "Alert receiving facility about incoming cardiac emergency"
        }
      ]);

    // Moderate case
    const [moderateCase] = await db.insert(schema.cases)
      .values({
        patientName: "Priya Desai",
        age: "28",
        gender: "F",
        contactNumber: "7812345690",
        temperature: "101",
        pulse: "88",
        bpSystolic: "125",
        bpDiastolic: "80",
        respiratoryRate: "18",
        oxygenSaturation: "96",
        chiefComplaint: "Fever and joint pain",
        symptoms: JSON.stringify({
          fever: true,
          cough: false,
          headache: true,
          pain: true,
          shortnessOfBreath: false,
          vomiting: false
        }),
        symptomDescription: "High fever for 3 days with severe joint pain and headache",
        severity: "MODERATE",
        assessmentTitle: "Possible Viral Infection",
        assessmentSummary: "Monitor for dengue fever symptoms",
        aiReasoning: "Patient has high fever (101°F) with joint pain and headache, which are common in viral infections including dengue fever. The vital signs are mostly stable but the persistent high fever requires monitoring. While hospitalization is not immediately necessary, close observation is recommended.",
        healthWorkerId: healthWorker.id,
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000) // 5 hours ago
      })
      .returning();

    // Add recommendations for moderate case
    await db.insert(schema.caseRecommendations)
      .values([
        {
          caseId: moderateCase.id,
          text: "Monitor temperature every 4-6 hours"
        },
        {
          caseId: moderateCase.id,
          text: "Ensure adequate hydration"
        },
        {
          caseId: moderateCase.id,
          text: "Check for rash or bleeding symptoms"
        },
        {
          caseId: moderateCase.id,
          text: "Return for evaluation if symptoms worsen"
        }
      ]);

    // Low severity case
    const [lowCase] = await db.insert(schema.cases)
      .values({
        patientName: "Anand Singh",
        age: "60",
        gender: "M",
        contactNumber: "9423156780",
        temperature: "98.6",
        pulse: "72",
        bpSystolic: "130",
        bpDiastolic: "85",
        respiratoryRate: "16",
        oxygenSaturation: "98",
        chiefComplaint: "Mild cough",
        symptoms: JSON.stringify({
          fever: false,
          cough: true,
          headache: false,
          pain: false,
          shortnessOfBreath: false,
          vomiting: false
        }),
        symptomDescription: "Mild cough and runny nose for 2 days",
        severity: "LOW",
        assessmentTitle: "Common Cold",
        assessmentSummary: "Rest and fluids recommended",
        aiReasoning: "Patient has symptoms consistent with a common cold including mild cough and runny nose. Vital signs are normal and there are no concerning findings. This can be managed with supportive care at home.",
        healthWorkerId: healthWorker.id,
        createdAt: new Date(Date.now() - 28 * 60 * 60 * 1000) // 28 hours ago
      })
      .returning();

    // Add recommendations for low severity case
    await db.insert(schema.caseRecommendations)
      .values([
        {
          caseId: lowCase.id,
          text: "Rest and adequate hydration"
        },
        {
          caseId: lowCase.id,
          text: "Over-the-counter cough medication if needed"
        },
        {
          caseId: lowCase.id,
          text: "Return if symptoms worsen or fever develops"
        }
      ]);

    console.log("Seed data created successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seed();
