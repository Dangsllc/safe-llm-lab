// Secure WebSocket service for real-time collaboration

import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { EncryptionService } from './encryption';
import { AuditService } from './audit';
import { SecurityConfig } from '../config/security';

interface AuthenticatedWebSocket extends WebSocket {
  userId: string;
  sessionId: string;
  studyAccess: string[];
  encryptionKey: Buffer;
  lastActivity: Date;
}

interface SecureMessage {
  id: string;
  type: 'study_update' | 'session_created' | 'user_joined' | 'user_left' | 'template_shared';
  studyId: string;
  userId: string;
  encryptedPayload: string;
  signature: string;
  timestamp: Date;
  permissions: string[];
}

interface CollaborationEvent {
  type: string;
  studyId: string;
  userId: string;
  data: any;
  timestamp: Date;
}

export class SecureWebSocketService {
  private wss: WebSocketServer;
  private prisma: PrismaClient;
  private encryption: EncryptionService;
  private audit: AuditService;
  private connectedClients: Map<string, AuthenticatedWebSocket>;
  private studyRooms: Map<string, Set<string>>; // studyId -> Set of userIds

  constructor(server: any) {
    this.prisma = new PrismaClient();
    this.encryption = EncryptionService.getInstance();
    this.audit = AuditService.getInstance();
    this.connectedClients = new Map();
    this.studyRooms = new Map();

    // Initialize WebSocket server with security options
    this.wss = new WebSocketServer({
      server,
      verifyClient: this.verifyClient.bind(this),
      perMessageDeflate: false, // Disable compression for security
      maxPayload: 1024 * 1024, // 1MB max message size
    });

    this.setupWebSocketHandlers();
    this.startHeartbeat();
  }

  /**
   * AUTHENTICATION PHASE
   * - Verify JWT token from connection request
   * - Validate user permissions and active session
   * - Establish secure connection with user-specific encryption
   */
  private async verifyClient(info: any): Promise<boolean> {
    try {
      const url = new URL(info.req.url, 'ws://localhost');
      const token = url.searchParams.get('token');

      if (!token) {
        await this.audit.logSecurityEvent({
          type: 'websocket_auth_failed',
          ipAddress: info.req.socket.remoteAddress,
          success: false,
          details: { reason: 'no_token' }
        });
        return false;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, SecurityConfig.jwt.accessTokenSecret) as any;
      
      // Verify session is active
      const session = await this.prisma.session.findFirst({
        where: {
          accessToken: token,
          isActive: true,
          expiresAt: { gt: new Date() }
        },
        include: { user: true }
      });

      if (!session || !session.user.isActive) {
        await this.audit.logSecurityEvent({
          type: 'websocket_auth_failed',
          userId: decoded.sub,
          ipAddress: info.req.socket.remoteAddress,
          success: false,
          details: { reason: 'invalid_session' }
        });
        return false;
      }

      // Store authentication info for connection setup
      info.req.userId = session.user.id;
      info.req.sessionId = session.id;
      
      return true;
    } catch (error) {
      await this.audit.logSecurityEvent({
        type: 'websocket_auth_failed',
        ipAddress: info.req?.socket?.remoteAddress,
        success: false,
        details: { error: error.message }
      });
      return false;
    }
  }

  /**
   * CONNECTION SETUP
   * - Generate user-specific encryption keys for messages
   * - Subscribe user to authorized study rooms
   * - Set up message handlers and security monitoring
   */
  private setupWebSocketHandlers(): void {
    this.wss.on('connection', async (ws: WebSocket, req: any) => {
      try {
        const authenticatedWs = ws as AuthenticatedWebSocket;
        authenticatedWs.userId = req.userId;
        authenticatedWs.sessionId = req.sessionId;
        authenticatedWs.encryptionKey = this.encryption.generateUserKey(req.userId);
        authenticatedWs.lastActivity = new Date();

        // Get user's study access permissions
        const studyAccess = await this.getUserStudyAccess(req.userId);
        authenticatedWs.studyAccess = studyAccess;

        // Register client
        this.connectedClients.set(req.userId, authenticatedWs);

        // Subscribe to study rooms
        for (const studyId of studyAccess) {
          this.subscribeToStudy(req.userId, studyId);
        }

        // Set up message handlers
        authenticatedWs.on('message', (data) => this.handleMessage(authenticatedWs, data as Buffer));
        authenticatedWs.on('close', () => this.handleDisconnection(authenticatedWs));
        authenticatedWs.on('error', (error) => this.handleError(authenticatedWs, error));

        // Send connection confirmation
        await this.sendSecureMessage(authenticatedWs, {
          type: 'connection_established',
          studyId: '',
          userId: req.userId,
          data: { studyAccess },
          timestamp: new Date()
        });

        await this.audit.logSecurityEvent({
          type: 'websocket_connected',
          userId: req.userId,
          success: true,
          details: { studyAccess: studyAccess.length }
        });

      } catch (error) {
        ws.close(1011, 'Connection setup failed');
        await this.audit.logSecurityEvent({
          type: 'websocket_setup_failed',
          userId: req.userId,
          success: false,
          details: { error: error.message }
        });
      }
    });
  }

  /**
   * MESSAGE ENCRYPTION & ROUTING
   * - Decrypt incoming messages with user's key
   * - Validate message permissions and study access
   * - Route messages to authorized study participants
   * - Encrypt outgoing messages per recipient
   */
  private async handleMessage(ws: AuthenticatedWebSocket, data: Buffer): Promise<void> {
    try {
      ws.lastActivity = new Date();

      // Decrypt message
      const decryptedMessage = await this.decryptMessage(data, ws.encryptionKey);
      const message = JSON.parse(decryptedMessage) as CollaborationEvent;

      // Validate message structure and permissions
      if (!this.validateMessage(message, ws)) {
        await this.audit.logSecurityEvent({
          type: 'websocket_invalid_message',
          userId: ws.userId,
          success: false,
          details: { messageType: message.type, studyId: message.studyId }
        });
        return;
      }

      // Process message based on type
      await this.processCollaborationEvent(message, ws);

      // Broadcast to study participants
      await this.broadcastToStudy(message.studyId, message, ws.userId);

      await this.audit.logSecurityEvent({
        type: 'websocket_message_processed',
        userId: ws.userId,
        success: true,
        details: { 
          messageType: message.type, 
          studyId: message.studyId,
          participantCount: this.getStudyParticipantCount(message.studyId)
        }
      });

    } catch (error) {
      await this.audit.logSecurityEvent({
        type: 'websocket_message_failed',
        userId: ws.userId,
        success: false,
        details: { error: error.message }
      });
    }
  }

  /**
   * REAL-TIME COLLABORATION EVENTS
   * - Study updates (name, description, settings changes)
   * - Test session creation and results
   * - Prompt template sharing and modifications
   * - User presence (join/leave notifications)
   */
  private async processCollaborationEvent(event: CollaborationEvent, ws: AuthenticatedWebSocket): Promise<void> {
    switch (event.type) {
      case 'study_update':
        await this.handleStudyUpdate(event, ws);
        break;
      
      case 'session_created':
        await this.handleSessionCreated(event, ws);
        break;
      
      case 'template_shared':
        await this.handleTemplateShared(event, ws);
        break;
      
      case 'user_presence':
        await this.handleUserPresence(event, ws);
        break;
      
      default:
        throw new Error(`Unknown event type: ${event.type}`);
    }
  }

  private async handleStudyUpdate(event: CollaborationEvent, ws: AuthenticatedWebSocket): Promise<void> {
    // Verify user has edit permissions for the study
    const hasPermission = await this.verifyStudyPermission(ws.userId, event.studyId, 'update');
    if (!hasPermission) {
      throw new Error('Insufficient permissions for study update');
    }

    // Update study in database
    await this.prisma.study.update({
      where: { id: event.studyId },
      data: {
        ...event.data,
        updatedAt: new Date()
      }
    });
  }

  private async handleSessionCreated(event: CollaborationEvent, ws: AuthenticatedWebSocket): Promise<void> {
    // Verify user has contribute permissions
    const hasPermission = await this.verifyStudyPermission(ws.userId, event.studyId, 'contribute');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to create sessions');
    }

    // Session creation is handled by REST API, this just broadcasts the event
  }

  private async handleTemplateShared(event: CollaborationEvent, ws: AuthenticatedWebSocket): Promise<void> {
    // Update template sharing status
    await this.prisma.promptTemplate.update({
      where: { id: event.data.templateId },
      data: {
        isShared: true,
        usedInStudies: {
          push: event.studyId
        }
      }
    });
  }

  private async handleUserPresence(event: CollaborationEvent, ws: AuthenticatedWebSocket): Promise<void> {
    // Update user presence in study room
    const room = this.studyRooms.get(event.studyId);
    if (room) {
      if (event.data.status === 'joined') {
        room.add(ws.userId);
      } else if (event.data.status === 'left') {
        room.delete(ws.userId);
      }
    }
  }

  /**
   * SECURITY UTILITIES
   */
  private async encryptMessage(message: string, key: Buffer): Promise<Buffer> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv) as crypto.CipherGCM;
    cipher.setAAD(Buffer.from('websocket-message'));
    
    let encrypted = cipher.update(message, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return Buffer.from(JSON.stringify({
      iv: iv.toString('hex'),
      encrypted,
      authTag: authTag.toString('hex')
    }));
  }

  private async decryptMessage(encryptedData: Buffer, key: Buffer): Promise<string> {
    const data = JSON.parse(encryptedData.toString());
    
    const iv = Buffer.from(data.iv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv) as crypto.DecipherGCM;
    decipher.setAAD(Buffer.from('websocket-message'));
    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
    
    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private validateMessage(message: CollaborationEvent, ws: AuthenticatedWebSocket): boolean {
    return (
      message.userId === ws.userId &&
      ws.studyAccess.includes(message.studyId) &&
      message.timestamp &&
      new Date(message.timestamp).getTime() > Date.now() - 60000 // Message not older than 1 minute
    );
  }

  private async getUserStudyAccess(userId: string): Promise<string[]> {
    const studies = await this.prisma.study.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { collaborators: { some: { userId } } }
        ]
      },
      select: { id: true }
    });

    return studies.map(s => s.id);
  }

  private async verifyStudyPermission(userId: string, studyId: string, action: string): Promise<boolean> {
    const study = await this.prisma.study.findFirst({
      where: { id: studyId },
      include: {
        collaborators: {
          where: { userId }
        }
      }
    });

    if (!study) return false;
    if (study.ownerId === userId) return true;

    const collaboration = study.collaborators[0];
    if (!collaboration) return false;

    // Check role-based permissions
    const permissions = {
      'EDITOR': ['read', 'update', 'contribute'],
      'CONTRIBUTOR': ['read', 'contribute'],
      'VIEWER': ['read']
    };

    return permissions[collaboration.role]?.includes(action) || false;
  }

  private subscribeToStudy(userId: string, studyId: string): void {
    if (!this.studyRooms.has(studyId)) {
      this.studyRooms.set(studyId, new Set());
    }
    this.studyRooms.get(studyId)!.add(userId);
  }

  private async broadcastToStudy(studyId: string, event: CollaborationEvent, senderId: string): Promise<void> {
    const participants = this.studyRooms.get(studyId);
    if (!participants) return;

    for (const userId of participants) {
      if (userId !== senderId) {
        const ws = this.connectedClients.get(userId);
        if (ws && ws.readyState === WebSocket.OPEN) {
          await this.sendSecureMessage(ws, event);
        }
      }
    }
  }

  private async sendSecureMessage(ws: AuthenticatedWebSocket, event: CollaborationEvent): Promise<void> {
    const message = JSON.stringify(event);
    const encryptedMessage = await this.encryptMessage(message, ws.encryptionKey);
    ws.send(encryptedMessage);
  }

  private getStudyParticipantCount(studyId: string): number {
    return this.studyRooms.get(studyId)?.size || 0;
  }

  private handleDisconnection(ws: AuthenticatedWebSocket): void {
    this.connectedClients.delete(ws.userId);
    
    // Remove from all study rooms
    for (const [studyId, participants] of this.studyRooms) {
      participants.delete(ws.userId);
    }

    this.audit.logSecurityEvent({
      type: 'websocket_disconnected',
      userId: ws.userId,
      success: true
    });
  }

  private handleError(ws: AuthenticatedWebSocket, error: Error): void {
    this.audit.logSecurityEvent({
      type: 'websocket_error',
      userId: ws.userId,
      success: false,
      details: { error: error.message }
    });
  }

  private startHeartbeat(): void {
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        const authWs = ws as AuthenticatedWebSocket;
        if (authWs.lastActivity && Date.now() - authWs.lastActivity.getTime() > 300000) {
          // Close inactive connections (5 minutes)
          authWs.terminate();
        }
      });
    }, 60000); // Check every minute
  }
}
