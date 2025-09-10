// Advanced Security Monitoring with Anomaly Detection
import { AuditService } from './audit';
import { SecurityEventType } from '../types/auth';

interface UserBehaviorPattern {
  userId: string;
  avgRequestsPerHour: number;
  commonIpAddresses: string[];
  typicalUserAgents: string[];
  frequentEndpoints: string[];
  lastSeen: Date;
}

interface SecurityAlert {
  type: 'ANOMALY' | 'THREAT' | 'POLICY_VIOLATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId?: string;
  ipAddress?: string;
  description: string;
  details: any;
  timestamp: Date;
}

export class AdvancedMonitoringService {
  private static instance: AdvancedMonitoringService;
  private audit: AuditService;
  private userPatterns: Map<string, UserBehaviorPattern> = new Map();
  private suspiciousActivities: SecurityAlert[] = [];
  
  private constructor() {
    this.audit = AuditService.getInstance();
    this.startPatternAnalysis();
  }

  static getInstance(): AdvancedMonitoringService {
    if (!AdvancedMonitoringService.instance) {
      AdvancedMonitoringService.instance = new AdvancedMonitoringService();
    }
    return AdvancedMonitoringService.instance;
  }

  // Analyze user behavior patterns
  private async startPatternAnalysis(): Promise<void> {
    setInterval(async () => {
      await this.updateUserPatterns();
      await this.detectAnomalies();
    }, 60000); // Run every minute
  }

  // Update user behavior patterns
  private async updateUserPatterns(): Promise<void> {
    try {
      // Get recent activity (last 24 hours)
      const recentEvents = await this.audit.getRecentEvents(24);
      
      for (const event of recentEvents) {
        if (!event.userId) continue;
        
        const pattern = this.userPatterns.get(event.userId) || {
          userId: event.userId,
          avgRequestsPerHour: 0,
          commonIpAddresses: [],
          typicalUserAgents: [],
          frequentEndpoints: [],
          lastSeen: new Date()
        };

        // Update IP addresses
        if (event.ipAddress && !pattern.commonIpAddresses.includes(event.ipAddress)) {
          pattern.commonIpAddresses.push(event.ipAddress);
          // Keep only last 5 IPs
          if (pattern.commonIpAddresses.length > 5) {
            pattern.commonIpAddresses.shift();
          }
        }

        // Update user agents
        if (event.userAgent && !pattern.typicalUserAgents.includes(event.userAgent)) {
          pattern.typicalUserAgents.push(event.userAgent);
          // Keep only last 3 user agents
          if (pattern.typicalUserAgents.length > 3) {
            pattern.typicalUserAgents.shift();
          }
        }

        pattern.lastSeen = new Date();
        this.userPatterns.set(event.userId, pattern);
      }
    } catch (error) {
      console.error('Failed to update user patterns:', error);
    }
  }

  // Detect behavioral anomalies
  private async detectAnomalies(): Promise<void> {
    const recentEvents = await this.audit.getRecentEvents(1); // Last hour
    
    // Group events by user
    const userEvents = new Map<string, any[]>();
    for (const event of recentEvents) {
      if (!event.userId) continue;
      if (!userEvents.has(event.userId)) {
        userEvents.set(event.userId, []);
      }
      userEvents.get(event.userId)!.push(event);
    }

    // Analyze each user's behavior
    for (const [userId, events] of userEvents) {
      const pattern = this.userPatterns.get(userId);
      if (!pattern) continue;

      await this.checkRequestVolumeAnomaly(userId, events, pattern);
      await this.checkLocationAnomaly(userId, events, pattern);
      await this.checkTimeBasedAnomaly(userId, events, pattern);
      await this.checkFailurePatterns(userId, events);
    }
  }

  // Check for unusual request volume
  private async checkRequestVolumeAnomaly(
    userId: string, 
    events: any[], 
    pattern: UserBehaviorPattern
  ): Promise<void> {
    const hourlyRequests = events.length;
    const normalVolume = pattern.avgRequestsPerHour || 10;
    
    // Alert if requests are 5x normal volume
    if (hourlyRequests > normalVolume * 5 && hourlyRequests > 50) {
      await this.createSecurityAlert({
        type: 'ANOMALY',
        severity: 'HIGH',
        userId,
        description: 'Unusual request volume detected',
        details: {
          currentRequests: hourlyRequests,
          normalRequests: normalVolume,
          multiplier: hourlyRequests / normalVolume
        },
        timestamp: new Date()
      });
    }
  }

  // Check for unusual IP addresses
  private async checkLocationAnomaly(
    userId: string, 
    events: any[], 
    pattern: UserBehaviorPattern
  ): Promise<void> {
    const currentIPs = [...new Set(events.map(e => e.ipAddress))];
    const knownIPs = pattern.commonIpAddresses;
    
    const newIPs = currentIPs.filter(ip => ip && !knownIPs.includes(ip));
    
    if (newIPs.length > 0 && knownIPs.length > 0) {
      await this.createSecurityAlert({
        type: 'ANOMALY', 
        severity: 'MEDIUM',
        userId,
        description: 'Access from new IP addresses',
        details: {
          newIPs,
          knownIPs,
          totalNewIPs: newIPs.length
        },
        timestamp: new Date()
      });
    }
  }

  // Check for unusual timing patterns
  private async checkTimeBasedAnomaly(
    userId: string, 
    events: any[], 
    pattern: UserBehaviorPattern
  ): Promise<void> {
    const currentHour = new Date().getHours();
    
    // Check if user is active during unusual hours (2-6 AM)
    if ((currentHour >= 2 && currentHour <= 6) && events.length > 5) {
      await this.createSecurityAlert({
        type: 'ANOMALY',
        severity: 'LOW',
        userId,
        description: 'Activity during unusual hours',
        details: {
          hour: currentHour,
          eventCount: events.length
        },
        timestamp: new Date()
      });
    }
  }

  // Check for suspicious failure patterns
  private async checkFailurePatterns(userId: string, events: any[]): Promise<void> {
    const failedEvents = events.filter(e => !e.success);
    const totalEvents = events.length;
    
    if (failedEvents.length > 10 || (failedEvents.length / totalEvents) > 0.5) {
      await this.createSecurityAlert({
        type: 'THREAT',
        severity: 'HIGH',
        userId,
        description: 'High failure rate detected - possible attack',
        details: {
          failedEvents: failedEvents.length,
          totalEvents,
          failureRate: failedEvents.length / totalEvents,
          eventTypes: [...new Set(failedEvents.map(e => e.type))]
        },
        timestamp: new Date()
      });
    }
  }

  // Create security alert and notify administrators
  private async createSecurityAlert(alert: SecurityAlert): Promise<void> {
    this.suspiciousActivities.push(alert);
    
    // Log to audit system
    await this.audit.logSecurityEvent({
      type: 'suspicious_activity' as SecurityEventType,
      userId: alert.userId,
      ipAddress: alert.ipAddress || 'unknown',
      userAgent: 'advanced-monitoring-system',
      success: false,
      details: {
        alertType: alert.type,
        severity: alert.severity,
        description: alert.description,
        details: alert.details
      }
    });

    // For critical alerts, trigger immediate notifications
    if (alert.severity === 'CRITICAL') {
      await this.triggerImmediateNotification(alert);
    }

    console.warn('ADVANCED SECURITY ALERT:', {
      ...alert,
      alertId: this.generateAlertId()
    });
  }

  // Generate unique alert ID
  private generateAlertId(): string {
    return `ASA_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Trigger immediate notification for critical alerts
  private async triggerImmediateNotification(alert: SecurityAlert): Promise<void> {
    // TODO: Implement SIEM integration, email notifications, Slack alerts, etc.
    console.error('CRITICAL SECURITY ALERT - IMMEDIATE ATTENTION REQUIRED:', alert);
    
    // For now, log to console - in production, this would integrate with:
    // - SIEM systems (Splunk, ELK Stack)
    // - Notification services (PagerDuty, Slack)
    // - Email alerts for security team
  }

  // Get current security alerts
  public getRecentAlerts(hours: number = 24): SecurityAlert[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.suspiciousActivities.filter(alert => alert.timestamp > cutoff);
  }

  // Get user behavior pattern
  public getUserPattern(userId: string): UserBehaviorPattern | undefined {
    return this.userPatterns.get(userId);
  }
}