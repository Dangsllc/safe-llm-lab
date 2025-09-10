// Security middleware for API protection

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { body, validationResult, ValidationError } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { SecurityConfig } from '../config/security';
import { AuditService } from '../services/audit';
import { JWTPayload, UserRole } from '../types/auth';
import { withUserContext } from '../lib/database';
import crypto from 'crypto';
import session from 'express-session';

declare module 'express-session' {
  interface SessionData {
    csrfToken?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
      };
      userScopedPrisma?: any; // Will be set by middleware
    }
  }
}

const prisma = new PrismaClient();
const audit = AuditService.getInstance();

// Input sanitization middleware with comprehensive XSS protection
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      // Comprehensive XSS protection
      return value
        // Remove script tags
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        // Remove javascript: URLs
        .replace(/javascript:/gi, '')
        // Remove data: URLs (can contain base64 encoded scripts)
        .replace(/data:(?:text\/html|application\/javascript)/gi, '')
        // Remove event handlers
        .replace(/on\w+\s*=/gi, '')
        // Remove style attributes (can contain expression() in IE)
        .replace(/style\s*=\s*['"'][^'"]*['"]/gi, '')
        // Remove common XSS vectors
        .replace(/expression\s*\(/gi, '')
        .replace(/vbscript:/gi, '')
        .replace(/livescript:/gi, '')
        .replace(/mocha:/gi, '')
        .replace(/@import/gi, '')
        // Remove HTML comment exploits
        .replace(/<!--[\s\S]*?-->/g, '')
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
export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      await audit.logSecurityEvent({
        type: 'failed_auth',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        success: false,
        details: { reason: 'no_token' }
      });
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, SecurityConfig.jwt.accessTokenSecret) as JWTPayload;
    
    // Hash the token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const session = await prisma.session.findFirst({
      where: {
        accessToken: tokenHash, // Compare with hashed token
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
        userAgent: req.get('User-Agent') || 'unknown',
        success: false,
        details: { reason: 'invalid_session' }
      });
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { lastActivity: new Date() }
    });

    req.user = {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role as UserRole,
    };

    // Set database user context for RLS
    req.userScopedPrisma = withUserContext(session.user.id, session.user.role, (tx) => Promise.resolve(tx));

    next();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await audit.logSecurityEvent({
      type: 'failed_auth',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || 'unknown',
      success: false,
      details: { error: errorMessage }
    });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Role-based authorization middleware
export const requireRole = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Resource and action-based permission middleware
export const requirePermission = (resource: string, _action: string) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Simple permission check - in production, this would check against user permissions
    if (req.user.role === 'ADMIN') {
      return next();
    }

    if (req.user.role === 'RESEARCHER' && resource === 'sessions') {
      return next();
    }

    return res.status(403).json({ error: 'Insufficient permissions' });
  };
};

// CSRF protection middleware
export const csrfProtection = (req: Request, res: Response, next: NextFunction): void | Response => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const csrfToken = (req.headers['x-csrf-token'] || req.body?._csrf) as string | undefined;
  
  if (!csrfToken || csrfToken !== req.session?.['csrfToken']) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
};

// Generate and set CSRF token
export const generateCsrfToken = async (req: Request, _res: Response, next: NextFunction): Promise<void | Response> => {
  if (!req.session) {
    return next(new Error('Session not initialized'));
  }
  
  try {
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      crypto.randomBytes(32, (err, buf) => {
        if (err) reject(err);
        else resolve(buf);
      });
    });
    
    const token = buffer.toString('hex');
    if (req.session) {
      req.session['csrfToken'] = token;
    }
    next();
  } catch (error) {
    return next(error);
  }
};

// Security headers middleware
export const securityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' wss:; object-src 'none'; base-uri 'self'; form-action 'self';",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Cross-Origin-Resource-Policy': 'same-site'
  });

  next();
};

// Rate limiting middleware
export const createRateLimit = (config: {
  windowMs: number;
  max: number;
  message?: string;
  skip?: (req: Request) => boolean;
}) => {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: config.message || 'Too many requests, please try again later.',
    skip: config.skip,
    handler: async (req, res) => {
      await audit.logSecurityEvent({
        type: 'rate_limit_exceeded',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: false,
        details: {
          path: req.path,
          method: req.method,
          userId: req.user?.id
        }
      });
      
      return res.status(429).json({ error: 'Too many requests, please try again later.' });
    }
  });
};

// Common validation rules
export const validationRules = {
  email: body('email').isEmail().normalizeEmail(),
  password: body('password')
    .isLength({ min: 12 })
    .withMessage('Password must be at least 12 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Password must contain at least one special character'),
  name: body('name').trim().isLength({ min: 2, max: 100 }),
  role: body('role').isIn(Object.values(UserRole)),
  mfaToken: body('mfaToken').isLength({ min: 6, max: 6 }).withMessage('MFA token must be 6 digits'),
};

// Validation middleware
export const validateRequest = (validations: any[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
    try {
      await Promise.all(validations.map(validation => validation.run(req)));

      const errors = validationResult(req);
      if (errors.isEmpty()) {
        return next();
      }

      const errorMessages = errors.array().map((err: ValidationError & { param?: string }) => ({
        field: err.param || 'unknown',
        message: err.msg || 'Validation error',
      }));

      return res.status(400).json({ errors: errorMessages });
    } catch (error) {
      return next(error);
    }
  };
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const { method, originalUrl, ip, user } = req;
  const userAgent = req.get('User-Agent') || '';

  res.on('finish', async () => {
    const { statusCode } = res;
    const responseTime = Date.now() - start;

    if (process.env['NODE_ENV'] === 'production' && 
        (originalUrl === '/health' || originalUrl.startsWith('/static/'))) {
      return;
    }

    await audit.logSecurityEvent({
      type: 'api_request',
      userId: user?.id,
      ipAddress: ip,
      userAgent,
      success: statusCode < 400,
      details: {
        method,
        path: originalUrl,
        status: statusCode,
        responseTime: `${responseTime}ms`,
      },
    }).catch(console.error);
  });

  next();
};

// IP whitelist middleware (for admin endpoints)
export const requireWhitelistedIP = (whitelist: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const clientIP = req.ip || 
                   (req.socket && req.socket.remoteAddress) || 
                   (req.connection && req.connection.remoteAddress);
    
    if (!clientIP || (typeof clientIP === 'string' && !whitelist.includes(clientIP))) {
      audit.logSecurityEvent({
        type: 'unauthorized_access',
        ipAddress: clientIP || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        success: false,
        details: {
          path: req.path,
          method: req.method,
          reason: 'ip_not_whitelisted'
        }
      });
      
      return res.status(403).json({ 
        error: 'Access denied',
        details: 'Your IP address is not authorized to access this resource.'
      });
    }
    
    next();
  };
};
