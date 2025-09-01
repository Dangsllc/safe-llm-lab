// Secure Express server for multi-user Safe LLM Lab

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import session from 'express-session';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';
import { PrismaClient } from '@prisma/client';
import { SecurityConfig, validateSecurityConfig } from './config/security';
import { securityHeaders, requestLogger, sanitizeInput } from './middleware/security';
import authRoutes from './routes/auth';
import studyRoutes from './routes/studies';
import sessionRoutes from './routes/sessions';
import templateRoutes from './routes/templates';
import userRoutes from './routes/users';
import { AuditService } from './services/audit';

// Validate security configuration
validateSecurityConfig();

const app = express();
const prisma = new PrismaClient();
const audit = AuditService.getInstance();

// Redis client for session storage
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.connect().catch(console.error);

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Security middleware stack
app.use(helmet({
  contentSecurityPolicy: SecurityConfig.headers.contentSecurityPolicy,
  hsts: SecurityConfig.headers.hsts,
  referrerPolicy: { policy: SecurityConfig.headers.referrerPolicy }
}));

// CORS configuration
app.use(cors(SecurityConfig.cors));

// Request parsing with size limits
app.use(express.json({ 
  limit: SecurityConfig.api.maxRequestSize,
  verify: (req, res, buf) => {
    // Verify content type for JSON requests
    if (SecurityConfig.api.validateContentType && 
        req.headers['content-type'] && 
        !req.headers['content-type'].includes('application/json')) {
      throw new Error('Invalid content type');
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: SecurityConfig.api.maxRequestSize 
}));

// Session configuration with Redis
app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: SecurityConfig.session.secret,
  name: SecurityConfig.session.name,
  resave: false,
  saveUninitialized: false,
  rolling: SecurityConfig.session.rolling,
  cookie: {
    secure: SecurityConfig.session.secure,
    httpOnly: SecurityConfig.session.httpOnly,
    maxAge: SecurityConfig.session.maxAge,
    sameSite: SecurityConfig.session.sameSite
  }
}));

// Security middleware
app.use(securityHeaders);
app.use(sanitizeInput);
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/studies', studyRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/users', userRoutes);

// Global error handler
app.use(async (error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  await audit.logSecurityEvent({
    type: 'server_error',
    userId: req.user?.id,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    success: false,
    details: { 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      endpoint: req.path,
      method: req.method
    }
  });

  res.status(error.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message
  });
});

// 404 handler
app.use('*', async (req, res) => {
  await audit.logSecurityEvent({
    type: 'not_found',
    userId: req.user?.id,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    success: false,
    details: { path: req.originalUrl, method: req.method }
  });

  res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  await prisma.$disconnect();
  await redisClient.disconnect();
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  
  await prisma.$disconnect();
  await redisClient.disconnect();
  
  process.exit(0);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🔒 Secure Safe LLM Lab API server running on port ${PORT}`);
  console.log(`🛡️  Security features enabled: ${Object.keys(SecurityConfig).join(', ')}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
