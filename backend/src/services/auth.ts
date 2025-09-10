// Authentication service with MFA and security features

import { PrismaClient } from '@prisma/client';
import { SecurityConfig } from '../config/security';
import { AuditService } from './audit';
import { EncryptionService } from './encryption';
import { 
  UserRole, 
  User, 
  LoginRequest, 
  JWTPayload, 
  MFASetupResponse, 
  AuthResult,
  Permission
} from '../types/auth';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';
import * as speakeasy from 'speakeasy';
import crypto from 'crypto';

// Extend Prisma User type to include our custom methods
interface ExtendedUser extends User {
  permissions?: Permission[];
}

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
  private sanitizeUser(user: ExtendedUser & { mfaSecret?: string | null }): User {
    // Convert null to undefined for mfaSecret to match the User type
    const { mfaSecret, ...rest } = user;
    return {
      ...rest,
      mfaSecret: mfaSecret ?? undefined // Convert null to undefined
    };
  }

  // Register new user with secure password hashing
  async register(userData: { email: string; password: string; name: string; role?: string }, ipAddress: string): Promise<AuthResult> {
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

      // Ensure role is valid or default to VIEWER
      const role = userData.role ? this.toUserRole(userData.role) : UserRole.VIEWER;

      // Hash password with proper typing
      const passwordHash = await this.hashPassword(userData.password);
      
      // Create user with properly typed role
      const user = await this.prisma.user.create({
        data: {
          email: userData.email.toLowerCase(),
          name: userData.name,
          role: role as any, // Type assertion needed for Prisma enum
          passwordHash,
          isActive: true
        }
      });

      await this.audit.logSecurityEvent({
        type: 'registration',
        userId: user.id,
        ipAddress,
        success: true,
        details: { email: user.email, role: role }
      });

      return { 
        success: true, 
        user: this.sanitizeUser({
          ...user,
          role: this.toUserRole(user.role) // Ensure proper typing
        })
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
    const qrCode = await speakeasy.otpauthURL({
      secret: secret.ascii,
      label: `Safe LLM Lab (${user.email})`
    });

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

  // Generate JWT tokens with proper typing and expiration
  private async generateTokens(user: ExtendedUser, ipAddress: string, userAgent: string) {
    const now = Math.floor(Date.now() / 1000);
    const accessTokenExpiry = now + (SecurityConfig.jwt.accessTokenExpiryMs / 1000);
    const refreshTokenExpiry = now + (SecurityConfig.jwt.refreshTokenExpiryMs / 1000);
    
    // Ensure valid role
    const userRole = this.toUserRole(user.role);
    const permissions = this.getUserPermissions(userRole);
    const sessionId = crypto.randomUUID();
    
    // Create JWT payload with proper typing
    const accessTokenPayload: Omit<JWTPayload, 'iat' | 'exp'> & { iat: number; exp: number } = {
      sub: user.id,
      email: user.email,
      role: userRole,
      permissions,
      jti: crypto.randomUUID(),
      sessionId,
      iat: now,
      exp: accessTokenExpiry
    };

    const refreshToken = jwt.sign(
      { 
        sub: user.id, 
        jti: crypto.randomUUID(),
        sessionId,
        exp: refreshTokenExpiry 
      },
      SecurityConfig.jwt.refreshTokenSecret,
      {
        algorithm: 'HS256',
        issuer: SecurityConfig.jwt.issuer,
        audience: SecurityConfig.jwt.audience
      }
    );

    // Sign access token with proper options
    const accessToken = jwt.sign(
      accessTokenPayload,
      SecurityConfig.jwt.accessTokenSecret,
      {
        algorithm: 'HS256',
        issuer: SecurityConfig.jwt.issuer,
        audience: SecurityConfig.jwt.audience
      }
    );

    // Hash tokens before storing in database
    const accessTokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Store session in database with hashed tokens
    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        accessToken: accessTokenHash,
        refreshToken: refreshTokenHash,
        ipAddress,
        userAgent,
        expiresAt: new Date(refreshTokenExpiry * 1000),
        lastActivity: new Date(),
        isActive: true
      }
    });

    return { accessToken, refreshToken };
  }

  // Get user permissions based on role with proper typing
  private getUserPermissions(role: UserRole): Permission[] {
    const basePermissions: Record<UserRole, Permission[]> = {
      [UserRole.ADMIN]: [
        { resource: 'users', actions: ['create', 'read', 'update', 'delete', 'admin'] },
        { resource: 'studies', actions: ['create', 'read', 'update', 'delete', 'admin'] },
        { resource: 'templates', actions: ['create', 'read', 'update', 'delete', 'admin'] },
        { resource: 'sessions', actions: ['read', 'admin'] },
        { resource: 'system', actions: ['admin'] }
      ],
      [UserRole.RESEARCHER]: [
        { resource: 'studies', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'templates', actions: ['create', 'read', 'update'] },
        { resource: 'sessions', actions: ['read'] }
      ],
      [UserRole.ANALYST]: [
        { resource: 'studies', actions: ['read'] },
        { resource: 'templates', actions: ['read'] },
        { resource: 'sessions', actions: ['read'] }
      ],
      [UserRole.VIEWER]: [
        { resource: 'studies', actions: ['read'] },
        { resource: 'templates', actions: ['read'] }
      ]
    };

    return basePermissions[role] || [];
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
      // Hash the token to find the session
      const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
      
      await this.prisma.session.updateMany({
        where: { accessToken: tokenHash },
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
    return await argon2.hash(password, {
      type: argon2.argon2id,  // Using the enum value
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
      hashLength: 32
    });
  }

  // Verify user password (for sensitive operations)
  async verifyPassword(userId: string, password: string): Promise<ExtendedUser | null> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.isActive) return null;

      const isPasswordValid = await argon2.verify(user.passwordHash, password);
      return isPasswordValid ? (user as ExtendedUser) : null;
    } catch (error) {
      return null;
    }
  }

  // Disable MFA for user
  async disableMFA(userId: string): Promise<boolean> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { 
          mfaEnabled: false,
          mfaSecret: null
        }
      });

      await this.audit.logSecurityEvent({
        type: 'mfa_disabled',
        userId,
        success: true
      });

      return true;
    } catch (error) {
      return false;
    }
  }

  // Helper to validate and convert UserRole
  private toUserRole(role: any): UserRole {
    if (typeof role === 'string' && Object.keys(UserRole).includes(role)) {
      return role as UserRole;
    }
    return UserRole.VIEWER; // Default role
  }
}
