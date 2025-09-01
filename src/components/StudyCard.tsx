import React from 'react';
import { Calendar, Users, Target, MoreVertical, Play, Pause, Archive, Copy, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Study } from '@/lib/storage/types';
import { useStudy } from '@/contexts/StudyContext';
import { useToastEnhanced } from '@/hooks/use-toast-enhanced';

interface StudyCardProps {
  study: Study;
  onEdit?: (study: Study) => void;
  onDuplicate?: (study: Study) => void;
  onDelete?: (study: Study) => void;
  onSelect?: (study: Study) => void;
  isSelected?: boolean;
}

export function StudyCard({ 
  study, 
  onEdit, 
  onDuplicate, 
  onDelete, 
  onSelect,
  isSelected = false 
}: StudyCardProps) {
  const { setCurrentStudy } = useStudy();
  const { showSuccess } = useToastEnhanced();

  const getStatusColor = (status: Study['metadata']['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'planning': return 'bg-blue-500';
      case 'paused': return 'bg-yellow-500';
      case 'completed': return 'bg-purple-500';
      case 'archived': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = (status: Study['metadata']['status']) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handleSelectStudy = () => {
    setCurrentStudy(study);
    showSuccess(`Switched to study: ${study.name}`);
    onSelect?.(study);
  };

  const handleToggleActive = async () => {
    try {
      const { studyManager } = await import('@/lib/storage/study-manager');
      await studyManager.updateStudy(study.id, { 
        isActive: !study.isActive,
        metadata: {
          ...study.metadata,
          status: !study.isActive ? 'active' : 'paused'
        }
      });
      showSuccess(`Study ${!study.isActive ? 'activated' : 'paused'}`);
    } catch (error) {
      console.error('Failed to toggle study status:', error);
    }
  };

  return (
    <Card className={`cursor-pointer transition-all hover:shadow-md ${
      isSelected ? 'ring-2 ring-primary' : ''
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${getStatusColor(study.metadata.status)}`} />
            <CardTitle className="text-lg" onClick={handleSelectStudy}>
              {study.name}
            </CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(study)}>
                <Target className="h-4 w-4 mr-2" />
                Edit Study
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleActive}>
                {study.isActive ? (
                  <><Pause className="h-4 w-4 mr-2" />Pause Study</>
                ) : (
                  <><Play className="h-4 w-4 mr-2" />Activate Study</>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate?.(study)}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete?.(study)} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Study
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="outline">{getStatusText(study.metadata.status)}</Badge>
          {study.isActive && <Badge variant="default">Active</Badge>}
          {study.tags.map(tag => (
            <Badge key={tag} variant="secondary">{tag}</Badge>
          ))}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4" onClick={handleSelectStudy}>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {study.description}
        </p>
        
        {study.objectives.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Objectives:</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              {study.objectives.slice(0, 2).map((objective, index) => (
                <li key={index} className="flex items-start">
                  <Target className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-1">{objective}</span>
                </li>
              ))}
              {study.objectives.length > 2 && (
                <li className="text-xs text-muted-foreground">
                  +{study.objectives.length - 2} more objectives
                </li>
              )}
            </ul>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="flex items-center text-muted-foreground">
              <Calendar className="h-4 w-4 mr-1" />
              <span>Created</span>
            </div>
            <div className="font-medium">
              {study.createdAt.toLocaleDateString()}
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center text-muted-foreground">
              <Users className="h-4 w-4 mr-1" />
              <span>Activity</span>
            </div>
            <div className="font-medium">
              {study.metadata.lastActivity.toLocaleDateString()}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {study.metadata.totalTests}
            </div>
            <div className="text-xs text-muted-foreground">Tests</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">
              {study.metadata.totalPrompts}
            </div>
            <div className="text-xs text-muted-foreground">Prompts</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
