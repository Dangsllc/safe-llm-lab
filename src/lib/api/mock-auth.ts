// Mock authentication service for testing without backend

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'researcher' | 'admin' | 'viewer';
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

export class MockAuthService {
  private mockUser: User = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'researcher',
    mfaEnabled: false,
    lastLogin: new Date(),
    createdAt: new Date()
  };
  
  private currentUser: User | null = null;

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      success: true,
      user: {
        ...this.mockUser,
        email: userData.email,
        name: userData.name,
        role: userData.role as any || 'researcher'
      }
    };
  }

  async login(loginData: LoginRequest): Promise<AuthResponse> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Basic validation
    if (!loginData.email || !loginData.password) {
      return { success: false, error: 'Email and password are required' };
    }
    
    // For demo purposes, accept any non-empty password
    this.currentUser = { 
      ...this.mockUser, 
      id: `user-${Date.now()}`,
      email: loginData.email,
      name: loginData.email.split('@')[0], // Generate a name from email
      role: loginData.email.endsWith('@admin.com') ? 'admin' : 
            loginData.email.endsWith('@researcher.com') ? 'researcher' : 'user',
      mfaEnabled: false,
      lastLogin: new Date(),
      createdAt: new Date()
    };
    
    // Store in localStorage to persist across page refreshes
    if (typeof window !== 'undefined') {
      localStorage.setItem('mockAuth', JSON.stringify({
        user: this.currentUser,
        token: 'mock-token-123'
      }));
    }
    
    return {
      success: true,
      user: this.currentUser,
      accessToken: 'mock-token-123'
    };
  }

  async verifyMFA(email: string, password: string, mfaToken: string): Promise<AuthResponse> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      success: true,
      user: this.mockUser,
      accessToken: 'mock-token-123'
    };
  }

  async logout(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200));
    this.currentUser = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mockAuth');
    }
  }

  async setupMFA(): Promise<any> {
    return {
      secret: 'mock-secret',
      qrCode: 'data:image/png;base64,mock-qr-code',
      backupCodes: ['123456', '789012']
    };
  }

  async enableMFA(mfaToken: string): Promise<boolean> {
    return true;
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return !!this.currentUser;
  }

  getAccessToken(): string | null {
    return this.currentUser ? 'mock-token-123' : null;
  }

  async initializeAuth(): Promise<User | null> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Check localStorage for existing session
    if (typeof window !== 'undefined') {
      const storedAuth = localStorage.getItem('mockAuth');
      if (storedAuth) {
        try {
          const { user, token } = JSON.parse(storedAuth);
          this.currentUser = user;
          return user;
        } catch (e) {
          console.error('Failed to parse stored auth', e);
          localStorage.removeItem('mockAuth');
        }
      }
    }
    
    return this.currentUser || null;
  }
}

export const mockAuthService = new MockAuthService();
