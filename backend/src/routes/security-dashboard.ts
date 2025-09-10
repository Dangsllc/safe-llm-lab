// Security monitoring dashboard API endpoints
import express from 'express';
import { authenticateToken, requireRole } from '../middleware/security';
import { AuditService } from '../services/audit';
import { AdvancedMonitoringService } from '../services/advanced-monitoring';
import { UserRole } from '../types/auth';

const router = express.Router();
const audit = AuditService.getInstance();
const monitoring = AdvancedMonitoringService.getInstance();

// Apply admin-only access to all security dashboard endpoints
router.use(authenticateToken);
router.use(requireRole([UserRole.ADMIN]));

// Get security metrics summary
router.get('/metrics', async (req, res) => {
  try {
    const last24Hours = 24;
    const recentEvents = await audit.getRecentEvents(last24Hours);
    const recentAlerts = monitoring.getRecentAlerts(last24Hours);
    
    // Calculate metrics
    const metrics = {
      totalEvents: recentEvents.length,
      failedLogins: recentEvents.filter(e => e.type === 'failed_login').length,
      successfulLogins: recentEvents.filter(e => e.type === 'login').length,
      securityAlerts: recentAlerts.length,
      criticalAlerts: recentAlerts.filter(a => a.severity === 'CRITICAL').length,
      highAlerts: recentAlerts.filter(a => a.severity === 'HIGH').length,
      suspiciousActivities: recentEvents.filter(e => e.type === 'suspicious_activity').length,
      uniqueIPs: [...new Set(recentEvents.map(e => e.ipAddress))].length,
      activeUsers: [...new Set(recentEvents.filter(e => e.userId).map(e => e.userId))].length,
      rateLimitViolations: recentEvents.filter(e => e.type === 'rate_limit_exceeded').length
    };

    res.json({
      success: true,
      data: {
        timeRange: `Last ${last24Hours} hours`,
        metrics,
        timestamp: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch security metrics' });
  }
});

// Get recent security events
router.get('/events', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const limit = parseInt(req.query.limit as string) || 100;
    const severity = req.query.severity as string;
    
    const events = await audit.getRecentEvents(hours);
    
    let filteredEvents = events;
    if (severity) {
      filteredEvents = events.filter(e => e.details?.severity === severity);
    }
    
    // Sort by timestamp (newest first) and limit
    const recentEvents = filteredEvents
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    res.json({
      success: true,
      data: {
        events: recentEvents,
        total: filteredEvents.length,
        timeRange: `Last ${hours} hours`
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch security events' });
  }
});

// Get security alerts from advanced monitoring
router.get('/alerts', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const severity = req.query.severity as string;
    
    let alerts = monitoring.getRecentAlerts(hours);
    
    if (severity) {
      alerts = alerts.filter(a => a.severity === severity);
    }
    
    // Sort by timestamp (newest first)
    alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      success: true,
      data: {
        alerts,
        total: alerts.length,
        timeRange: `Last ${hours} hours`
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch security alerts' });
  }
});

// Get failed login attempts analysis
router.get('/failed-logins', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const events = await audit.getRecentEvents(hours);
    
    const failedLogins = events.filter(e => e.type === 'failed_login');
    
    // Group by IP address
    const byIP = failedLogins.reduce((acc: any, event) => {
      const ip = event.ipAddress;
      if (!acc[ip]) acc[ip] = [];
      acc[ip].push(event);
      return acc;
    }, {});
    
    // Group by user
    const byUser = failedLogins.reduce((acc: any, event) => {
      const userId = event.userId || 'anonymous';
      if (!acc[userId]) acc[userId] = [];
      acc[userId].push(event);
      return acc;
    }, {});
    
    // Find top offenders
    const topIPs = Object.entries(byIP)
      .map(([ip, attempts]: [string, any]) => ({ ip, attempts: attempts.length }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 10);
    
    res.json({
      success: true,
      data: {
        totalFailedLogins: failedLogins.length,
        uniqueIPs: Object.keys(byIP).length,
        uniqueUsers: Object.keys(byUser).length,
        topOffendingIPs: topIPs,
        timeRange: `Last ${hours} hours`
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to analyze failed logins' });
  }
});

// Get user behavior patterns
router.get('/user-patterns/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const pattern = monitoring.getUserPattern(userId);
    
    if (!pattern) {
      return res.status(404).json({ error: 'User pattern not found' });
    }
    
    res.json({
      success: true,
      data: pattern
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user pattern' });
  }
});

// Security health check
router.get('/health', async (req, res) => {
  try {
    const last1Hour = await audit.getRecentEvents(1);
    const last24Hours = await audit.getRecentEvents(24);
    const criticalAlerts = monitoring.getRecentAlerts(1).filter(a => a.severity === 'CRITICAL');
    
    const health = {
      status: criticalAlerts.length > 0 ? 'CRITICAL' : 
              last1Hour.filter(e => !e.success).length > 50 ? 'WARNING' : 'HEALTHY',
      eventsLastHour: last1Hour.length,
      eventsLast24Hours: last24Hours.length,
      criticalAlertsLastHour: criticalAlerts.length,
      failureRate: last1Hour.length > 0 ? 
        (last1Hour.filter(e => !e.success).length / last1Hour.length) * 100 : 0,
      timestamp: new Date()
    };
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check security health' });
  }
});

export default router;