// Authentication API service for multi-user system

import { apiClient } from './client';
import { logSecurity, logError } from '../security/secure-logger';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'researcher' | 'analyst' | 'viewer';
  mfaEnabled: boolean;
  lastLogin?: Date;
  createdAt: Date;
}

export interface LoginRequest {
  email: string;
  password: string;
  mfaToken?: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
  role?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  accessToken?: string;
  requiresMFA?: boolean;
  error?: string;
}

export interface MFASetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export class AuthService {
  private currentUser: User | null = null;

  // User registration
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/register', userData);
      
      if (response.success && response.data) {
        logSecurity('User registration successful', { email: userData.email });
        return response.data;
      }
      
      return {
        success: false,
        error: response.error || 'Registration failed'
      };
    } catch (error) {
      logError('Registration request failed', 'AUTH-SERVICE');
      return {
        success: false,
        error: 'Registration request failed'
      };
    }
  }

  // User login
  async login(loginData: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/login', loginData);
      
      if (response.success && response.data) {
        if (response.data.accessToken) {
          // Store access token in API client
          apiClient.setTokens(response.data.accessToken);
          
          // Store user session data securely
          this.storeUserSession(response.data.user!, response.data.accessToken);
          
          logSecurity('User login successful', { 
            userId: response.data.user?.id,
            mfaRequired: response.data.requiresMFA 
          });
        }
        
        return response.data;
      }
      
      return {
        success: false,
        error: response.error || 'Login failed'
      };
    } catch (error) {
      logError('Login request failed', 'AUTH-SERVICE');
      return {
        success: false,
        error: 'Login request failed'
      };
    }
  }

  // MFA verification during login
  async verifyMFA(email: string, password: string, mfaToken: string): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/login/mfa', {
        email,
        password,
        mfaToken
      });
      
      if (response.success && response.data?.accessToken) {
        apiClient.setTokens(response.data.accessToken);
        this.storeUserSession(response.data.user!, response.data.accessToken);
        
        logSecurity('MFA verification successful', { 
          userId: response.data.user?.id 
        });
      }
      
      return response.data || { success: false, error: response.error };
    } catch (error) {
      logError('MFA verification failed', 'AUTH-SERVICE');
      return {
        success: false,
        error: 'MFA verification failed'
      };
    }
  }

  // Logout
  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
      
      // Clear tokens and session data
      apiClient.clearTokens();
      this.clearUserSession();
      
      logSecurity('User logout successful');
    } catch (error) {
      logError('Logout request failed', 'AUTH-SERVICE');
      // Clear local data even if API call fails
      apiClient.clearTokens();
      this.clearUserSession();
    }
  }

  // Setup MFA
  async setupMFA(): Promise<MFASetupResponse | null> {
    try {
      const response = await apiClient.post<MFASetupResponse>('/auth/mfa/setup');
      
      if (response.success && response.data) {
        logSecurity('MFA setup initiated');
        return response.data;
      }
      
      return null;
    } catch (error) {
      logError('MFA setup failed', 'AUTH-SERVICE');
      return null;
    }
  }

  // Enable MFA
  async enableMFA(mfaToken: string): Promise<boolean> {
    try {
      const response = await apiClient.post('/auth/mfa/enable', { mfaToken });
      
      if (response.success) {
        logSecurity('MFA enabled successfully');
        return true;
      }
      
      return false;
    } catch (error) {
      logError('MFA enable failed', 'AUTH-SERVICE');
      return false;
    }
  }

  // Get current user from memory (will be set after successful auth)
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  // Check if user is authenticated (tokens are now in HTTP-only cookies)
  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  // Get access token (no longer accessible from client-side for security)
  getAccessToken(): string | null {
    // Tokens are now in HTTP-only cookies, not accessible from JS
    return null;
  }

  // Initialize authentication state on app load
  async initializeAuth(): Promise<User | null> {
    // Tokens are now in HTTP-only cookies, so we verify auth by calling /auth/me
    try {
      const response = await apiClient.get<User>('/auth/me');
      if (response.success && response.data) {
        this.currentUser = response.data;
        return response.data;
      }
    } catch (error) {
      // Not authenticated or token expired
      this.currentUser = null;
    }

    return null;
  }

  // Private helper methods
  private storeUserSession(user: User, accessToken?: string): void {
    // Store user in memory only - tokens are in HTTP-only cookies
    this.currentUser = user;
    // Note: accessToken parameter kept for compatibility but not stored
  }

  private clearUserSession(): void {
    // Clear user from memory - cookies will be cleared by logout endpoint
    this.currentUser = null;
  }
}

// Export singleton instance
export const authService = new AuthService();
