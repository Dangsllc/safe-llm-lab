// Local storage utilities for the LLM Safety Research Platform

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

const STORAGE_KEYS = {
  TEST_SESSIONS: 'llm-safety-test-sessions',
  PROMPT_TEMPLATES: 'llm-safety-prompt-templates',
  SAFETY_THRESHOLDS: 'llm-safety-thresholds',
  APP_SETTINGS: 'llm-safety-app-settings',
} as const;

// Generic storage functions
const getFromStorage = <T>(key: string): T | null => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error(`Error getting ${key} from storage:`, error);
    return null;
  }
};

const setToStorage = <T>(key: string, value: T): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Error setting ${key} to storage:`, error);
    return false;
  }
};

// Test Sessions
export const getTestSessions = (): TestSession[] => {
  return getFromStorage<TestSession[]>(STORAGE_KEYS.TEST_SESSIONS) || [];
};

export const saveTestSession = (session: TestSession): boolean => {
  const sessions = getTestSessions();
  const existingIndex = sessions.findIndex(s => s.id === session.id);
  
  if (existingIndex >= 0) {
    sessions[existingIndex] = session;
  } else {
    sessions.push(session);
  }
  
  return setToStorage(STORAGE_KEYS.TEST_SESSIONS, sessions);
};

export const deleteTestSession = (sessionId: string): boolean => {
  const sessions = getTestSessions().filter(s => s.id !== sessionId);
  return setToStorage(STORAGE_KEYS.TEST_SESSIONS, sessions);
};

// Prompt Templates
export const getPromptTemplates = (): PromptTemplate[] => {
  const stored = getFromStorage<PromptTemplate[]>(STORAGE_KEYS.PROMPT_TEMPLATES);
  if (stored) return stored;
  
  // Return default templates if none stored
  return [];
};

export const savePromptTemplate = (template: PromptTemplate): boolean => {
  const templates = getPromptTemplates();
  const existingIndex = templates.findIndex(t => t.id === template.id);
  
  if (existingIndex >= 0) {
    templates[existingIndex] = { ...template, updatedAt: new Date() };
  } else {
    templates.push({ ...template, createdAt: new Date(), updatedAt: new Date() });
  }
  
  return setToStorage(STORAGE_KEYS.PROMPT_TEMPLATES, templates);
};

export const deletePromptTemplate = (templateId: number): boolean => {
  const templates = getPromptTemplates().filter(t => t.id !== templateId);
  return setToStorage(STORAGE_KEYS.PROMPT_TEMPLATES, templates);
};

// Safety Thresholds
export const getSafetyThresholds = (): SafetyThresholds => {
  return getFromStorage<SafetyThresholds>(STORAGE_KEYS.SAFETY_THRESHOLDS) || {
    highRisk: { warning: 5, alert: 10 },
    mediumRisk: { warning: 40, alert: 70 },
    lowRisk: { warning: 80, alert: 90 }
  };
};

export const saveSafetyThresholds = (thresholds: SafetyThresholds): boolean => {
  return setToStorage(STORAGE_KEYS.SAFETY_THRESHOLDS, thresholds);
};

// Export data
export const exportToJSON = (data: any, filename: string) => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  downloadBlob(blob, `${filename}.json`);
};

export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes in CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  downloadBlob(blob, `${filename}.csv`);
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Backup and restore
export const createBackup = () => {
  const backup = {
    testSessions: getTestSessions(),
    promptTemplates: getPromptTemplates(),
    safetyThresholds: getSafetyThresholds(),
    timestamp: new Date(),
    version: '1.0'
  };
  
  exportToJSON(backup, `llm-safety-backup-${new Date().toISOString().split('T')[0]}`);
  return backup;
};

export const restoreFromBackup = (backupData: any): boolean => {
  try {
    if (backupData.testSessions) {
      setToStorage(STORAGE_KEYS.TEST_SESSIONS, backupData.testSessions);
    }
    if (backupData.promptTemplates) {
      setToStorage(STORAGE_KEYS.PROMPT_TEMPLATES, backupData.promptTemplates);
    }
    if (backupData.safetyThresholds) {
      setToStorage(STORAGE_KEYS.SAFETY_THRESHOLDS, backupData.safetyThresholds);
    }
    return true;
  } catch (error) {
    console.error('Error restoring backup:', error);
    return false;
  }
};
