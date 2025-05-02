import { Router } from 'express';
import { storage } from '../storage';
import { Case, CaseSeverity, CaseStatus } from '@shared/types';
import { authenticateJwt } from './auth-web';

/**
 * Routes for analytics and reporting
 */
export function analyticsRoutes() {
  const router = Router();

  /**
   * Get summary statistics for the dashboard
   */
  router.get('/summary', authenticateJwt, async (req, res) => {
    try {
      const cases = await storage.getAllCases();
      
      const summary = {
        total: cases.length,
        bySeverity: {
          emergency: cases.filter(c => c.severity === 'EMERGENCY').length,
          moderate: cases.filter(c => c.severity === 'MODERATE').length,
          low: cases.filter(c => c.severity === 'LOW').length,
          unknown: cases.filter(c => c.severity === 'UNKNOWN' || c.severity === null).length
        },
        byStatus: {
          pending: cases.filter(c => c.status === 'PENDING').length,
          stable: cases.filter(c => c.status === 'STABLE').length,
          needsAttention: cases.filter(c => c.status === 'NEEDS_ATTENTION').length,
          critical: cases.filter(c => c.status === 'CRITICAL').length,
          closed: cases.filter(c => c.status === 'CLOSED').length
        },
        reviewedCount: cases.filter(c => c.reviewed === true).length,
        assignedCount: cases.filter(c => c.assignedDoctorId !== null).length,
        // Average response time would be calculated from actual data in a real implementation
        avgResponseTime: 35 // Placeholder in minutes
      };
      
      res.json(summary);
    } catch (error) {
      console.error('Error fetching analytics summary:', error);
      res.status(500).json({ message: 'Failed to fetch analytics summary' });
    }
  });

  /**
   * Get time series data for cases over time
   */
  router.get('/trends', authenticateJwt, async (req, res) => {
    try {
      const { timeRange = 'week' } = req.query;
      const cases = await storage.getAllCases();
      
      // Determine date range based on requested time range
      const today = new Date();
      const daysInPast = timeRange === 'week' ? 7 : 30;
      
      // Create an array of dates for the time period
      const dateRangeData: { date: Date; formattedDate: string }[] = [];
      for (let i = daysInPast - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const formattedDate = date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
        
        dateRangeData.push({ date, formattedDate });
      }
      
      // Generate time series data
      const trends = dateRangeData.map(({ date, formattedDate }) => {
        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);
        
        const dayCases = cases.filter(c => {
          const caseDate = new Date(c.createdAt);
          return caseDate >= date && caseDate < nextDay;
        });
        
        return {
          name: formattedDate,
          total: dayCases.length,
          emergency: dayCases.filter(c => c.severity === 'EMERGENCY').length,
          moderate: dayCases.filter(c => c.severity === 'MODERATE').length,
          low: dayCases.filter(c => c.severity === 'LOW').length,
        };
      });
      
      res.json(trends);
    } catch (error) {
      console.error('Error fetching case trends:', error);
      res.status(500).json({ message: 'Failed to fetch case trends' });
    }
  });

  /**
   * Get geographic distribution of cases
   * Note: In a real implementation, this would use actual geographic data
   */
  router.get('/geographic', authenticateJwt, async (req, res) => {
    try {
      const cases = await storage.getAllCases();
      
      // In a real implementation, we would retrieve actual geographic data
      // For demonstration, we'll create representative data based on health worker IDs
      const healthWorkerCases = new Map<number, number>();
      
      cases.forEach(c => {
        if (c.healthWorkerId) {
          healthWorkerCases.set(
            c.healthWorkerId, 
            (healthWorkerCases.get(c.healthWorkerId) || 0) + 1
          );
        }
      });
      
      // Convert to area data for demonstration
      // In a real implementation, we'd have actual geographic regions associated with health workers
      const areaData = [
        { name: 'North Region', value: 0 },
        { name: 'South Region', value: 0 },
        { name: 'East Region', value: 0 },
        { name: 'West Region', value: 0 },
        { name: 'Central', value: 0 }
      ];
      
      // Distribute cases among regions based on health worker ID
      healthWorkerCases.forEach((count, healthWorkerId) => {
        const regionIndex = healthWorkerId % areaData.length;
        areaData[regionIndex].value += count;
      });
      
      res.json(areaData);
    } catch (error) {
      console.error('Error fetching geographic distribution:', error);
      res.status(500).json({ message: 'Failed to fetch geographic distribution' });
    }
  });

  /**
   * Get health worker performance metrics
   */
  router.get('/health-workers', authenticateJwt, async (req, res) => {
    try {
      const healthWorkers = await storage.getHealthWorkersWithUsers();
      const cases = await storage.getAllCases();
      
      const performanceData = healthWorkers.map(worker => {
        const workerCases = cases.filter(c => c.healthWorkerId === worker.id);
        
        return {
          id: worker.id,
          name: worker.name,
          totalCases: workerCases.length,
          emergencyCases: workerCases.filter(c => c.severity === 'EMERGENCY').length,
          moderateCases: workerCases.filter(c => c.severity === 'MODERATE').length,
          lowCases: workerCases.filter(c => c.severity === 'LOW').length,
          averageCasesPerDay: workerCases.length / 30 // Simplistic calculation
        };
      });
      
      res.json(performanceData);
    } catch (error) {
      console.error('Error fetching health worker performance:', error);
      res.status(500).json({ message: 'Failed to fetch health worker performance data' });
    }
  });

  return router;
}