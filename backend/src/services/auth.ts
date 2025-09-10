// Authentication service with MFA and security features

import argon2, { Options } from 'argon2';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import crypto from 'crypto';
import { Prisma, PrismaClient, User as PrismaUser, UserRole } from '@prisma/client';
import { SecurityConfig } from '../config/security';
import { EncryptionService } from './encryption';
import { AuditService } from './audit';
import { 
  User, 
  UserRegistration, 
  LoginRequest, 
  JWTPayload,
  MFASetupResponse, 
  AuthResult 
} from '../types/auth';

// Extend Prisma User type to include our custom methods
type ExtendedUser = PrismaUser & {
  permissions?: any[]; // We'll type this properly after our Prisma client is updated
};

export class AuthService {
  private prisma: PrismaClient;
  private encryption: EncryptionService;
  private audit: AuditService;

  constructor() {
    this.prisma = new PrismaClient();
    this.encryption = EncryptionService.getInstance();
    this.audit = AuditService.getInstance();
  }

  // Sanitize user data before sending to client
  private sanitizeUser(user: ExtendedUser): User {
    const { passwordHash, mfaSecret, ...sanitized } = user;
    return sanitized as unknown as User;
  }

  // Register new user with secure password hashing
  async register(userData: UserRegistration, ipAddress: string): Promise<AuthResult> {
    try {
      // Validate password strength
      if (!this.isPasswordStrong(userData.password)) {
        await this.audit.logSecurityEvent({
          type: 'failed_registration',
          ipAddress,
          success: false,
          details: { email: userData.email, reason: 'weak_password' }
        });
        return { success: false, error: 'Password does not meet security requirements' };
      }

      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: userData.email.toLowerCase() }
      });

      if (existingUser) {
        await this.audit.logSecurityEvent({
          type: 'failed_registration',
          ipAddress,
          success: false,
          details: { email: userData.email, reason: 'email_exists' }
        });
        return { success: false, error: 'User already exists' };
      }

      // Hash password with proper typing
      const passwordHash = await this.hashPassword(userData.password);
      
      // Use Prisma's UserRole with a default of RESEARCHER
      const role: UserRole = (userData.role as UserRole) || UserRole.RESEARCHER;
      
      // Create user with properly typed role
      const user = await this.prisma.user.create({
        data: {
          email: userData.email.toLowerCase(),
          name: userData.name,
          role,
          passwordHash,
          isActive: true
        }
      });

      await this.audit.logSecurityEvent({
        type: 'registration',
        userId: user.id,
        ipAddress,
        success: true,
        details: { email: user.email, role: user.role }
      });

      return { 
        success: true, 
        user: this.sanitizeUser(user as ExtendedUser)
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.audit.logSecurityEvent({
        type: 'registration_error',
        ipAddress,
        success: false,
        details: { 
          email: userData.email,
          error: errorMessage 
        }
      });
      return { 
        success: false, 
        error: 'Registration failed. Please try again.' 
      };
    }
  }

  // Authenticate user with optional MFA
  async login(loginData: LoginRequest, ipAddress: string, userAgent: string): Promise<AuthResult> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: loginData.email.toLowerCase() }
      });

      if (!user || !user.isActive) {
        await this.audit.logSecurityEvent({
          type: 'failed_login',
          ipAddress,
          userAgent,
          success: false,
          details: { email: loginData.email, reason: 'user_not_found' }
        });
        return { success: false, error: 'Invalid credentials' };
      }

      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        await this.audit.logSecurityEvent({
          type: 'failed_login',
          userId: user.id,
          ipAddress,
          userAgent,
          success: false,
          details: { reason: 'account_locked' }
        });
        return { success: false, error: 'Account is temporarily locked' };
      }

      // Verify password
      const isPasswordValid = await argon2.verify(user.passwordHash, loginData.password);
      
      if (!isPasswordValid) {
        await this.handleFailedLogin(user.id, ipAddress, userAgent);
        return { success: false, error: 'Invalid credentials' };
      }

      // Check MFA if enabled
      if (user.mfaEnabled) {
        if (!loginData.mfaToken) {
          return { success: false, requiresMFA: true };
        }

        const isMFAValid = await this.verifyMFA(user.id, loginData.mfaToken);
        if (!isMFAValid) {
          await this.audit.logSecurityEvent({
            type: 'failed_login',
            userId: user.id,
            ipAddress,
            userAgent,
            success: false,
            details: { reason: 'invalid_mfa' }
          });
          return { success: false, error: 'Invalid MFA token' };
        }
      }

      // Reset failed login attempts
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLogin: new Date()
        }
      });

      // Generate tokens
      const tokens = await this.generateTokens(user as ExtendedUser, ipAddress, userAgent);

      await this.audit.logSecurityEvent({
        type: 'login',
        userId: user.id,
        ipAddress,
        userAgent,
        success: true,
        details: { mfaUsed: user.mfaEnabled }
      });

      return {
        success: true,
        user: this.sanitizeUser(user as ExtendedUser),
        tokens
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.audit.logSecurityEvent({
        type: 'login_error',
        ipAddress,
        userAgent,
        success: false,
        details: { 
          email: loginData.email,
          error: errorMessage 
        }
      });
      return { 
        success: false, 
        error: 'Login failed. Please try again.' 
      };
    }
  }

  // Setup MFA for user
  async setupMFA(userId: string): Promise<MFASetupResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const secret = speakeasy.generateSecret({
      name: `Safe LLM Lab (${user.email})`,
      issuer: SecurityConfig.mfa.issuer,
      length: 32
    });

    // Encrypt and store MFA secret
    const encryptedSecret = this.encryption.encryptField(secret.base32);
    
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: encryptedSecret }
    });

    // Generate QR code
    const qrCode = await qrcode.toDataURL(secret.otpauth_url!);

    // Generate backup codes
    const backupCodes = this.encryption.generateBackupCodes(SecurityConfig.mfa.backupCodesCount);

    return {
      secret: secret.base32,
      qrCode,
      backupCodes
    };
  }

  // Enable MFA after verification
  async enableMFA(userId: string, token: string): Promise<boolean> {
    const isValid = await this.verifyMFA(userId, token);
    if (!isValid) return false;

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true }
    });

    await this.audit.logSecurityEvent({
      type: 'mfa_enabled',
      userId,
      success: true
    });

    return true;
  }

  // Verify MFA token
  async verifyMFA(userId: string, token: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) return false;

    const secret = this.encryption.decryptField(user.mfaSecret);
    
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: SecurityConfig.mfa.window,
      step: SecurityConfig.mfa.step
    });
  }

  // Generate JWT tokens
  private async generateTokens(user: ExtendedUser, ipAddress: string, userAgent: string) {
    const sessionId = crypto.randomUUID();
    const jti = crypto.randomUUID();

    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: await this.getUserPermissions(user.role),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
      jti,
      sessionId
    };

    const accessToken = jwt.sign(payload, SecurityConfig.jwt.accessTokenSecret, {
      expiresIn: SecurityConfig.jwt.accessTokenExpiry,
      issuer: SecurityConfig.jwt.issuer,
      audience: SecurityConfig.jwt.audience
    });

    const refreshToken = jwt.sign(
      { sub: user.id, sessionId, jti },
      SecurityConfig.jwt.refreshTokenSecret,
      { expiresIn: SecurityConfig.jwt.refreshTokenExpiry }
    );

    // Store session
    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        accessToken,
        refreshToken,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    return { accessToken, refreshToken };
  }

  // Handle failed login attempts
  private async handleFailedLogin(userId: string, ipAddress: string, userAgent: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= SecurityConfig.password.maxAttempts;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: shouldLock ? 
          new Date(Date.now() + SecurityConfig.password.lockoutDuration) : 
          null
      }
    });

    await this.audit.logSecurityEvent({
      type: 'failed_login',
      userId,
      ipAddress,
      userAgent,
      success: false,
      details: { 
        attempts, 
        locked: shouldLock,
        reason: 'invalid_password'
      }
    });
  }

  // Validate password strength
  private isPasswordStrong(password: string): boolean {
    const config = SecurityConfig.password;
    
    if (password.length < config.minLength) return false;
    if (config.requireUppercase && !/[A-Z]/.test(password)) return false;
    if (config.requireLowercase && !/[a-z]/.test(password)) return false;
    if (config.requireNumbers && !/\d/.test(password)) return false;
    if (config.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false;
    
    return true;
  }

  // Get user permissions based on role
  private async getUserPermissions(role: UserRole) {
    // Implementation would return role-based permissions
    const permissions = {
      [UserRole.ADMIN]: ['*'],
      [UserRole.RESEARCHER]: ['studies:*', 'templates:*', 'sessions:*'],
      [UserRole.ANALYST]: ['studies:read', 'sessions:read', 'templates:read'],
      [UserRole.VIEWER]: ['studies:read', 'sessions:read']
    };

    return permissions[role] || [];
  }

  // Refresh access token
  async refreshToken(refreshToken: string, ipAddress: string): Promise<AuthResult> {
    try {
      const decoded = jwt.verify(refreshToken, SecurityConfig.jwt.refreshTokenSecret) as any;
      
      const session = await this.prisma.session.findFirst({
        where: {
          refreshToken,
          isActive: true,
          expiresAt: { gt: new Date() }
        },
        include: { user: true }
      });

      if (!session) {
        return { success: false, error: 'Invalid refresh token' };
      }

      // Generate new tokens
      const tokens = await this.generateTokens(session.user as ExtendedUser, ipAddress, '');
      
      // Invalidate old session
      await this.prisma.session.update({
        where: { id: session.id },
        data: { isActive: false }
      });

      return {
        success: true,
        user: this.sanitizeUser(session.user as ExtendedUser),
        tokens
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { 
        success: false, 
        error: 'Token refresh failed. Please try again.' 
      };
    }
  }

  // Logout and invalidate session
  async logout(accessToken: string): Promise<boolean> {
    try {
      await this.prisma.session.updateMany({
        where: { accessToken },
        data: { isActive: false }
      });
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return false;
    }
  }

  // Hash password with proper typing
  private async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      ...SecurityConfig.password.argon2Options,
      raw: false, // Ensure we get a string output
    });
  }
}
