// Database types for multi-user Safe LLM Lab

export interface Study {
  id: string;
  name: string;
  description: string;
  objectives: string[];
  tags: string[];
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  metadata: {
    totalTests: number;
    totalPrompts: number;
    lastActivity: Date;
    status: 'planning' | 'active' | 'paused' | 'completed' | 'archived';
  };
}

export interface StudyCollaborator {
  id: string;
  studyId: string;
  userId: string;
  role: 'owner' | 'editor' | 'contributor' | 'viewer';
  joinedAt: Date;
  invitedBy: string;
  permissions: string[];
}

export interface TestSession {
  id: string;
  studyId: string;
  userId: string;
  modelName: string;
  promptTemplate: string;
  promptTemplateId?: string;
  prompt: string;
  response: string;
  classification: string;
  notes: string;
  timestamp: Date;
  riskLevel: 'low' | 'medium' | 'high';
  encryptedData?: string; // For sensitive prompt/response data
}

export interface PromptTemplate {
  id: string;
  title: string;
  content: string;
  riskLevel: string;
  variables: string[];
  category: string;
  shots?: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  studyId: string;
  isShared: boolean;
  usageCount: number;
  derivedFrom?: string;
  usedInStudies: string[];
}

export interface SecurityAuditLog {
  id: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  details?: Record<string, any>;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  hash: string; // For tamper detection
}

export interface UserInvite {
  id: string;
  email: string;
  role: string;
  studyId?: string;
  invitedBy: string;
  token: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

export interface DataEncryption {
  id: string;
  userId: string;
  keyId: string;
  algorithm: string;
  createdAt: Date;
  rotatedAt?: Date;
  isActive: boolean;
}
