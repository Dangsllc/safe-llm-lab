// Authentication and authorization types for multi-user system

// Re-export Prisma's UserRole to ensure type consistency
export const UserRole = {
  admin: 'admin',
  researcher: 'researcher',
  analyst: 'analyst',
  viewer: 'viewer'
} as const;

export type UserRole = keyof typeof UserRole;

export enum CollaborationRole {
  OWNER = 'owner',
  EDITOR = 'editor',
  CONTRIBUTOR = 'contributor',
  VIEWER = 'viewer'
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  mfaSecret?: string;
  mfaEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  isActive: boolean;
}

export interface Permission {
  resource: 'studies' | 'templates' | 'sessions' | 'users' | 'system';
  actions: ('create' | 'read' | 'update' | 'delete' | 'share' | 'admin')[];
  conditions?: {
    ownedOnly?: boolean;
    sharedOnly?: boolean;
    studyRole?: CollaborationRole;
  };
}

export interface JWTPayload {
  sub: string; // user ID
  email: string;
  role: UserRole;
  permissions: Permission[];
  iat: number;
  exp: number;
  jti: string; // JWT ID for revocation
  sessionId: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };
  requiresMFA?: boolean;
  error?: string;
}

export interface UserRegistration {
  email: string;
  name: string;
  password: string;
  role?: UserRole;
  inviteToken?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  mfaToken?: string;
  rememberMe?: boolean;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

export interface MFASetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export type SecurityEventType = 
  | 'login'
  | 'logout'
  | 'failed_login'
  | 'failed_auth'
  | 'password_change'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'permission_change'
  | 'data_access'
  | 'suspicious_activity'
  | 'data_export'
  | 'data_export_failed'
  | 'data_migration_success'
  | 'data_migration_failed'
  | 'migration_verification'
  | 'migration_verification_failed'
  | 'websocket_auth_failed'
  | 'websocket_connected'
  | 'websocket_setup_failed'
  | 'websocket_invalid_message'
  | 'websocket_message_processed'
  | 'websocket_message_failed'
  | 'websocket_disconnected'
  | 'websocket_error'
  | 'unauthorized_access'
  | 'rate_limit_exceeded'
  | 'validation_failed'
  | 'api_request'
  | 'ip_blocked'
  | 'registration_error'
  | 'login_error'
  | 'server_error'
  | 'not_found'
  | 'failed_registration'
  | 'registration';

export interface SecurityEvent {
  id: string;
  userId?: string;
  type: SecurityEventType;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  details?: Record<string, any>;
  timestamp: Date;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface Session {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivity: Date;
  isActive: boolean;
}
