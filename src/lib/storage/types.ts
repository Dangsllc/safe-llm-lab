// Cloud storage abstraction types for multi-provider support

export interface CloudStorageConfig {
  provider: 'aws-s3' | 'azure-blob' | 'gcp-storage' | 'custom';
  region?: string;
  bucket: string;
  credentials: {
    accessKeyId?: string;
    secretAccessKey?: string;
    // Azure specific
    accountName?: string;
    accountKey?: string;
    // GCP specific
    projectId?: string;
    keyFilename?: string;
    // Custom endpoint
    endpoint?: string;
  };
}

export interface StorageAdapter {
  upload(key: string, data: unknown): Promise<string>;
  download(key: string): Promise<unknown>;
  delete(key: string): Promise<boolean>;
  list(prefix?: string): Promise<string[]>;
  exists(key: string): Promise<boolean>;
}

export interface Study {
  id: string;
  name: string;
  description: string;
  objectives: string[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  collaborators?: string[];
  metadata: {
    totalTests: number;
    totalPrompts: number;
    lastActivity: Date;
    status: 'planning' | 'active' | 'paused' | 'completed' | 'archived';
  };
}

export interface TestSession {
  id: string;
  studyId: string;
  modelName: string;
  promptTemplate: string;
  promptTemplateId?: number;
  prompt: string;
  response: string;
  classification: string;
  notes: string;
  timestamp: Date;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface PromptTemplate {
  id: number;
  title: string;
  content: string;
  riskLevel: string;
  variables: string[];
  category: string;
  shots?: number;
  createdAt: Date;
  updatedAt: Date;
  // Study relationship
  studyId: string;  // Original study where this prompt was created
  isShared: boolean; // Whether this prompt can be used in other studies
  usageCount: number; // How many times this prompt has been used
  // Cross-study tracking
  derivedFrom?: number; // If this prompt was copied from another, reference to original
  usedInStudies: string[]; // List of study IDs where this prompt has been used
}

export interface SafetyThresholds {
  highRisk: { warning: number; alert: number };
  mediumRisk: { warning: number; alert: number };
  lowRisk: { warning: number; alert: number };
}
