// Input sanitization utilities for secure user input handling
import DOMPurify from 'dompurify';

export class InputSanitizer {
  // Sanitize text input to prevent XSS using DOMPurify
  static sanitizeText(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }
    
    // Use DOMPurify for comprehensive XSS protection
    const cleaned = DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [], // No HTML tags allowed in text
      ALLOWED_ATTR: [],
      ALLOW_DATA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false,
      RETURN_DOM_FRAGMENT: false,
      RETURN_DOM: false,
      RETURN_TRUSTED_TYPE: false
    });
    
    return cleaned.trim().slice(0, 10000); // Limit length
  }

  // Sanitize general input
  static sanitizeInput(input: string): string {
    return this.sanitizeText(input);
  }

  // Sanitize email input
  static sanitizeEmail(email: string): string {
    if (typeof email !== 'string') {
      return '';
    }
    
    const sanitized = email.toLowerCase().trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized) ? sanitized : '';
  }

  // Sanitize prompt content for research purposes
  static sanitizePrompt(prompt: string): string {
    if (typeof prompt !== 'string') {
      return '';
    }
    
    // Allow some HTML for formatting but prevent dangerous content
    const cleaned = DOMPurify.sanitize(prompt, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: [],
      ALLOW_DATA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false,
      FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form', 'input'],
      FORBID_ATTR: ['onclick', 'onerror', 'onload', 'style', 'src', 'href']
    });
    
    return cleaned.trim().slice(0, 50000); // Larger limit for research prompts
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
        return this.sanitizeEmail(String(input || ''));
      default:
        return this.sanitizeText(String(input || ''));
    }
  }
}
