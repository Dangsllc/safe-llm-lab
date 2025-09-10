// Advanced encryption service for multi-user data protection

import crypto from 'crypto';
import { SecurityConfig } from '../config/security';

export class EncryptionService {
  private static instance: EncryptionService;
  private masterKey: Buffer;

  private constructor() {
    this.masterKey = this.deriveMasterKey();
  }

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  private deriveMasterKey(): Buffer {
    const secret = process.env.ENCRYPTION_MASTER_KEY || 'default-key-for-development';
    const salt = process.env.ENCRYPTION_SALT || 'default-salt';
    
    return crypto.pbkdf2Sync(
      secret,
      salt,
      SecurityConfig.encryption.iterations,
      SecurityConfig.encryption.keyLength,
      'sha256'
    );
  }

  // Generate user-specific encryption key
  generateUserKey(userId: string): Buffer {
    const userSalt = crypto.createHash('sha256').update(userId).digest();
    return crypto.pbkdf2Sync(
      this.masterKey,
      userSalt,
      SecurityConfig.encryption.iterations,
      SecurityConfig.encryption.keyLength,
      'sha256'
    );
  }

  // Encrypt sensitive data with user-specific key
  async encryptUserData(data: any, userId: string): Promise<string> {
    try {
      const userKey = this.generateUserKey(userId);
      const iv = crypto.randomBytes(SecurityConfig.encryption.ivLength);
      const cipher = crypto.createCipheriv(SecurityConfig.encryption.algorithm, userKey, iv) as crypto.CipherGCM;
      cipher.setAAD(Buffer.from(userId)); // Additional authenticated data
      
      const plaintext = JSON.stringify(data);
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Combine IV, auth tag, and encrypted data
      const result = {
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        encrypted: encrypted
      };
      
      return Buffer.from(JSON.stringify(result)).toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  // Decrypt user data
  async decryptUserData(encryptedData: string, userId: string): Promise<any> {
    try {
      const userKey = this.generateUserKey(userId);
      const data = JSON.parse(Buffer.from(encryptedData, 'base64').toString());
      
      const iv = Buffer.from(data.iv, 'hex');
      const decipher = crypto.createDecipheriv(
        SecurityConfig.encryption.algorithm,
        userKey,
        iv
      ) as crypto.DecipherGCM;
      
      decipher.setAAD(Buffer.from(userId));
      decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
      
      let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  // Encrypt field-level data (for database storage)
  encryptField(value: string, key?: Buffer): string {
    const encryptionKey = key || this.masterKey;
    const iv = crypto.randomBytes(SecurityConfig.encryption.ivLength);
    const cipher = crypto.createCipheriv(SecurityConfig.encryption.algorithm, encryptionKey, iv) as crypto.CipherGCM;
    
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  // Decrypt field-level data
  decryptField(encryptedValue: string, key?: Buffer): string {
    const encryptionKey = key || this.masterKey;
    const [ivHex, authTagHex, encrypted] = encryptedValue.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(SecurityConfig.encryption.algorithm, encryptionKey, iv) as crypto.DecipherGCM;
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Hash sensitive data for searching (one-way)
  hashForSearch(value: string, salt?: string): string {
    const searchSalt = salt || 'search-salt';
    return crypto.createHmac('sha256', this.masterKey)
      .update(value + searchSalt)
      .digest('hex');
  }

  // Generate secure random tokens
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Generate backup codes for MFA
  generateBackupCodes(count: number = 10): string[] {
    return Array.from({ length: count }, () => 
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );
  }

  // Key rotation utilities
  async rotateUserKey(userId: string, oldData: any): Promise<any> {
    // Decrypt with old key, encrypt with new key
    const decrypted = await this.decryptUserData(oldData, userId);
    return await this.encryptUserData(decrypted, userId);
  }

  // Secure key derivation for API keys
  deriveAPIKey(userId: string, purpose: string): string {
    const input = `${userId}:${purpose}:${Date.now()}`;
    return crypto.createHmac('sha256', this.masterKey)
      .update(input)
      .digest('hex');
  }

  // Verify data integrity
  verifyIntegrity(data: string, expectedHash: string): boolean {
    const actualHash = crypto.createHash('sha256').update(data).digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(expectedHash, 'hex'),
      Buffer.from(actualHash, 'hex')
    );
  }

  // Secure comparison to prevent timing attacks
  secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}
