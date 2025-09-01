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

  // Get current user from session
  getCurrentUser(): User | null {
    try {
      const userData = sessionStorage.getItem('currentUser');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      return null;
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const user = this.getCurrentUser();
    const token = sessionStorage.getItem('accessToken');
    return !!(user && token);
  }

  // Get access token
  getAccessToken(): string | null {
    return sessionStorage.getItem('accessToken');
  }

  // Initialize authentication state on app load
  async initializeAuth(): Promise<User | null> {
    const token = this.getAccessToken();
    if (!token) return null;

    // Set token in API client
    apiClient.setTokens(token);

    // Verify token is still valid by making a test request
    try {
      const response = await apiClient.get<User>('/auth/me');
      if (response.success && response.data) {
        return response.data;
      }
    } catch (error) {
      // Token is invalid, clear session
      this.clearUserSession();
    }

    return null;
  }

  // Private helper methods
  private storeUserSession(user: User, accessToken: string): void {
    try {
      sessionStorage.setItem('currentUser', JSON.stringify(user));
      sessionStorage.setItem('accessToken', accessToken);
    } catch (error) {
      logError('Failed to store user session', 'AUTH-SERVICE');
    }
  }

  private clearUserSession(): void {
    try {
      sessionStorage.removeItem('currentUser');
      sessionStorage.removeItem('accessToken');
    } catch (error) {
      logError('Failed to clear user session', 'AUTH-SERVICE');
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
