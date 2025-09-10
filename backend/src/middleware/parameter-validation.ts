// Advanced parameter validation middleware for injection prevention
import { Request, Response, NextFunction } from 'express';
import { param, validationResult } from 'express-validator';
import { AuditService } from '../services/audit';

const audit = AuditService.getInstance();

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Validation rules for common parameters
export const paramValidationRules = {
  // UUID parameter validation
  uuid: (paramName: string) => 
    param(paramName)
      .matches(UUID_REGEX)
      .withMessage(`${paramName} must be a valid UUID`)
      .escape(), // Escape HTML entities

  // Study ID validation
  studyId: param('id')
    .matches(UUID_REGEX)
    .withMessage('Study ID must be a valid UUID')
    .escape(),

  // Session ID validation  
  sessionId: param('id')
    .matches(UUID_REGEX)
    .withMessage('Session ID must be a valid UUID')
    .escape(),

  // Template ID validation
  templateId: param('id')
    .matches(UUID_REGEX)
    .withMessage('Template ID must be a valid UUID')
    .escape(),

  // User ID validation
  userId: param('id')
    .matches(UUID_REGEX)
    .withMessage('User ID must be a valid UUID')
    .escape(),

  // Pagination parameters
  page: param('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be between 1 and 1000')
    .toInt(),

  limit: param('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),

  // Search query validation
  searchQuery: param('q')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be 1-100 characters')
    .escape()
    .customSanitizer((value) => {
      // Remove potentially dangerous characters
      return value.replace(/[<>'"\\]/g, '');
    })
};

// Middleware to validate URL parameters
export const validateUrlParams = (validations: any[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
    try {
      // Run all validations
      await Promise.all(validations.map(validation => validation.run(req)));

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Log validation failure for security monitoring
        await audit.logSecurityEvent({
          type: 'validation_failed',
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          success: false,
          details: {
            endpoint: req.originalUrl,
            method: req.method,
            errors: errors.array(),
            parameters: req.params,
            potentialInjection: true
          }
        });

        return res.status(400).json({
          success: false,
          error: 'Invalid request parameters',
          details: errors.array().map((err: any) => ({
            parameter: err.param || 'unknown',
            message: err.msg || 'Invalid parameter',
            value: err.value
          }))
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Parameter validation failed'
      });
    }
  };
};

// Advanced injection detection middleware
export const detectInjectionAttempts = (req: Request, res: Response, next: NextFunction): void => {
  const suspiciousPatterns = [
    // SQL injection patterns
    /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b)/i,
    /(\bOR\s+1=1\b|\bAND\s+1=1\b)/i,
    /('|")\s*;\s*(\bDROP\b|\bDELETE\b|\bINSERT\b)/i,
    
    // NoSQL injection patterns
    /\$where|\$ne|\$gt|\$lt|\$regex|\$or|\$and/i,
    
    // Command injection patterns
    /[;&|`$(){}[\]]/,
    /\b(sh|bash|cmd|powershell|eval|exec|system)\b/i,
    
    // Path traversal
    /\.\.[\/\\]/,
    /[\/\\]\.\.[\/\\]/,
    
    // Script injection
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/i,
    /vbscript:/i,
    
    // LDAP injection
    /[*()\\]/,
    /\(\||\)\(|\&\(|\!\(/,
  ];

  // Check all input sources
  const inputSources = [
    { name: 'params', data: req.params },
    { name: 'query', data: req.query },
    { name: 'body', data: req.body }
  ];

  let suspiciousInput = false;
  const detectedPatterns: any[] = [];

  for (const source of inputSources) {
    if (source.data && typeof source.data === 'object') {
      for (const [key, value] of Object.entries(source.data)) {
        if (typeof value === 'string') {
          for (const pattern of suspiciousPatterns) {
            if (pattern.test(value)) {
              suspiciousInput = true;
              detectedPatterns.push({
                source: source.name,
                parameter: key,
                value: value.substring(0, 100), // Truncate for logging
                pattern: pattern.toString()
              });
            }
          }
        }
      }
    }
  }

  if (suspiciousInput) {
    // Log potential injection attempt
    audit.logSecurityEvent({
      type: 'suspicious_activity',
      userId: req.user?.id,
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      success: false,
      details: {
        endpoint: req.originalUrl,
        method: req.method,
        injectionType: 'parameter_injection',
        detectedPatterns,
        severity: 'HIGH'
      }
    }).catch(console.error);

    // For now, log and continue - in production, you might want to block the request
    console.warn('POTENTIAL INJECTION ATTEMPT DETECTED:', {
      ip: req.ip,
      endpoint: req.originalUrl,
      patterns: detectedPatterns.length,
      userId: req.user?.id
    });
  }

  next();
};

// Whitelist-based parameter filtering
export const filterAllowedParams = (allowedParams: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Filter query parameters
    if (req.query) {
      const filteredQuery: any = {};
      for (const param of allowedParams) {
        if (req.query[param] !== undefined) {
          filteredQuery[param] = req.query[param];
        }
      }
      req.query = filteredQuery;
    }

    // Filter body parameters (for non-POST requests where needed)
    if (req.body && req.method === 'GET') {
      const filteredBody: any = {};
      for (const param of allowedParams) {
        if (req.body[param] !== undefined) {
          filteredBody[param] = req.body[param];
        }
      }
      req.body = filteredBody;
    }

    next();
  };
};