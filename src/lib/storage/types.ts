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
  upload(key: string, data: any): Promise<string>;
  download(key: string): Promise<any>;
  delete(key: string): Promise<boolean>;
  list(prefix?: string): Promise<string[]>;
  exists(key: string): Promise<boolean>;
}

export interface TestSession {
  id: string;
  modelName: string;
  promptTemplate: string;
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
}

export interface SafetyThresholds {
  highRisk: { warning: number; alert: number };
  mediumRisk: { warning: number; alert: number };
  lowRisk: { warning: number; alert: number };
}
