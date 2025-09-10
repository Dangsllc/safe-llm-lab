// Express type extensions for authentication and session management

import { User, UserRole, Permission } from './auth';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    csrfToken?: string;
    userRole?: UserRole;
    permissions?: Permission[];
    // Add any other session properties you're using
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
      // Add any custom request properties you're using
    }
  }
}
