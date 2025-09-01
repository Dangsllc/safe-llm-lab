import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Study } from '@/lib/storage/types';
import { studiesService, StudyWithCollaborators } from '@/lib/api/studies';
import { useAuth } from './AuthContext';
import { logError, logSecurity } from '@/lib/security/secure-logger';

interface StudyContextType {
  currentStudy: StudyWithCollaborators | null;
  allStudies: StudyWithCollaborators[];
  setCurrentStudy: (study: StudyWithCollaborators | null) => void;
  refreshStudies: () => Promise<void>;
  createStudy: (studyData: any) => Promise<Study | null>;
  updateStudy: (studyId: string, updates: Partial<Study>) => Promise<Study | null>;
  deleteStudy: (studyId: string) => Promise<boolean>;
  isLoading: boolean;
}

const StudyContext = createContext<StudyContextType | undefined>(undefined);

interface StudyProviderProps {
  children: ReactNode;
}

export function StudyProvider({ children }: StudyProviderProps) {
  const [currentStudy, setCurrentStudy] = useState<StudyWithCollaborators | null>(null);
  const [allStudies, setAllStudies] = useState<StudyWithCollaborators[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated } = useAuth();

  const refreshStudies = async () => {
    if (!isAuthenticated) {
      setAllStudies([]);
      setCurrentStudy(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const studies = await studiesService.getAllStudies();
      setAllStudies(studies);
      
      // If no current study is selected and we have studies, select the first active one
      if (!currentStudy && studies.length > 0) {
        const activeStudy = studies.find(s => s.isActive) || studies[0];
        setCurrentStudy(activeStudy);
        sessionStorage.setItem('currentStudyId', activeStudy.id);
      }
      
      logSecurity('Studies refreshed', { count: studies.length });
    } catch (error) {
      logError('Failed to load studies', 'STUDY-CONTEXT');
      setAllStudies([]);
    } finally {
      setIsLoading(false);
    }
  };

  const createStudy = async (studyData: any): Promise<Study | null> => {
    try {
      const newStudy = await studiesService.createStudy(studyData);
      if (newStudy) {
        await refreshStudies(); // Refresh to get full study with collaborators
        logSecurity('Study created via context', { studyId: newStudy.id });
      }
      return newStudy;
    } catch (error) {
      logError('Study creation failed in context', 'STUDY-CONTEXT');
      return null;
    }
  };

  const updateStudy = async (studyId: string, updates: Partial<Study>): Promise<Study | null> => {
    try {
      const updatedStudy = await studiesService.updateStudy(studyId, updates);
      if (updatedStudy) {
        await refreshStudies(); // Refresh to get updated data
        logSecurity('Study updated via context', { studyId });
      }
      return updatedStudy;
    } catch (error) {
      logError('Study update failed in context', 'STUDY-CONTEXT');
      return null;
    }
  };

  const deleteStudy = async (studyId: string): Promise<boolean> => {
    try {
      const success = await studiesService.deleteStudy(studyId);
      if (success) {
        // Remove from local state
        setAllStudies(prev => prev.filter(s => s.id !== studyId));
        if (currentStudy?.id === studyId) {
          setCurrentStudy(null);
          sessionStorage.removeItem('currentStudyId');
        }
        logSecurity('Study deleted via context', { studyId });
      }
      return success;
    } catch (error) {
      logError('Study deletion failed in context', 'STUDY-CONTEXT');
      return false;
    }
  };

  const updateCurrentStudy = (study: StudyWithCollaborators | null) => {
    setCurrentStudy(study);
    if (study) {
      sessionStorage.setItem('currentStudyId', study.id);
    } else {
      sessionStorage.removeItem('currentStudyId');
    }
  };

  useEffect(() => {
    const initializeStudy = async () => {
      if (!isAuthenticated) return;
      
      await refreshStudies();
      
      // Try to restore the last selected study
      const savedStudyId = sessionStorage.getItem('currentStudyId');
      if (savedStudyId) {
        try {
          const savedStudy = await studiesService.getStudy(savedStudyId);
          if (savedStudy) {
            setCurrentStudy(savedStudy);
          }
        } catch (error) {
          logError('Failed to restore saved study', 'STUDY-CONTEXT');
        }
      }
    };

    initializeStudy();
  }, [isAuthenticated]);

  const value: StudyContextType = {
    currentStudy,
    allStudies,
    setCurrentStudy: updateCurrentStudy,
    refreshStudies,
    createStudy,
    updateStudy,
    deleteStudy,
    isLoading
  };

  return (
    <StudyContext.Provider value={value}>
      {children}
    </StudyContext.Provider>
  );
}

export function useStudy() {
  const context = useContext(StudyContext);
  if (context === undefined) {
    throw new Error('useStudy must be used within a StudyProvider');
  }
  return context;
}
