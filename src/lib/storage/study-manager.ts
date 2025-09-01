import { Study } from './types';

class StudyManager {
  private readonly STORAGE_KEY = 'llm-safety-studies';

  async getAllStudies(): Promise<Study[]> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const studies = JSON.parse(stored) as Study[];
      return studies.map(study => ({
        ...study,
        createdAt: new Date(study.createdAt),
        updatedAt: new Date(study.updatedAt),
        metadata: {
          ...study.metadata,
          lastActivity: new Date(study.metadata.lastActivity)
        }
      }));
    } catch (error) {
      console.error('Failed to load studies:', error);
      return [];
    }
  }

  async getStudy(id: string): Promise<Study | null> {
    const studies = await this.getAllStudies();
    return studies.find(study => study.id === id) || null;
  }

  async createStudy(studyData: Omit<Study, 'id' | 'createdAt' | 'updatedAt' | 'metadata'>): Promise<Study> {
    const studies = await this.getAllStudies();
    
    const newStudy: Study = {
      ...studyData,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        totalTests: 0,
        totalPrompts: 0,
        lastActivity: new Date(),
        status: 'planning'
      }
    };

    studies.push(newStudy);
    await this.saveStudies(studies);
    return newStudy;
  }

  async updateStudy(id: string, updates: Partial<Omit<Study, 'id' | 'createdAt'>>): Promise<Study> {
    const studies = await this.getAllStudies();
    const index = studies.findIndex(study => study.id === id);
    
    if (index === -1) {
      throw new Error(`Study with id ${id} not found`);
    }

    const updatedStudy = {
      ...studies[index],
      ...updates,
      updatedAt: new Date(),
      metadata: {
        ...studies[index].metadata,
        ...updates.metadata,
        lastActivity: new Date()
      }
    };

    studies[index] = updatedStudy;
    await this.saveStudies(studies);
    return updatedStudy;
  }

  async deleteStudy(id: string): Promise<boolean> {
    const studies = await this.getAllStudies();
    const filteredStudies = studies.filter(study => study.id !== id);
    
    if (filteredStudies.length === studies.length) {
      return false; // Study not found
    }

    await this.saveStudies(filteredStudies);
    
    // Also clean up related data
    await this.cleanupStudyData(id);
    
    return true;
  }

  async duplicateStudy(id: string, name: string): Promise<Study> {
    const originalStudy = await this.getStudy(id);
    if (!originalStudy) {
      throw new Error(`Study with id ${id} not found`);
    }

    const duplicatedStudy = await this.createStudy({
      name,
      description: `Copy of ${originalStudy.description}`,
      objectives: [...originalStudy.objectives],
      tags: [...originalStudy.tags],
      isActive: false,
      collaborators: originalStudy.collaborators ? [...originalStudy.collaborators] : undefined
    });

    // Copy prompts from original study
    await this.copyStudyPrompts(id, duplicatedStudy.id);

    return duplicatedStudy;
  }

  async updateStudyStats(studyId: string): Promise<void> {
    const study = await this.getStudy(studyId);
    if (!study) return;

    try {
      // Import here to avoid circular dependencies
      const { storageManager } = await import('./storage-manager');
      
      const [sessions, templates] = await Promise.all([
        storageManager.getTestSessions(),
        storageManager.getPromptTemplates()
      ]);

      const studySessions = sessions.filter(s => s.studyId === studyId);
      const studyTemplates = templates.filter(t => t.studyId === studyId);

      await this.updateStudy(studyId, {
        metadata: {
          ...study.metadata,
          totalTests: studySessions.length,
          totalPrompts: studyTemplates.length,
          lastActivity: studySessions.length > 0 
            ? new Date(Math.max(...studySessions.map(s => s.timestamp.getTime())))
            : study.metadata.lastActivity
        }
      });
    } catch (error) {
      console.error('Failed to update study stats:', error);
    }
  }

  private async copyStudyPrompts(sourceStudyId: string, targetStudyId: string): Promise<void> {
    try {
      const { storageManager } = await import('./storage-manager');
      const templates = await storageManager.getPromptTemplates();
      const sourceTemplates = templates.filter(t => t.studyId === sourceStudyId);

      for (const template of sourceTemplates) {
        const copiedTemplate = {
          ...template,
          id: Math.max(0, ...templates.map(t => t.id)) + 1,
          studyId: targetStudyId,
          derivedFrom: template.id,
          usedInStudies: [targetStudyId],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await storageManager.savePromptTemplate(copiedTemplate);
      }
    } catch (error) {
      console.error('Failed to copy study prompts:', error);
    }
  }

  private async cleanupStudyData(studyId: string): Promise<void> {
    try {
      const { storageManager } = await import('./storage-manager');
      
      // Get all data
      const [sessions, templates] = await Promise.all([
        storageManager.getTestSessions(),
        storageManager.getPromptTemplates()
      ]);

      // Filter out data belonging to deleted study
      const remainingSessions = sessions.filter(s => s.studyId !== studyId);
      const remainingTemplates = templates.filter(t => t.studyId !== studyId);

      // Save filtered data
      localStorage.setItem('llm-safety-sessions', JSON.stringify(remainingSessions));
      localStorage.setItem('llm-safety-prompts', JSON.stringify(remainingTemplates));
    } catch (error) {
      console.error('Failed to cleanup study data:', error);
    }
  }

  private async saveStudies(studies: Study[]): Promise<void> {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(studies));
    } catch (error) {
      console.error('Failed to save studies:', error);
      throw error;
    }
  }

  private generateId(): string {
    return `study_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Initialize with a default study if none exist
  async ensureDefaultStudy(): Promise<Study> {
    const studies = await this.getAllStudies();
    
    if (studies.length === 0) {
      return await this.createStudy({
        name: 'Default Study',
        description: 'Initial safety research study',
        objectives: ['Evaluate LLM safety responses', 'Test prompt effectiveness'],
        tags: ['safety', 'initial'],
        isActive: true
      });
    }
    
    return studies[0];
  }
}

export const studyManager = new StudyManager();
