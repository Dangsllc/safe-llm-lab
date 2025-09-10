// Enhanced database client with Row-Level Security support
import { PrismaClient } from '@prisma/client';

// Extended Prisma client with RLS context management
class EnhancedPrismaClient extends PrismaClient {
  constructor() {
    super({
      log: ['warn', 'error']
    });
  }

  // Set user context for RLS policies
  async setUserContext(userId: string, userRole: string): Promise<void> {
    await this.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
    await this.$executeRaw`SELECT set_config('app.current_user_role', ${userRole}, true)`;
  }

  // Clear user context
  async clearUserContext(): Promise<void> {
    await this.$executeRaw`SELECT set_config('app.current_user_id', '', true)`;
    await this.$executeRaw`SELECT set_config('app.current_user_role', '', true)`;
  }

  // Create a user-scoped client for request handling
  forUser(userId: string, userRole: string): PrismaTransactionClient {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_user_role', ${userRole}, true)`;
      return tx;
    });
  }
}

// Type for transaction client
type PrismaTransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

// Export singleton instance
export const prisma = new EnhancedPrismaClient();

// Helper function to execute queries with user context
export async function withUserContext<T>(
  userId: string, 
  userRole: string, 
  callback: (prisma: PrismaTransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_user_role', ${userRole}, true)`;
    return callback(tx);
  });
}

// Middleware to automatically set user context from Express request
export function createUserContextMiddleware() {
  return async (req: any, res: any, next: any) => {
    if (req.user) {
      // Attach user-scoped prisma client to request
      req.prisma = await withUserContext(req.user.id, req.user.role, (tx) => Promise.resolve(tx));
    }
    next();
  };
}