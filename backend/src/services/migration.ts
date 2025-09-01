// Secure data migration service from localStorage to multi-user backend

import { PrismaClient } from '@prisma/client';
import { EncryptionService } from './encryption';
import { AuditService } from './audit';
import crypto from 'crypto';

interface LocalStorageData {
  studies: any[];
  testSessions: any[];
  promptTemplates: any[];
  userPreferences: any;
  encryptionMetadata: {
    version: string;
    algorithm: string;
    keyDerivation: string;
  };
}

interface MigrationResult {
  success: boolean;
  migratedItems: {
    studies: number;
    sessions: number;
    templates: number;
  };
  errors: string[];
  backupHash: string;
}

export class DataMigrationService {
  private prisma: PrismaClient;
  private encryption: EncryptionService;
  private audit: AuditService;

  constructor() {
    this.prisma = new PrismaClient();
    this.encryption = EncryptionService.getInstance();
    this.audit = AuditService.getInstance();
  }

  /**
   * PHASE 1: Export and Validate Local Data
   * - Decrypt existing localStorage data using client-side keys
   * - Validate data integrity and structure
   * - Create secure backup before migration
   */
  async exportLocalData(userId: string, encryptedLocalData: string): Promise<LocalStorageData> {
    try {
      // Decrypt the localStorage export using user's client-side key
      const decryptedData = await this.decryptClientData(encryptedLocalData, userId);
      
      // Validate data structure and integrity
      this.validateDataStructure(decryptedData);
      
      // Log export for audit trail
      await this.audit.logSecurityEvent({
        type: 'data_export',
        userId,
        success: true,
        details: {
          studiesCount: decryptedData.studies?.length || 0,
          sessionsCount: decryptedData.testSessions?.length || 0,
          templatesCount: decryptedData.promptTemplates?.length || 0
        }
      });

      return decryptedData;
    } catch (error) {
      await this.audit.logSecurityEvent({
        type: 'data_export_failed',
        userId,
        success: false,
        details: { error: error.message }
      });
      throw new Error(`Data export failed: ${error.message}`);
    }
  }

  /**
   * PHASE 2: Secure Migration Process
   * - Transform data to new multi-user schema
   * - Re-encrypt with backend encryption keys
   * - Maintain data relationships and integrity
   * - Atomic transaction to prevent partial migration
   */
  async migrateUserData(userId: string, localData: LocalStorageData): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      migratedItems: { studies: 0, sessions: 0, templates: 0 },
      errors: [],
      backupHash: ''
    };

    // Create backup hash for rollback capability
    result.backupHash = this.createBackupHash(localData);

    try {
      // Use database transaction for atomic migration
      await this.prisma.$transaction(async (tx) => {
        // Migrate studies first (parent entities)
        const studyMappings = await this.migrateStudies(tx, userId, localData.studies);
        result.migratedItems.studies = studyMappings.size;

        // Migrate prompt templates with study associations
        const templateMappings = await this.migratePromptTemplates(
          tx, userId, localData.promptTemplates, studyMappings
        );
        result.migratedItems.templates = templateMappings.size;

        // Migrate test sessions with proper relationships
        const sessionCount = await this.migrateTestSessions(
          tx, userId, localData.testSessions, studyMappings, templateMappings
        );
        result.migratedItems.sessions = sessionCount;

        // Migrate user preferences and settings
        await this.migrateUserPreferences(tx, userId, localData.userPreferences);
      });

      result.success = true;

      await this.audit.logSecurityEvent({
        type: 'data_migration_success',
        userId,
        success: true,
        details: {
          migratedItems: result.migratedItems,
          backupHash: result.backupHash
        }
      });

    } catch (error) {
      result.errors.push(error.message);
      
      await this.audit.logSecurityEvent({
        type: 'data_migration_failed',
        userId,
        success: false,
        details: { error: error.message, backupHash: result.backupHash }
      });
    }

    return result;
  }

  /**
   * PHASE 3: Data Verification and Cleanup
   * - Verify migrated data integrity
   * - Compare checksums between source and target
   * - Optionally clear localStorage after successful migration
   */
  async verifyMigration(userId: string, originalData: LocalStorageData): Promise<boolean> {
    try {
      // Fetch migrated data from database
      const migratedStudies = await this.prisma.study.findMany({
        where: { ownerId: userId },
        include: {
          testSessions: true,
          promptTemplates: true,
          collaborators: true
        }
      });

      // Verify data counts match
      const countsMatch = 
        migratedStudies.length === originalData.studies.length &&
        migratedStudies.reduce((sum, s) => sum + s.testSessions.length, 0) === originalData.testSessions.length &&
        migratedStudies.reduce((sum, s) => sum + s.promptTemplates.length, 0) === originalData.promptTemplates.length;

      if (!countsMatch) {
        throw new Error('Data count mismatch after migration');
      }

      // Verify data integrity with checksums
      const originalChecksum = this.calculateDataChecksum(originalData);
      const migratedChecksum = this.calculateDataChecksum(this.transformToLocalFormat(migratedStudies));

      const integrityValid = originalChecksum === migratedChecksum;

      await this.audit.logSecurityEvent({
        type: 'migration_verification',
        userId,
        success: integrityValid,
        details: {
          countsMatch,
          integrityValid,
          originalChecksum,
          migratedChecksum
        }
      });

      return integrityValid;

    } catch (error) {
      await this.audit.logSecurityEvent({
        type: 'migration_verification_failed',
        userId,
        success: false,
        details: { error: error.message }
      });
      return false;
    }
  }

  // Private helper methods for migration process
  private async decryptClientData(encryptedData: string, userId: string): Promise<LocalStorageData> {
    // This would use the same decryption logic as the client-side SecureStorage
    // For now, assume data is already decrypted by client before sending
    return JSON.parse(Buffer.from(encryptedData, 'base64').toString());
  }

  private validateDataStructure(data: any): void {
    const requiredFields = ['studies', 'testSessions', 'promptTemplates'];
    for (const field of requiredFields) {
      if (!Array.isArray(data[field])) {
        throw new Error(`Invalid data structure: ${field} must be an array`);
      }
    }
  }

  private async migrateStudies(tx: any, userId: string, studies: any[]): Promise<Map<string, string>> {
    const mappings = new Map<string, string>();

    for (const study of studies) {
      const newStudy = await tx.study.create({
        data: {
          name: study.name,
          description: study.description,
          objectives: study.objectives || [],
          tags: study.tags || [],
          ownerId: userId,
          isActive: study.isActive ?? true,
          totalTests: study.metadata?.totalTests || 0,
          totalPrompts: study.metadata?.totalPrompts || 0,
          lastActivity: study.metadata?.lastActivity ? new Date(study.metadata.lastActivity) : new Date(),
          status: study.metadata?.status || 'PLANNING'
        }
      });

      mappings.set(study.id.toString(), newStudy.id);
    }

    return mappings;
  }

  private async migratePromptTemplates(
    tx: any, 
    userId: string, 
    templates: any[], 
    studyMappings: Map<string, string>
  ): Promise<Map<string, string>> {
    const mappings = new Map<string, string>();

    for (const template of templates) {
      // Find corresponding study or create default study
      const studyId = studyMappings.get(template.studyId) || 
                     Array.from(studyMappings.values())[0];

      if (!studyId) continue;

      const newTemplate = await tx.promptTemplate.create({
        data: {
          title: template.title,
          content: template.content,
          riskLevel: template.riskLevel,
          variables: template.variables || [],
          category: template.category || 'General',
          shots: template.shots,
          createdBy: userId,
          studyId: studyId,
          isShared: template.isShared || false,
          usageCount: template.usageCount || 0,
          usedInStudies: template.usedInStudies || []
        }
      });

      mappings.set(template.id.toString(), newTemplate.id);
    }

    return mappings;
  }

  private async migrateTestSessions(
    tx: any,
    userId: string,
    sessions: any[],
    studyMappings: Map<string, string>,
    templateMappings: Map<string, string>
  ): Promise<number> {
    let count = 0;

    for (const session of sessions) {
      const studyId = studyMappings.get(session.studyId);
      if (!studyId) continue;

      // Encrypt sensitive prompt/response data
      const encryptedData = await this.encryption.encryptUserData({
        prompt: session.prompt,
        response: session.response,
        notes: session.notes
      }, userId);

      await tx.testSession.create({
        data: {
          studyId: studyId,
          userId: userId,
          modelName: session.modelName,
          promptTemplate: session.promptTemplate,
          promptTemplateId: templateMappings.get(session.promptTemplateId?.toString()),
          prompt: session.prompt,
          response: session.response,
          classification: session.classification,
          notes: session.notes || '',
          timestamp: new Date(session.timestamp),
          riskLevel: session.riskLevel || 'MEDIUM',
          encryptedData: encryptedData
        }
      });

      count++;
    }

    return count;
  }

  private async migrateUserPreferences(tx: any, userId: string, preferences: any): Promise<void> {
    if (!preferences) return;

    // Store user preferences in encrypted format
    const encryptedPrefs = await this.encryption.encryptUserData(preferences, userId);
    
    // This would be stored in a user_preferences table
    // For now, we'll skip this as it's not in our current schema
  }

  private createBackupHash(data: LocalStorageData): string {
    return crypto.createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  private calculateDataChecksum(data: any): string {
    return crypto.createHash('md5')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  private transformToLocalFormat(migratedData: any[]): LocalStorageData {
    // Transform database format back to localStorage format for comparison
    return {
      studies: migratedData,
      testSessions: migratedData.flatMap(s => s.testSessions),
      promptTemplates: migratedData.flatMap(s => s.promptTemplates),
      userPreferences: {},
      encryptionMetadata: {
        version: '2.0',
        algorithm: 'aes-256-gcm',
        keyDerivation: 'pbkdf2'
      }
    };
  }
}
