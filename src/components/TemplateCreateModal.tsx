import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { useToastEnhanced } from "@/hooks/use-toast-enhanced";
import { storageManager } from "@/lib/storage/storage-manager";
import { PromptTemplate } from "@/lib/storage/types";

interface TemplateCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateCreated: (template: PromptTemplate) => void;
  editTemplate?: PromptTemplate | null;
}

export function TemplateCreateModal({ 
  isOpen, 
  onClose, 
  onTemplateCreated, 
  editTemplate 
}: TemplateCreateModalProps) {
  const [title, setTitle] = useState(editTemplate?.title || "");
  const [content, setContent] = useState(editTemplate?.content || "");
  const [riskLevel, setRiskLevel] = useState(editTemplate?.riskLevel || "medium");
  const [category, setCategory] = useState(editTemplate?.category || "Direct");
  const [shots, setShots] = useState(editTemplate?.shots?.toString() || "1");
  const [variables, setVariables] = useState<string[]>(editTemplate?.variables || []);
  const [newVariable, setNewVariable] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { showSuccess, showError } = useToastEnhanced();

  const handleAddVariable = () => {
    if (newVariable.trim() && !variables.includes(newVariable.trim().toUpperCase())) {
      setVariables([...variables, newVariable.trim().toUpperCase()]);
      setNewVariable("");
    }
  };

  const handleRemoveVariable = (variable: string) => {
    setVariables(variables.filter(v => v !== variable));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !content.trim()) {
      showError("Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    
    try {
      const template: PromptTemplate = {
        id: editTemplate?.id || Date.now(), // Use timestamp for new templates
        title: title.trim(),
        content: content.trim(),
        riskLevel,
        category,
        variables,
        shots: parseInt(shots) > 1 ? parseInt(shots) : undefined,
        createdAt: editTemplate?.createdAt || new Date(),
        updatedAt: new Date()
      };

      const success = await storageManager.savePromptTemplate(template);
      
      if (success) {
        showSuccess(editTemplate ? "Template updated successfully" : "Template created successfully");
        onTemplateCreated(template);
        handleClose();
      } else {
        showError("Failed to save template");
      }
    } catch (error) {
      console.error("Error saving template:", error);
      showError("An error occurred while saving the template");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setTitle("");
    setContent("");
    setRiskLevel("medium");
    setCategory("Direct");
    setShots("1");
    setVariables([]);
    setNewVariable("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editTemplate ? "Edit Template" : "Create New Template"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter template title"
              required
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">Template Content *</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter the prompt template. Use [VARIABLE_NAME] for placeholders."
              className="min-h-32"
              required
            />
            <p className="text-xs text-muted-foreground">
              Use square brackets for variables, e.g., [TOPIC], [SENSITIVE_AREA]
            </p>
          </div>

          {/* Risk Level and Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="risk-level">Risk Level</Label>
              <Select value={riskLevel} onValueChange={setRiskLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select risk level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low Risk</SelectItem>
                  <SelectItem value="medium">Medium Risk</SelectItem>
                  <SelectItem value="high">High Risk</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Direct">Direct</SelectItem>
                  <SelectItem value="Role-Playing">Role-Playing</SelectItem>
                  <SelectItem value="Gradual Escalation">Gradual Escalation</SelectItem>
                  <SelectItem value="Context Manipulation">Context Manipulation</SelectItem>
                  <SelectItem value="Instruction Obfuscation">Instruction Obfuscation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Shots for multi-shot templates */}
          <div className="space-y-2">
            <Label htmlFor="shots">Number of Shots (Multi-shot only)</Label>
            <Input
              id="shots"
              type="number"
              min="1"
              max="10"
              value={shots}
              onChange={(e) => setShots(e.target.value)}
              placeholder="1"
            />
            <p className="text-xs text-muted-foreground">
              Set to 1 for single-shot, or higher for multi-shot templates
            </p>
          </div>

          {/* Variables */}
          <div className="space-y-2">
            <Label>Variables</Label>
            <div className="flex gap-2">
              <Input
                value={newVariable}
                onChange={(e) => setNewVariable(e.target.value.toUpperCase())}
                placeholder="Add variable name"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddVariable())}
              />
              <Button type="button" onClick={handleAddVariable} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {variables.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {variables.map((variable) => (
                  <Badge key={variable} variant="secondary" className="flex items-center gap-1">
                    {variable}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => handleRemoveVariable(variable)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : editTemplate ? "Update Template" : "Create Template"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
