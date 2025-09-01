// Secure logging utility to prevent sensitive data leakage
// Sanitizes all log output and provides structured logging

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: string;
  sanitized: boolean;
}

export class SecureLogger {
  private static instance: SecureLogger;
  private logLevel: LogLevel = LogLevel.INFO;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;

  // Sensitive patterns to remove from logs
  private static readonly SENSITIVE_PATTERNS = [
    // API Keys and tokens
    /sk-[a-zA-Z0-9]{48}/g,
    /pk-[a-zA-Z0-9]{48}/g,
    /rk-[a-zA-Z0-9]{48}/g,
    /xoxb-[a-zA-Z0-9-]+/g,
    /xoxp-[a-zA-Z0-9-]+/g,
    /AIza[a-zA-Z0-9_-]{35}/g,
    /ya29\.[a-zA-Z0-9_-]+/g,
    /AKIA[a-zA-Z0-9]{16}/g,
    /ASIA[a-zA-Z0-9]{16}/g,
    
    // Personal information
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // emails
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN format
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // credit card format
    
    // System paths and internal URLs
    /[C-Z]:\\[^\\/:*?"<>|\r\n]+/g, // Windows paths
    /\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._/-]+/g, // Unix paths (selective)
    /localhost:\d+/g, // localhost with ports
    /127\.0\.0\.1:\d+/g, // local IPs with ports
    
    // Potentially harmful content markers
    /\b(bomb|weapon|kill|murder|suicide|hack|exploit|breach)\b/gi,
  ];

  private constructor() {
    // Set log level based on environment
    const env = import.meta.env?.MODE || 'production';
    this.logLevel = env === 'development' ? LogLevel.DEBUG : LogLevel.WARN;
  }

  static getInstance(): SecureLogger {
    if (!SecureLogger.instance) {
      SecureLogger.instance = new SecureLogger();
    }
    return SecureLogger.instance;
  }

  private sanitizeMessage(message: string): string {
    if (typeof message !== 'string') {
      message = String(message);
    }

    let sanitized = message;
    
    // Apply sensitive pattern replacements
    SecureLogger.SENSITIVE_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    // Truncate very long messages
    if (sanitized.length > 500) {
      sanitized = sanitized.substring(0, 497) + '...';
    }

    return sanitized;
  }

  private log(level: LogLevel, message: string, context?: string): void {
    const sanitizedMessage = this.sanitizeMessage(message);
    
    const entry: LogEntry = {
      level,
      message: sanitizedMessage,
      timestamp: new Date(),
      context,
      sanitized: sanitizedMessage !== message
    };

    // Add to internal log store
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Only output if level is appropriate
    if (level <= this.logLevel) {
      const prefix = context ? `[${context}]` : '';
      const timestamp = entry.timestamp.toISOString();
      
      switch (level) {
        case LogLevel.ERROR:
          console.error(`${timestamp} ERROR ${prefix}: ${sanitizedMessage}`);
          break;
        case LogLevel.WARN:
          console.warn(`${timestamp} WARN ${prefix}: ${sanitizedMessage}`);
          break;
        case LogLevel.INFO:
          console.info(`${timestamp} INFO ${prefix}: ${sanitizedMessage}`);
          break;
        case LogLevel.DEBUG:
          console.log(`${timestamp} DEBUG ${prefix}: ${sanitizedMessage}`);
          break;
      }
    }
  }

  // Public logging methods
  error(message: string, context?: string): void {
    this.log(LogLevel.ERROR, message, context);
  }

  warn(message: string, context?: string): void {
    this.log(LogLevel.WARN, message, context);
  }

  info(message: string, context?: string): void {
    this.log(LogLevel.INFO, message, context);
  }

  debug(message: string, context?: string): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  // Security event logging
  securityEvent(event: string, details?: any): void {
    const sanitizedDetails = details ? this.sanitizeMessage(JSON.stringify(details)) : '';
    this.log(LogLevel.WARN, `SECURITY: ${event} ${sanitizedDetails}`, 'SECURITY');
  }

  // Get sanitized logs for debugging
  getLogs(level?: LogLevel): LogEntry[] {
    if (level !== undefined) {
      return this.logs.filter(log => log.level <= level);
    }
    return [...this.logs];
  }

  // Clear logs
  clearLogs(): void {
    this.logs = [];
  }

  // Set log level
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
}

// Export singleton instance
export const secureLogger = SecureLogger.getInstance();

// Convenience functions for common usage
export const logError = (message: string, context?: string) => secureLogger.error(message, context);
export const logWarn = (message: string, context?: string) => secureLogger.warn(message, context);
export const logInfo = (message: string, context?: string) => secureLogger.info(message, context);
export const logDebug = (message: string, context?: string) => secureLogger.debug(message, context);
export const logSecurity = (event: string, details?: any) => secureLogger.securityEvent(event, details);
