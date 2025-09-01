// Secure session management for Safe LLM Lab
// Implements secure session handling, timeout, and authentication state

export interface SessionData {
  userId?: string;
  sessionId: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  isAuthenticated: boolean;
  permissions: string[];
}

export class SessionManager {
  private static instance: SessionManager;
  private currentSession: SessionData | null = null;
  private sessionTimeout: number = 30 * 60 * 1000; // 30 minutes
  private activityTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializeSession();
    this.setupActivityTracking();
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  private initializeSession(): void {
    // Check for existing session in secure storage
    const existingSession = this.getStoredSession();
    if (existingSession && this.isSessionValid(existingSession)) {
      this.currentSession = existingSession;
      this.updateLastActivity();
    } else {
      this.createGuestSession();
    }
  }

  private getStoredSession(): SessionData | null {
    try {
      const sessionData = localStorage.getItem('safe-llm-session');
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        return {
          ...parsed,
          createdAt: new Date(parsed.createdAt),
          lastActivity: new Date(parsed.lastActivity),
          expiresAt: new Date(parsed.expiresAt)
        };
      }
    } catch (error) {
      console.warn('Failed to parse stored session:', error);
    }
    return null;
  }

  private isSessionValid(session: SessionData): boolean {
    const now = new Date();
    return session.expiresAt > now;
  }

  private createGuestSession(): void {
    const now = new Date();
    this.currentSession = {
      sessionId: this.generateSessionId(),
      createdAt: now,
      lastActivity: now,
      expiresAt: new Date(now.getTime() + this.sessionTimeout),
      isAuthenticated: false,
      permissions: ['read', 'test'] // Basic permissions for guest users
    };
    this.storeSession();
  }

  private generateSessionId(): string {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private storeSession(): void {
    if (this.currentSession) {
      localStorage.setItem('safe-llm-session', JSON.stringify(this.currentSession));
    }
  }

  private setupActivityTracking(): void {
    // Track user activity to extend session
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    const activityHandler = () => {
      this.updateLastActivity();
    };

    events.forEach(event => {
      document.addEventListener(event, activityHandler, { passive: true });
    });

    // Set up session timeout check
    this.activityTimer = setInterval(() => {
      this.checkSessionTimeout();
    }, 60000); // Check every minute
  }

  private updateLastActivity(): void {
    if (this.currentSession) {
      const now = new Date();
      this.currentSession.lastActivity = now;
      this.currentSession.expiresAt = new Date(now.getTime() + this.sessionTimeout);
      this.storeSession();
    }
  }

  private checkSessionTimeout(): void {
    if (this.currentSession && !this.isSessionValid(this.currentSession)) {
      this.expireSession();
    }
  }

  // Public methods
  getSession(): SessionData | null {
    return this.currentSession;
  }

  isAuthenticated(): boolean {
    return this.currentSession?.isAuthenticated || false;
  }

  hasPermission(permission: string): boolean {
    return this.currentSession?.permissions.includes(permission) || false;
  }

  extendSession(additionalTime?: number): void {
    if (this.currentSession) {
      const extension = additionalTime || this.sessionTimeout;
      const now = new Date();
      this.currentSession.expiresAt = new Date(now.getTime() + extension);
      this.updateLastActivity();
    }
  }

  expireSession(): void {
    this.currentSession = null;
    localStorage.removeItem('safe-llm-session');
    
    // Dispatch custom event for session expiration
    window.dispatchEvent(new CustomEvent('sessionExpired'));
    
    // Create new guest session
    this.createGuestSession();
  }

  refreshSession(): void {
    if (this.currentSession) {
      this.updateLastActivity();
    } else {
      this.createGuestSession();
    }
  }

  // Authentication methods (placeholder for future implementation)
  authenticate(credentials: { username: string; password: string }): Promise<boolean> {
    // TODO: Implement actual authentication
    return Promise.resolve(false);
  }

  logout(): void {
    this.expireSession();
    window.location.reload(); // Force app refresh
  }

  // Security methods
  validateSessionIntegrity(): boolean {
    if (!this.currentSession) return false;
    
    // Check for session tampering
    const storedSession = this.getStoredSession();
    if (!storedSession) return false;
    
    return storedSession.sessionId === this.currentSession.sessionId;
  }

  getSessionInfo(): Partial<SessionData> {
    if (!this.currentSession) return {};
    
    return {
      sessionId: this.currentSession.sessionId,
      createdAt: this.currentSession.createdAt,
      lastActivity: this.currentSession.lastActivity,
      expiresAt: this.currentSession.expiresAt,
      isAuthenticated: this.currentSession.isAuthenticated,
      permissions: [...this.currentSession.permissions]
    };
  }

  // Cleanup
  destroy(): void {
    if (this.activityTimer) {
      clearInterval(this.activityTimer);
    }
    this.expireSession();
  }
}

// Export singleton instance
export const sessionManager = SessionManager.getInstance();

// Session hooks for React components
export const useSession = () => {
  const session = sessionManager.getSession();
  
  return {
    session,
    isAuthenticated: sessionManager.isAuthenticated(),
    hasPermission: (permission: string) => sessionManager.hasPermission(permission),
    extendSession: (time?: number) => sessionManager.extendSession(time),
    logout: () => sessionManager.logout(),
    sessionInfo: sessionManager.getSessionInfo()
  };
};
