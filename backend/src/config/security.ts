// Security configuration for multi-user Safe LLM Lab

import crypto from 'crypto';

// Helper function to convert time string to milliseconds
const toMilliseconds = (timeStr: string): number => {
  const value = parseInt(timeStr);
  if (timeStr.endsWith('d')) return value * 24 * 60 * 60 * 1000;
  if (timeStr.endsWith('h')) return value * 60 * 60 * 1000;
  if (timeStr.endsWith('m')) return value * 60 * 1000;
  if (timeStr.endsWith('s')) return value * 1000;
  return value; // assume milliseconds
};

export const SecurityConfig = {
  // JWT Configuration
  jwt: {
    accessTokenSecret: process.env['JWT_ACCESS_SECRET'] || (() => {
      if (process.env['NODE_ENV'] === 'production') {
        throw new Error('JWT_ACCESS_SECRET must be set in production');
      }
      return crypto.randomBytes(64).toString('hex');
    })(),
    refreshTokenSecret: process.env['JWT_REFRESH_SECRET'] || (() => {
      if (process.env['NODE_ENV'] === 'production') {
        throw new Error('JWT_REFRESH_SECRET must be set in production');
      }
      return crypto.randomBytes(64).toString('hex');
    })(),
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
    accessTokenExpiryMs: toMilliseconds('15m'),
    refreshTokenExpiryMs: toMilliseconds('7d'),
    issuer: 'safe-llm-lab',
    audience: 'safe-llm-lab-users'
  },

  // Password Security
  password: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxAttempts: 5,
    lockoutDuration: 30 * 60 * 1000, // 30 minutes
    argon2Options: {
      type: 2, // Argon2id
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4
    }
  },

  // Session Security
  session: {
    name: 'safe-llm-session',
    secret: process.env['SESSION_SECRET'] || (() => {
      if (process.env['NODE_ENV'] === 'production') {
        throw new Error('SESSION_SECRET must be set in production');
      }
      return crypto.randomBytes(64).toString('hex');
    })(),
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env['NODE_ENV'] === 'production',
    httpOnly: true,
    sameSite: 'strict' as const,
    rolling: true
  },

  // Rate Limiting
  rateLimit: {
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts per window
      skipSuccessfulRequests: true
    },
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per window
      standardHeaders: true,
      legacyHeaders: false
    },
    upload: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10, // 10 uploads per hour
      skipSuccessfulRequests: false
    }
  },

  // Encryption
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    tagLength: 16,
    saltLength: 32,
    iterations: 100000
  },

  // MFA Configuration
  mfa: {
    issuer: 'Safe LLM Lab',
    window: 2, // Allow 2 time steps before/after
    step: 30, // 30 seconds
    digits: 6,
    backupCodesCount: 10
  },

  // Security Headers
  headers: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: []
      }
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
      usb: [],
      magnetometer: [],
      gyroscope: [],
      accelerometer: []
    }
  },

  // CORS Configuration
  cors: {
    origin: process.env['FRONTEND_URL'] || 'http://localhost:8080',
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-CSRF-Token'
    ]
  },

  // Database Security
  database: {
    ssl: process.env['NODE_ENV'] === 'production',
    connectionTimeout: 60000,
    idleTimeout: 600000,
    maxConnections: 20,
    encryptionAtRest: true
  },

  // Audit Logging
  audit: {
    logLevel: process.env['LOG_LEVEL'] || 'info',
    retentionDays: 90,
    sensitiveFields: [
      'password',
      'passwordHash',
      'mfaSecret',
      'accessToken',
      'refreshToken',
      'sessionId'
    ],
    highRiskActions: [
      'login',
      'password_change',
      'mfa_disable',
      'permission_escalation',
      'data_export',
      'user_delete'
    ]
  },

  // File Upload Security
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'application/json',
      'text/csv',
      'text/plain'
    ],
    scanForMalware: process.env['NODE_ENV'] === 'production',
    quarantinePath: '/tmp/quarantine'
  },

  // API Security
  api: {
    maxRequestSize: '10mb',
    timeout: 30000,
    validateContentType: true,
    requireHttps: process.env['NODE_ENV'] === 'production'
  }
};

// Environment validation
export const validateSecurityConfig = (): void => {
  const requiredEnvVars = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'SESSION_SECRET',
    'DATABASE_URL'
  ];

  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate secret lengths
  if (process.env['JWT_ACCESS_SECRET'] && process.env['JWT_ACCESS_SECRET'].length < 32) {
    throw new Error('JWT_ACCESS_SECRET must be at least 32 characters');
  }

  if (process.env['SESSION_SECRET'] && process.env['SESSION_SECRET'].length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters');
  }
};
