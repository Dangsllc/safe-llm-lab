// Studies API service for multi-user collaboration

import { apiClient } from './client';
import { logSecurity, logError } from '../security/secure-logger';
import { Study } from '../storage/types';

export interface StudyCollaborator {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: 'owner' | 'editor' | 'contributor' | 'viewer';
  joinedAt: Date;
}

export interface StudyWithCollaborators extends Omit<Study, 'collaborators'> {
  collaborators: StudyCollaborator[];
  owner: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateStudyRequest {
  name: string;
  description: string;
  objectives: string[];
  tags: string[];
}

export interface InviteCollaboratorRequest {
  email: string;
  role: 'editor' | 'contributor' | 'viewer';
}

export class StudiesService {
  // Get all studies (owned + collaborated)
  async getAllStudies(): Promise<StudyWithCollaborators[]> {
    try {
      const response = await apiClient.get<StudyWithCollaborators[]>('/studies');
      
      if (response.success && response.data) {
        return response.data;
      }
      
      logError('Failed to fetch studies', 'STUDIES-SERVICE');
      return [];
    } catch (error) {
      logError('Studies fetch request failed', 'STUDIES-SERVICE');
      return [];
    }
  }

  // Get single study by ID
  async getStudy(studyId: string): Promise<StudyWithCollaborators | null> {
    try {
      const response = await apiClient.get<StudyWithCollaborators>(`/studies/${studyId}`);
      
      if (response.success && response.data) {
        return response.data;
      }
      
      return null;
    } catch (error) {
      logError(`Failed to fetch study ${studyId}`, 'STUDIES-SERVICE');
      return null;
    }
  }

  // Create new study
  async createStudy(studyData: CreateStudyRequest): Promise<Study | null> {
    try {
      const response = await apiClient.post<Study>('/studies', studyData);
      
      if (response.success && response.data) {
        logSecurity('Study created', { studyId: response.data.id, name: studyData.name });
        return response.data;
      }
      
      return null;
    } catch (error) {
      logError('Study creation failed', 'STUDIES-SERVICE');
      return null;
    }
  }

  // Update study
  async updateStudy(studyId: string, updates: Partial<Study>): Promise<Study | null> {
    try {
      const response = await apiClient.put<Study>(`/studies/${studyId}`, updates);
      
      if (response.success && response.data) {
        logSecurity('Study updated', { studyId, updates: Object.keys(updates) });
        return response.data;
      }
      
      return null;
    } catch (error) {
      logError(`Study update failed for ${studyId}`, 'STUDIES-SERVICE');
      return null;
    }
  }

  // Delete study
  async deleteStudy(studyId: string): Promise<boolean> {
    try {
      const response = await apiClient.delete(`/studies/${studyId}`);
      
      if (response.success) {
        logSecurity('Study deleted', { studyId });
        return true;
      }
      
      return false;
    } catch (error) {
      logError(`Study deletion failed for ${studyId}`, 'STUDIES-SERVICE');
      return false;
    }
  }

  // Invite collaborator to study
  async inviteCollaborator(studyId: string, invite: InviteCollaboratorRequest): Promise<boolean> {
    try {
      const response = await apiClient.post(`/studies/${studyId}/collaborators`, invite);
      
      if (response.success) {
        logSecurity('Collaborator invited', { studyId, email: invite.email, role: invite.role });
        return true;
      }
      
      return false;
    } catch (error) {
      logError(`Collaborator invitation failed for study ${studyId}`, 'STUDIES-SERVICE');
      return false;
    }
  }

  // Update collaborator role
  async updateCollaboratorRole(studyId: string, userId: string, role: string): Promise<boolean> {
    try {
      const response = await apiClient.patch(`/studies/${studyId}/collaborators/${userId}`, { role });
      
      if (response.success) {
        logSecurity('Collaborator role updated', { studyId, userId, role });
        return true;
      }
      
      return false;
    } catch (error) {
      logError(`Collaborator role update failed`, 'STUDIES-SERVICE');
      return false;
    }
  }

  // Remove collaborator from study
  async removeCollaborator(studyId: string, userId: string): Promise<boolean> {
    try {
      const response = await apiClient.delete(`/studies/${studyId}/collaborators/${userId}`);
      
      if (response.success) {
        logSecurity('Collaborator removed', { studyId, userId });
        return true;
      }
      
      return false;
    } catch (error) {
      logError(`Collaborator removal failed`, 'STUDIES-SERVICE');
      return false;
    }
  }

  // Get study collaborators
  async getCollaborators(studyId: string): Promise<StudyCollaborator[]> {
    try {
      const response = await apiClient.get<StudyCollaborator[]>(`/studies/${studyId}/collaborators`);
      
      if (response.success && response.data) {
        return response.data;
      }
      
      return [];
    } catch (error) {
      logError(`Failed to fetch collaborators for study ${studyId}`, 'STUDIES-SERVICE');
      return [];
    }
  }
}

export const studiesService = new StudiesService();
