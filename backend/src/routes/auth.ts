// Authentication routes with comprehensive security

import express from 'express';
import { AuthService } from '../services/auth';
import { AuditService } from '../services/audit';
import { 
  sanitizeInput, 
  validateRequest, 
  validationRules, 
  createRateLimit,
  securityHeaders 
} from '../middleware/security';
import { SecurityConfig } from '../config/security';

const router = express.Router();
const authService = new AuthService();
const audit = AuditService.getInstance();

// Apply security middleware
router.use(securityHeaders);
router.use(sanitizeInput);

// Rate limiting for auth endpoints
const authRateLimit = createRateLimit(SecurityConfig.rateLimit.auth);

// User registration
router.post('/register', 
  authRateLimit,
  validateRequest([
    validationRules.email,
    validationRules.password,
    validationRules.name
  ]),
  async (req, res) => {
    try {
      const result = await authService.register(
        req.body,
        req.ip
      );

      if (result.success) {
        res.status(201).json({
          success: true,
          user: result.user,
          message: 'Registration successful'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      await audit.logSecurityEvent({
        type: 'registration_error',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: false,
        details: { error: error.message }
      });
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// User login
router.post('/login',
  authRateLimit,
  validateRequest([
    validationRules.email,
    validationRules.password
  ]),
  async (req, res) => {
    try {
      const result = await authService.login(
        req.body,
        req.ip,
        req.get('User-Agent') || ''
      );

      if (result.success) {
        // Set secure HTTP-only cookie for refresh token
        if (result.tokens) {
          res.cookie('refreshToken', result.tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
          });
        }

        res.json({
          success: true,
          user: result.user,
          accessToken: result.tokens?.accessToken,
          requiresMFA: result.requiresMFA
        });
      } else {
        res.status(401).json({
          success: false,
          error: result.error,
          requiresMFA: result.requiresMFA
        });
      }
    } catch (error) {
      await audit.logSecurityEvent({
        type: 'login_error',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: false,
        details: { error: error.message }
      });
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// MFA verification during login
router.post('/login/mfa',
  authRateLimit,
  validateRequest([
    validationRules.email,
    validationRules.mfaToken
  ]),
  async (req, res) => {
    try {
      const result = await authService.login(
        {
          email: req.body.email,
          password: req.body.password,
          mfaToken: req.body.mfaToken
        },
        req.ip,
        req.get('User-Agent') || ''
      );

      if (result.success && result.tokens) {
        res.cookie('refreshToken', result.tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({
          success: true,
          user: result.user,
          accessToken: result.tokens.accessToken
        });
      } else {
        res.status(401).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      res.status(500).json({ error: 'MFA verification failed' });
    }
  }
);

// Token refresh
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const result = await authService.refreshToken(refreshToken, req.ip);

    if (result.success && result.tokens) {
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        success: true,
        accessToken: result.tokens.accessToken
      });
    } else {
      res.status(401).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      await authService.logout(token);
    }

    res.clearCookie('refreshToken');
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Setup MFA
router.post('/mfa/setup', 
  // Note: This would need authentication middleware in real implementation
  async (req, res) => {
    try {
      const userId = req.body.userId; // Would come from authenticated user
      const mfaSetup = await authService.setupMFA(userId);
      
      res.json({
        success: true,
        secret: mfaSetup.secret,
        qrCode: mfaSetup.qrCode,
        backupCodes: mfaSetup.backupCodes
      });
    } catch (error) {
      res.status(500).json({ error: 'MFA setup failed' });
    }
  }
);

// Enable MFA
router.post('/mfa/enable',
  validateRequest([validationRules.mfaToken]),
  async (req, res) => {
    try {
      const userId = req.body.userId; // Would come from authenticated user
      const success = await authService.enableMFA(userId, req.body.mfaToken);
      
      if (success) {
        res.json({ success: true, message: 'MFA enabled successfully' });
      } else {
        res.status(400).json({ error: 'Invalid MFA token' });
      }
    } catch (error) {
      res.status(500).json({ error: 'MFA enable failed' });
    }
  }
);

export default router;
