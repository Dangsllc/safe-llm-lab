import React, { useState, useEffect } from 'react';
import { X, Plus, Target, Tag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Study } from '@/lib/storage/types';
import { useToastEnhanced } from '@/hooks/use-toast-enhanced';
import { useStudy } from '@/contexts/StudyContext';

interface CreateStudyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  studyToEdit?: Study | null;
}

export function CreateStudyDialog({ isOpen, onClose, studyToEdit }: CreateStudyDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'planning' as Study['metadata']['status'],
    isActive: false
  });
  const [objectives, setObjectives] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [newObjective, setNewObjective] = useState('');
  const [newTag, setNewTag] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { showSuccess, showError } = useToastEnhanced();
  const { refreshStudies, setCurrentStudy } = useStudy();

  // Reset form when dialog opens/closes or when editing different study
  useEffect(() => {
    if (isOpen) {
      if (studyToEdit) {
        setFormData({
          name: studyToEdit.name,
          description: studyToEdit.description,
          status: studyToEdit.metadata.status,
          isActive: studyToEdit.isActive
        });
        setObjectives([...studyToEdit.objectives]);
        setTags([...studyToEdit.tags]);
      } else {
        setFormData({
          name: '',
          description: '',
          status: 'planning',
          isActive: false
        });
        setObjectives([]);
        setTags([]);
      }
      setNewObjective('');
      setNewTag('');
    }
  }, [isOpen, studyToEdit]);

  const handleInputChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addObjective = () => {
    if (newObjective.trim() && !objectives.includes(newObjective.trim())) {
      setObjectives(prev => [...prev, newObjective.trim()]);
      setNewObjective('');
    }
  };

  const removeObjective = (index: number) => {
    setObjectives(prev => prev.filter((_, i) => i !== index));
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags(prev => [...prev, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (index: number) => {
    setTags(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      showError('Study name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const { studyManager } = await import('@/lib/storage/study-manager');

      if (studyToEdit) {
        // Update existing study
        const updatedStudy = await studyManager.updateStudy(studyToEdit.id, {
          name: formData.name.trim(),
          description: formData.description.trim(),
          objectives,
          tags,
          isActive: formData.isActive,
          metadata: {
            ...studyToEdit.metadata,
            status: formData.status
          }
        });
        
        showSuccess('Study updated successfully');
        setCurrentStudy(updatedStudy);
      } else {
        // Create new study
        const newStudy = await studyManager.createStudy({
          name: formData.name.trim(),
          description: formData.description.trim(),
          objectives,
          tags,
          isActive: formData.isActive
        });

        showSuccess('Study created successfully');
        setCurrentStudy(newStudy);
      }

      await refreshStudies();
      onClose();
    } catch (error) {
      console.error('Error saving study:', error);
      showError(`Failed to ${studyToEdit ? 'update' : 'create'} study`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {studyToEdit ? 'Edit Study' : 'Create New Study'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Study Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter study name..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe the purpose and goals of this study..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleInputChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="isActive">Active Study</Label>
                <div className="flex items-center space-x-2 h-10">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => handleInputChange('isActive', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-muted-foreground">
                    Set as active study
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Objectives */}
          <div className="space-y-4">
            <Label>Research Objectives</Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  placeholder="Add research objective..."
                  onKeyPress={(e) => handleKeyPress(e, addObjective)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addObjective}
                  disabled={!newObjective.trim()}
                >
                  <Target className="h-4 w-4" />
                </Button>
              </div>
              
              {objectives.length > 0 && (
                <div className="space-y-2">
                  {objectives.map((objective, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-sm">{objective}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeObjective(index)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-4">
            <Label>Tags</Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add tag..."
                  onKeyPress={(e) => handleKeyPress(e, addTag)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTag}
                  disabled={!newTag.trim()}
                >
                  <Tag className="h-4 w-4" />
                </Button>
              </div>
              
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="gap-1">
                      {tag}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTag(index)}
                        className="h-4 w-4 p-0 hover:bg-transparent"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : studyToEdit ? 'Update Study' : 'Create Study'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
