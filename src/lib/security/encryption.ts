// Secure encryption utilities for client-side data protection
// Uses Web Crypto API for strong encryption

export class SecureStorage {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12;
  private static readonly TAG_LENGTH = 16;
  
  private static async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: this.ALGORITHM,
        length: this.KEY_LENGTH,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      true,
      ['encrypt', 'decrypt']
    );
  }

  private static async encrypt(data: string, key: CryptoKey): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: this.ALGORITHM,
        iv: iv,
      },
      key,
      encoder.encode(data)
    );

    return { encrypted, iv };
  }

  private static async decrypt(encryptedData: ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<string> {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: this.ALGORITHM,
        iv: iv,
      },
      key,
      encryptedData
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  // Generate a session-based encryption key
  private static getSessionKey(): string {
    const sessionKey = sessionStorage.getItem('secure-session-key');
    if (sessionKey) {
      return sessionKey;
    }
    
    // Generate new session key
    const newKey = crypto.getRandomValues(new Uint8Array(32));
    const keyString = Array.from(newKey, byte => byte.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem('secure-session-key', keyString);
    return keyString;
  }

  // Secure localStorage wrapper
  static async setItem(key: string, value: any): Promise<boolean> {
    try {
      const jsonString = JSON.stringify(value);
      const sessionKey = this.getSessionKey();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      
      const cryptoKey = await this.deriveKey(sessionKey, salt);
      const { encrypted, iv } = await this.encrypt(jsonString, cryptoKey);
      
      // Store encrypted data with metadata
      const encryptedPackage = {
        data: Array.from(new Uint8Array(encrypted)),
        iv: Array.from(iv),
        salt: Array.from(salt),
        version: '1.0'
      };
      
      localStorage.setItem(`secure_${key}`, JSON.stringify(encryptedPackage));
      return true;
    } catch (error) {
      console.error('Encryption failed:', error);
      return false;
    }
  }

  static async getItem<T>(key: string): Promise<T | null> {
    try {
      const encryptedData = localStorage.getItem(`secure_${key}`);
      if (!encryptedData) {
        return null;
      }

      const encryptedPackage = JSON.parse(encryptedData);
      const sessionKey = this.getSessionKey();
      
      const cryptoKey = await this.deriveKey(
        sessionKey, 
        new Uint8Array(encryptedPackage.salt)
      );
      
      const decrypted = await this.decrypt(
        new Uint8Array(encryptedPackage.data).buffer,
        cryptoKey,
        new Uint8Array(encryptedPackage.iv)
      );
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      return null;
    }
  }

  static removeItem(key: string): void {
    localStorage.removeItem(`secure_${key}`);
  }

  static clear(): void {
    // Clear only secure items
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('secure_')) {
        localStorage.removeItem(key);
      }
    });
    sessionStorage.removeItem('secure-session-key');
  }

  // Migrate existing unencrypted data
  static async migrateUnencryptedData(key: string): Promise<boolean> {
    try {
      const unencryptedData = localStorage.getItem(key);
      if (unencryptedData) {
        const data = JSON.parse(unencryptedData);
        await this.setItem(key, data);
        localStorage.removeItem(key); // Remove unencrypted version
        return true;
      }
      return false;
    } catch (error) {
      console.error('Migration failed:', error);
      return false;
    }
  }
}

// Input sanitization utilities
export class InputSanitizer {
  // Sanitize text input to prevent XSS
  static sanitizeText(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }
    
    return input
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim()
      .slice(0, 10000); // Limit length
  }

  // Sanitize prompt content for research purposes
  static sanitizePrompt(prompt: string): string {
    if (typeof prompt !== 'string') {
      return '';
    }
    
    // Allow research content but prevent code injection
    return prompt
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[SCRIPT_REMOVED]')
      .replace(/javascript:/gi, '[JS_REMOVED]')
      .trim()
      .slice(0, 50000); // Larger limit for research prompts
  }

  // Validate and sanitize user input
  static validateInput(input: any, type: 'text' | 'prompt' | 'number' | 'email'): any {
    switch (type) {
      case 'text':
        return this.sanitizeText(String(input || ''));
      case 'prompt':
        return this.sanitizePrompt(String(input || ''));
      case 'number':
        const num = Number(input);
        return isNaN(num) ? 0 : Math.max(0, Math.min(1000000, num));
      case 'email':
        const email = String(input || '').toLowerCase().trim();
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
      default:
        return this.sanitizeText(String(input || ''));
    }
  }
}
