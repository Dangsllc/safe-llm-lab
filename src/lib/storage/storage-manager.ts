import { StorageAdapter, TestSession, PromptTemplate, SafetyThresholds, CloudStorageConfig } from './types';
import { SecureStorage } from '../security/encryption';

// Secure local storage adapter implementation
class LocalStorageAdapter implements StorageAdapter {
  private prefix: string;

  constructor(prefix: string = 'llm-safety-') {
    this.prefix = prefix;
  }

  async upload(key: string, data: any): Promise<string> {
    try {
      // Use secure encrypted storage for sensitive data
      const success = await SecureStorage.setItem(this.prefix + key, data);
      if (!success) {
        throw new Error('Encryption failed');
      }
      return key;
    } catch (error) {
      throw new Error(`Failed to store ${key}: ${error}`);
    }
  }

  async download(key: string): Promise<any> {
    try {
      // Try secure storage first
      const secureData = await SecureStorage.getItem(this.prefix + key);
      if (secureData !== null) {
        return secureData;
      }
      
      // Fallback to unencrypted data and migrate
      const item = localStorage.getItem(this.prefix + key);
      if (item) {
        const data = JSON.parse(item);
        // Migrate to secure storage
        await SecureStorage.migrateUnencryptedData(this.prefix + key);
        return data;
      }
      
      return null;
    } catch (error) {
      throw new Error(`Failed to retrieve ${key}: ${error}`);
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      SecureStorage.removeItem(this.prefix + key);
      // Also remove any legacy unencrypted data
      localStorage.removeItem(this.prefix + key);
      return true;
    } catch (error) {
      console.error(`Failed to delete ${key}:`, error);
      return false;
    }
  }

  async list(prefix?: string): Promise<string[]> {
    const keys: string[] = [];
    const searchPrefix = this.prefix + (prefix || '');
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(searchPrefix)) {
        keys.push(key.replace(this.prefix, ''));
      }
    }
    return keys;
  }

  async exists(key: string): Promise<boolean> {
    return localStorage.getItem(this.prefix + key) !== null;
  }
}

// Storage manager that can switch between local and cloud storage
export class StorageManager {
  private adapter: StorageAdapter;
  private config: CloudStorageConfig | null = null;

  constructor() {
    // Start with localStorage, can be upgraded to cloud later
    this.adapter = new LocalStorageAdapter();
  }

  async configureCloudStorage(config: CloudStorageConfig): Promise<void> {
    // TODO: Implement cloud adapters based on provider
    this.config = config;
    
    switch (config.provider) {
      case 'aws-s3':
        // this.adapter = new S3Adapter(config);
        console.log('AWS S3 adapter not yet implemented, using localStorage');
        break;
      case 'azure-blob':
        // this.adapter = new AzureBlobAdapter(config);
        console.log('Azure Blob adapter not yet implemented, using localStorage');
        break;
      case 'gcp-storage':
        // this.adapter = new GCPStorageAdapter(config);
        console.log('GCP Storage adapter not yet implemented, using localStorage');
        break;
      default:
        console.log('Using localStorage adapter');
    }
  }

  // Test Sessions
  async getTestSessions(studyId?: string): Promise<TestSession[]> {
    try {
      const rawSessions = await this.adapter.download('test-sessions');
      let sessions: TestSession[] = Array.isArray(rawSessions) ? rawSessions : [];
      
      // Migrate old sessions that don't have study information
      sessions = await this.migrateSessionsIfNeeded(sessions);
      
      // Filter by study if specified
      if (studyId) {
        sessions = sessions.filter((s: TestSession) => s.studyId === studyId);
      }
      
      return sessions;
    } catch (error) {
      console.error('Error loading test sessions:', error);
      return [];
    }
  }

  async saveTestSession(session: TestSession): Promise<boolean> {
    try {
      const sessions = await this.getTestSessions();
      const existingIndex = sessions.findIndex(s => s.id === session.id);
      
      if (existingIndex >= 0) {
        sessions[existingIndex] = session;
      } else {
        sessions.push(session);
      }
      
      await this.adapter.upload('test-sessions', sessions);
      return true;
    } catch (error) {
      console.error('Error saving test session:', error);
      return false;
    }
  }

  async deleteTestSession(sessionId: string): Promise<boolean> {
    try {
      const sessions = await this.getTestSessions();
      const filtered = sessions.filter(s => s.id !== sessionId);
      await this.adapter.upload('test-sessions', filtered);
      return true;
    } catch (error) {
      console.error('Error deleting test session:', error);
      return false;
    }
  }

  // Prompt Templates
  async getPromptTemplates(studyId?: string): Promise<PromptTemplate[]> {
    try {
      const rawTemplates = await this.adapter.download('prompt-templates');
      let templates: PromptTemplate[] = Array.isArray(rawTemplates) ? rawTemplates : [];
      
      // Migrate old templates that don't have study information
      templates = await this.migrateTemplatesIfNeeded(templates);
      
      // Filter by study if specified
      if (studyId) {
        templates = templates.filter((t: PromptTemplate) => t.studyId === studyId);
      }
      
      return templates;
    } catch (error) {
      console.error('Error loading prompt templates:', error);
      return [];
    }
  }

  async savePromptTemplate(template: PromptTemplate): Promise<boolean> {
    try {
      const templates = await this.getPromptTemplates();
      const existingIndex = templates.findIndex(t => t.id === template.id);
      
      if (existingIndex >= 0) {
        templates[existingIndex] = { ...template, updatedAt: new Date() };
      } else {
        templates.push({ ...template, createdAt: new Date(), updatedAt: new Date() });
      }
      
      await this.adapter.upload('prompt-templates', templates);
      return true;
    } catch (error) {
      console.error('Error saving prompt template:', error);
      return false;
    }
  }

  async deletePromptTemplate(templateId: number): Promise<boolean> {
    try {
      const templates = await this.getPromptTemplates();
      const filtered = templates.filter(t => t.id !== templateId);
      await this.adapter.upload('prompt-templates', filtered);
      return true;
    } catch (error) {
      console.error('Error deleting prompt template:', error);
      return false;
    }
  }

  // Safety Thresholds
  async getSafetyThresholds(): Promise<SafetyThresholds> {
    try {
      const rawThresholds = await this.adapter.download('safety-thresholds');
      const defaultThresholds: SafetyThresholds = {
        highRisk: { warning: 5, alert: 10 },
        mediumRisk: { warning: 40, alert: 70 },
        lowRisk: { warning: 80, alert: 90 }
      };
      
      return (rawThresholds && typeof rawThresholds === 'object') ? 
        { ...defaultThresholds, ...rawThresholds as SafetyThresholds } : 
        defaultThresholds;
    } catch (error) {
      console.error('Error loading safety thresholds:', error);
      return {
        highRisk: { warning: 5, alert: 10 },
        mediumRisk: { warning: 40, alert: 70 },
        lowRisk: { warning: 80, alert: 90 }
      };
    }
  }

  async saveSafetyThresholds(thresholds: SafetyThresholds): Promise<boolean> {
    try {
      await this.adapter.upload('safety-thresholds', thresholds);
      return true;
    } catch (error) {
      console.error('Error saving safety thresholds:', error);
      return false;
    }
  }

  // Export functionality
  async createBackup(): Promise<any> {
    try {
      const backup = {
        testSessions: await this.getTestSessions(),
        promptTemplates: await this.getPromptTemplates(),
        safetyThresholds: await this.getSafetyThresholds(),
        timestamp: new Date(),
        version: '1.0'
      };
      return backup;
    } catch (error) {
      console.error('Error creating backup:', error);
      throw error;
    }
  }

  async restoreFromBackup(backupData: any): Promise<boolean> {
    try {
      if (backupData.testSessions) {
        await this.adapter.upload('test-sessions', backupData.testSessions);
      }
      if (backupData.promptTemplates) {
        await this.adapter.upload('prompt-templates', backupData.promptTemplates);
      }
      if (backupData.safetyThresholds) {
        await this.adapter.upload('safety-thresholds', backupData.safetyThresholds);
      }
      return true;
    } catch (error) {
      console.error('Error restoring backup:', error);
      return false;
    }
  }

  // Migration helpers
  private async migrateSessionsIfNeeded(sessions: TestSession[]): Promise<TestSession[]> {
    const { studyManager } = await import('./study-manager');
    const needsMigration = sessions.some(s => !s.studyId);
    
    if (needsMigration) {
      // Ensure we have a default study
      const defaultStudy = await studyManager.ensureDefaultStudy();
      
      // Update sessions without studyId
      const migratedSessions = sessions.map(s => ({
        ...s,
        studyId: s.studyId || defaultStudy.id
      }));
      
      // Save migrated sessions
      await this.adapter.upload('test-sessions', migratedSessions);
      return migratedSessions;
    }
    
    return sessions;
  }

  private async migrateTemplatesIfNeeded(templates: PromptTemplate[]): Promise<PromptTemplate[]> {
    const { studyManager } = await import('./study-manager');
    const needsMigration = templates.some(t => !t.studyId);
    
    if (needsMigration) {
      // Ensure we have a default study
      const defaultStudy = await studyManager.ensureDefaultStudy();
      
      // Update templates without studyId
      const migratedTemplates = templates.map(t => ({
        ...t,
        studyId: t.studyId || defaultStudy.id,
        isShared: t.isShared ?? true,
        usageCount: t.usageCount ?? 0,
        usedInStudies: t.usedInStudies ?? [t.studyId || defaultStudy.id]
      }));
      
      // Save migrated templates
      await this.adapter.upload('prompt-templates', migratedTemplates);
      return migratedTemplates;
    }
    
    return templates;
  }
}

// Global storage manager instance
export const storageManager = new StorageManager();
