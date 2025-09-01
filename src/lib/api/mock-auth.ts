// Mock authentication service for testing without backend

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

export class MockAuthService {
  private mockUser: User = {
    id: 'mock-user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'researcher',
    mfaEnabled: false,
    createdAt: new Date()
  };

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
    
    return {
      success: true,
      user: this.mockUser,
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
    return this.mockUser;
  }

  isAuthenticated(): boolean {
    return true;
  }

  getAccessToken(): string | null {
    return 'mock-token-123';
  }

  async initializeAuth(): Promise<User | null> {
    return this.mockUser;
  }
}

export const mockAuthService = new MockAuthService();
