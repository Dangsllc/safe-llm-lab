import { PrismaClient } from '@prisma/client';

// Extend the Prisma client with custom methods and computed fields
const prisma = new PrismaClient().$extends({
  model: {
    user: {
      // Add computed permissions field
      async getPermissions(userId: string) {
        const userWithRoles = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            collaborations: {
              select: {
                studyId: true,
                role: true,
                permissions: true
              }
            }
          }
        });

        if (!userWithRoles) return [];

        // Map database roles to application permissions
        const basePermissions = [
          {
            resource: 'profile' as const,
            actions: ['read'] as const,
          },
        ];

        // Add study-specific permissions
        const studyPermissions = userWithRoles.collaborations.map(collab => ({
          resource: 'studies' as const,
          actions: this.getActionsForRole(collab.role),
          conditions: {
            studyId: collab.studyId
          }
        }));

        return [...basePermissions, ...studyPermissions];
      },

      // Helper to map roles to actions
      getActionsForRole(role: string) {
        const roleActions: Record<string, Array<'create' | 'read' | 'update' | 'delete' | 'share' | 'admin'>> = {
          owner: ['create', 'read', 'update', 'delete', 'share', 'admin'],
          editor: ['create', 'read', 'update', 'share'],
          contributor: ['create', 'read'],
          viewer: ['read']
        };
        
        return roleActions[role] || ['read'];
      }
    }
  },
  
  // Add type safety for the extended client
  result: {
    user: {
      permissions: {
        needs: { id: true },
        compute(_user) {
          // This will be computed when accessed
          return [];
        },
      },
    },
  },
});

export type ExtendedPrismaClient = typeof prisma;

declare global {
  // eslint-disable-next-line no-var
  var prisma: ExtendedPrismaClient | undefined;
}

// Prevent multiple instances of Prisma Client in development
export const db = global.prisma || prisma;

if (process.env['NODE_ENV'] !== 'production') {
  global.prisma = db;
}

export default db;
