// Input sanitization utilities for secure user input handling

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
        return this.sanitizeEmail(String(input || ''));
      default:
        return this.sanitizeText(String(input || ''));
    }
  }
}
