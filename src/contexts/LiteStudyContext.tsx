import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Study } from '@/lib/storage/types';

interface LiteStudyContextType {
  currentStudy: Study | null;
  allStudies: Study[];
  setCurrentStudy: (study: Study | null) => void;
  refreshStudies: () => Promise<void>;
  createStudy: (studyData: any) => Promise<Study | null>;
  updateStudy: (studyId: string, updates: Partial<Study>) => Promise<Study | null>;
  deleteStudy: (studyId: string) => Promise<boolean>;
  isLoading: boolean;
}

const LiteStudyContext = createContext<LiteStudyContextType | undefined>(undefined);

interface LiteStudyProviderProps {
  children: ReactNode;
}

export function LiteStudyProvider({ children }: LiteStudyProviderProps) {
  const [currentStudy, setCurrentStudy] = useState<Study | null>(null);
  const [allStudies, setAllStudies] = useState<Study[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshStudies = async () => {
    // Mock implementation - no backend calls
    setIsLoading(false);
  };

  const createStudy = async (studyData: any): Promise<Study | null> => {
    // Mock implementation
    const newStudy: Study = {
      id: `study-${Date.now()}`,
      name: studyData.name,
      description: studyData.description,
      objectives: studyData.objectives || [],
      tags: studyData.tags || [],
      metadata: {
        totalTests: 0,
        totalPrompts: 0,
        lastActivity: new Date(),
        status: 'planning' as const
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      collaborators: []
    };
    
    setAllStudies(prev => [...prev, newStudy]);
    setCurrentStudy(newStudy);
    return newStudy;
  };

  const updateStudy = async (studyId: string, updates: Partial<Study>): Promise<Study | null> => {
    // Mock implementation
    const updatedStudy = { ...currentStudy, ...updates } as Study;
    setCurrentStudy(updatedStudy);
    return updatedStudy;
  };

  const deleteStudy = async (studyId: string): Promise<boolean> => {
    // Mock implementation
    setAllStudies(prev => prev.filter(s => s.id !== studyId));
    if (currentStudy?.id === studyId) {
      setCurrentStudy(null);
    }
    return true;
  };

  const value: LiteStudyContextType = {
    currentStudy,
    allStudies,
    setCurrentStudy,
    refreshStudies,
    createStudy,
    updateStudy,
    deleteStudy,
    isLoading
  };

  return (
    <LiteStudyContext.Provider value={value}>
      {children}
    </LiteStudyContext.Provider>
  );
}

export function useLiteStudy() {
  const context = useContext(LiteStudyContext);
  if (context === undefined) {
    throw new Error('useLiteStudy must be used within a LiteStudyProvider');
  }
  return context;
}
