// Security middleware for API protection

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { SecurityConfig } from '../config/security';
import { AuditService } from '../services/audit';
import { JWTPayload } from '../types/auth';

const prisma = new PrismaClient();
const audit = AuditService.getInstance();

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      // Remove potential XSS patterns
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    }
    if (typeof value === 'object' && value !== null) {
      const sanitized: any = Array.isArray(value) ? [] : {};
      for (const key in value) {
        sanitized[key] = sanitizeValue(value[key]);
      }
      return sanitized;
    }
    return value;
  };

  req.body = sanitizeValue(req.body);
  req.query = sanitizeValue(req.query);
  req.params = sanitizeValue(req.params);
  
  next();
};

// JWT authentication middleware
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      await audit.logSecurityEvent({
        type: 'failed_auth',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: false,
        details: { reason: 'no_token' }
      });
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, SecurityConfig.jwt.accessTokenSecret) as JWTPayload;
    
    // Verify session is still active
    const session = await prisma.session.findFirst({
      where: {
        accessToken: token,
        isActive: true,
        expiresAt: { gt: new Date() }
      },
      include: { user: true }
    });

    if (!session || !session.user.isActive) {
      await audit.logSecurityEvent({
        type: 'failed_auth',
        userId: decoded.sub,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: false,
        details: { reason: 'invalid_session' }
      });
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Update last activity
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActivity: new Date() }
    });

    req.user = {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      permissions: decoded.permissions
    };

    next();
  } catch (error) {
    await audit.logSecurityEvent({
      type: 'failed_auth',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: false,
      details: { error: error.message }
    });
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Role-based authorization middleware
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      audit.logSecurityEvent({
        type: 'unauthorized_access',
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: false,
        details: { requiredRoles: roles, userRole: req.user?.role }
      });
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Permission-based authorization middleware
export const requirePermission = (resource: string, action: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasPermission = req.user.permissions.some((perm: any) => 
      (perm.resource === resource || perm.resource === '*') &&
      (perm.actions.includes(action) || perm.actions.includes('*'))
    );

    if (!hasPermission) {
      audit.logSecurityEvent({
        type: 'unauthorized_access',
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: false,
        details: { resource, action, permissions: req.user.permissions }
      });
      return res.status(403).json({ error: 'Permission denied' });
    }

    next();
  };
};

// Rate limiting middleware
export const createRateLimit = (config: any) => {
  return rateLimit({
    ...config,
    handler: async (req: Request, res: Response) => {
      await audit.logSecurityEvent({
        type: 'rate_limit_exceeded',
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: false,
        details: { endpoint: req.path, method: req.method }
      });
      res.status(429).json({ error: 'Too many requests' });
    }
  });
};

// Validation middleware
export const validateRequest = (validations: any[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await audit.logSecurityEvent({
        type: 'validation_failed',
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: false,
        details: { errors: errors.array(), endpoint: req.path }
      });
      return res.status(400).json({ errors: errors.array() });
    }

    next();
  };
};

// Common validation rules
export const validationRules = {
  email: body('email').isEmail().normalizeEmail(),
  password: body('password')
    .isLength({ min: SecurityConfig.password.minLength })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  name: body('name').isLength({ min: 2, max: 100 }).trim().escape(),
  studyName: body('name').isLength({ min: 3, max: 200 }).trim().escape(),
  studyDescription: body('description').isLength({ max: 1000 }).trim().escape(),
  promptContent: body('content').isLength({ min: 10, max: 5000 }).trim(),
  classification: body('classification').isIn(['0.0', '0.5', '1.0', '0.0-hard', 'error']),
  riskLevel: body('riskLevel').isIn(['low', 'medium', 'high']),
  uuid: body('id').isUUID(),
  mfaToken: body('mfaToken').isLength({ min: 6, max: 6 }).isNumeric()
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', SecurityConfig.headers.referrerPolicy);
  res.setHeader('Permissions-Policy', 
    Object.entries(SecurityConfig.headers.permissionsPolicy)
      .map(([key, value]) => `${key}=(${Array.isArray(value) ? value.join(' ') : value})`)
      .join(', ')
  );

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 
      `max-age=${SecurityConfig.headers.hsts.maxAge}; includeSubDomains; preload`
    );
  }

  next();
};

// CSRF protection middleware
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const token = req.headers['x-csrf-token'] || req.body._csrf;
    const sessionToken = req.session?.csrfToken;

    if (!token || !sessionToken || token !== sessionToken) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
  }
  next();
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', async () => {
    const duration = Date.now() - startTime;
    
    // Log suspicious requests
    if (duration > 10000 || res.statusCode >= 400) {
      await audit.logSecurityEvent({
        type: 'api_request',
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: res.statusCode < 400,
        details: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          suspicious: duration > 10000 || res.statusCode === 429
        }
      });
    }
  });

  next();
};

// IP whitelist middleware (for admin endpoints)
export const requireWhitelistedIP = (whitelist: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip;
    
    if (!whitelist.includes(clientIP)) {
      audit.logSecurityEvent({
        type: 'ip_blocked',
        ipAddress: clientIP,
        userAgent: req.get('User-Agent'),
        success: false,
        details: { endpoint: req.path, whitelist }
      });
      return res.status(403).json({ error: 'Access denied from this IP' });
    }
    
    next();
  };
};
