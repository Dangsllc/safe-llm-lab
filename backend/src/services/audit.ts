// Comprehensive audit logging service for security monitoring

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { SecurityConfig } from '../config/security';
import { SecurityEvent } from '../types/auth';

export class AuditService {
  private static instance: AuditService;
  private prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient();
  }

  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  // Log security events with tamper detection
  async logSecurityEvent(event: Partial<SecurityEvent>): Promise<void> {
    try {
      const sanitizedEvent = this.sanitizeEventData(event);
      const hash = this.generateEventHash(sanitizedEvent);

      await this.prisma.securityAuditLog.create({
        data: {
          userId: sanitizedEvent.userId,
          action: sanitizedEvent.type || 'unknown',
          resourceType: 'auth',
          ipAddress: sanitizedEvent.ipAddress || 'unknown',
          userAgent: sanitizedEvent.userAgent || 'unknown',
          success: sanitizedEvent.success || false,
          details: sanitizedEvent.details || {},
          severity: this.determineSeverity(sanitizedEvent),
          hash
        }
      });

      // Real-time alerting for high-risk events
      if (this.isHighRiskEvent(sanitizedEvent)) {
        await this.triggerSecurityAlert(sanitizedEvent);
      }

    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  // Log data access events
  async logDataAccess(
    userId: string,
    resourceType: string,
    resourceId: string,
    action: string,
    ipAddress: string,
    success: boolean = true
  ): Promise<void> {
    const hash = this.generateEventHash({
      userId,
      resourceType,
      resourceId,
      action,
      timestamp: new Date()
    });

    await this.prisma.securityAuditLog.create({
      data: {
        userId,
        action,
        resourceType,
        resourceId,
        ipAddress,
        userAgent: 'api',
        success,
        severity: 'LOW',
        hash
      }
    });
  }

  // Log permission changes
  async logPermissionChange(
    adminUserId: string,
    targetUserId: string,
    oldPermissions: string[],
    newPermissions: string[],
    ipAddress: string
  ): Promise<void> {
    const details = {
      targetUserId,
      oldPermissions,
      newPermissions,
      changes: this.getPermissionDiff(oldPermissions, newPermissions)
    };

    await this.logSecurityEvent({
      userId: adminUserId,
      type: 'permission_change',
      ipAddress,
      success: true,
      details,
      severity: 'HIGH'
    });
  }

  // Detect suspicious activity patterns
  async detectSuspiciousActivity(userId: string, timeWindow: number = 3600000): Promise<boolean> {
    const since = new Date(Date.now() - timeWindow);
    
    const recentEvents = await this.prisma.securityAuditLog.findMany({
      where: {
        userId,
        timestamp: { gte: since }
      },
      orderBy: { timestamp: 'desc' }
    });

    // Check for suspicious patterns
    const suspiciousPatterns = [
      this.detectRapidLoginAttempts(recentEvents),
      this.detectUnusualIPActivity(recentEvents),
      this.detectPermissionEscalation(recentEvents),
      this.detectMassDataAccess(recentEvents)
    ];

    return suspiciousPatterns.some(pattern => pattern);
  }

  // Generate audit reports
  async generateAuditReport(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<any> {
    const whereClause: any = {
      timestamp: {
        gte: startDate,
        lte: endDate
      }
    };

    if (userId) {
      whereClause.userId = userId;
    }

    const events = await this.prisma.securityAuditLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            email: true,
            name: true,
            role: true
          }
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    return {
      summary: {
        totalEvents: events.length,
        successfulEvents: events.filter(e => e.success).length,
        failedEvents: events.filter(e => !e.success).length,
        highSeverityEvents: events.filter(e => e.severity === 'HIGH').length,
        criticalEvents: events.filter(e => e.severity === 'CRITICAL').length
      },
      eventsByType: this.groupEventsByType(events),
      eventsByUser: this.groupEventsByUser(events),
      timelineData: this.generateTimeline(events),
      securityAlerts: events.filter(e => ['HIGH', 'CRITICAL'].includes(e.severity))
    };
  }

  // Verify audit log integrity
  async verifyLogIntegrity(logId: string): Promise<boolean> {
    const log = await this.prisma.securityAuditLog.findUnique({
      where: { id: logId }
    });

    if (!log) return false;

    const expectedHash = this.generateEventHash({
      userId: log.userId,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      timestamp: log.timestamp
    });

    return log.hash === expectedHash;
  }

  // Private helper methods
  private sanitizeEventData(event: Partial<SecurityEvent>): any {
    const sanitized = { ...event };
    
    // Remove sensitive fields from details
    if (sanitized.details) {
      SecurityConfig.audit.sensitiveFields.forEach(field => {
        if (sanitized.details[field]) {
          sanitized.details[field] = '[REDACTED]';
        }
      });
    }

    return sanitized;
  }

  private generateEventHash(event: any): string {
    const hashInput = JSON.stringify({
      userId: event.userId,
      action: event.action || event.type,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      timestamp: event.timestamp || new Date()
    });

    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  private determineSeverity(event: any): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (!event.success) {
      if (SecurityConfig.audit.highRiskActions.includes(event.type)) {
        return 'HIGH';
      }
      return 'MEDIUM';
    }

    if (SecurityConfig.audit.highRiskActions.includes(event.type)) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  private isHighRiskEvent(event: any): boolean {
    return SecurityConfig.audit.highRiskActions.includes(event.type) || 
           !event.success ||
           this.determineSeverity(event) === 'CRITICAL';
  }

  private async triggerSecurityAlert(event: any): Promise<void> {
    // Implementation would send alerts to security team
    console.warn('SECURITY ALERT:', {
      type: event.type,
      userId: event.userId,
      timestamp: new Date(),
      details: event.details
    });
  }

  private detectRapidLoginAttempts(events: any[]): boolean {
    const loginAttempts = events.filter(e => e.action === 'failed_login');
    return loginAttempts.length > 5; // More than 5 failed logins in time window
  }

  private detectUnusualIPActivity(events: any[]): boolean {
    const uniqueIPs = new Set(events.map(e => e.ipAddress));
    return uniqueIPs.size > 3; // Activity from more than 3 IPs
  }

  private detectPermissionEscalation(events: any[]): boolean {
    return events.some(e => e.action === 'permission_change' && e.details?.escalation);
  }

  private detectMassDataAccess(events: any[]): boolean {
    const dataAccessEvents = events.filter(e => 
      ['read', 'download', 'export'].includes(e.action)
    );
    return dataAccessEvents.length > 50; // More than 50 data access events
  }

  private getPermissionDiff(oldPerms: string[], newPerms: string[]): any {
    return {
      added: newPerms.filter(p => !oldPerms.includes(p)),
      removed: oldPerms.filter(p => !newPerms.includes(p))
    };
  }

  private groupEventsByType(events: any[]): Record<string, number> {
    return events.reduce((acc, event) => {
      acc[event.action] = (acc[event.action] || 0) + 1;
      return acc;
    }, {});
  }

  private groupEventsByUser(events: any[]): Record<string, number> {
    return events.reduce((acc, event) => {
      const userKey = event.user?.email || 'Unknown';
      acc[userKey] = (acc[userKey] || 0) + 1;
      return acc;
    }, {});
  }

  private generateTimeline(events: any[]): any[] {
    // Group events by hour for timeline visualization
    const timeline = events.reduce((acc, event) => {
      const hour = new Date(event.timestamp).toISOString().slice(0, 13);
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(timeline).map(([hour, count]) => ({
      timestamp: hour,
      eventCount: count
    }));
  }
}
