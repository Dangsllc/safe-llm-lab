// Authentication context for multi-user system

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, User, LoginRequest, RegisterRequest, AuthResponse } from '@/lib/api/auth';
import { logSecurity, logError } from '@/lib/security/secure-logger';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (loginData: LoginRequest) => Promise<AuthResponse>;
  register: (userData: RegisterRequest) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  verifyMFA: (email: string, password: string, mfaToken: string) => Promise<AuthResponse>;
  setupMFA: () => Promise<any>;
  enableMFA: (token: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize authentication state on app load
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      const currentUser = await authService.initializeAuth();
      setUser(currentUser);
    } catch (error) {
      logError('Auth initialization failed', 'AUTH-CONTEXT');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (loginData: LoginRequest): Promise<AuthResponse> => {
    try {
      const result = await authService.login(loginData);
      
      if (result.success && result.user) {
        setUser(result.user);
        logSecurity('User logged in via context', { userId: result.user.id });
      }
      
      return result;
    } catch (error) {
      logError('Login failed in context', 'AUTH-CONTEXT');
      return { success: false, error: 'Login failed' };
    }
  };

  const register = async (userData: RegisterRequest): Promise<AuthResponse> => {
    try {
      const result = await authService.register(userData);
      
      if (result.success && result.user) {
        setUser(result.user);
        logSecurity('User registered via context', { email: userData.email });
      }
      
      return result;
    } catch (error) {
      logError('Registration failed in context', 'AUTH-CONTEXT');
      return { success: false, error: 'Registration failed' };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authService.logout();
      setUser(null);
      logSecurity('User logged out via context');
    } catch (error) {
      logError('Logout failed in context', 'AUTH-CONTEXT');
      // Clear user state even if API call fails
      setUser(null);
    }
  };

  const verifyMFA = async (email: string, password: string, mfaToken: string): Promise<AuthResponse> => {
    try {
      const result = await authService.verifyMFA(email, password, mfaToken);
      
      if (result.success && result.user) {
        setUser(result.user);
      }
      
      return result;
    } catch (error) {
      logError('MFA verification failed in context', 'AUTH-CONTEXT');
      return { success: false, error: 'MFA verification failed' };
    }
  };

  const setupMFA = async () => {
    try {
      return await authService.setupMFA();
    } catch (error) {
      logError('MFA setup failed in context', 'AUTH-CONTEXT');
      return null;
    }
  };

  const enableMFA = async (token: string): Promise<boolean> => {
    try {
      const success = await authService.enableMFA(token);
      
      if (success && user) {
        // Update user state to reflect MFA enabled
        setUser({ ...user, mfaEnabled: true });
      }
      
      return success;
    } catch (error) {
      logError('MFA enable failed in context', 'AUTH-CONTEXT');
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
    verifyMFA,
    setupMFA,
    enableMFA
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
