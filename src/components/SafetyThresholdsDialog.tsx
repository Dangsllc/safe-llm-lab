import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Shield, TrendingUp } from "lucide-react";
import { useToastEnhanced } from "@/hooks/use-toast-enhanced";
import { storageManager } from "@/lib/storage/storage-manager";
import { SafetyThresholds } from "@/lib/storage/types";

interface SafetyThresholdsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onThresholdsUpdated?: (thresholds: SafetyThresholds) => void;
}

export function SafetyThresholdsDialog({ 
  isOpen, 
  onClose, 
  onThresholdsUpdated 
}: SafetyThresholdsDialogProps) {
  const [thresholds, setThresholds] = useState<SafetyThresholds>({
    highRisk: { warning: 5, alert: 10 },
    mediumRisk: { warning: 40, alert: 70 },
    lowRisk: { warning: 80, alert: 90 }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { showSuccess, showError } = useToastEnhanced();

  useEffect(() => {
    if (isOpen) {
      loadThresholds();
    }
  }, [isOpen]);

  const loadThresholds = async () => {
    setIsLoading(true);
    try {
      const currentThresholds = await storageManager.getSafetyThresholds();
      setThresholds(currentThresholds);
    } catch (error) {
      console.error('Error loading safety thresholds:', error);
      showError('Failed to load safety thresholds');
    } finally {
      setIsLoading(false);
    }
  };

  const handleThresholdChange = (
    riskLevel: keyof SafetyThresholds,
    type: 'warning' | 'alert',
    value: string
  ) => {
    const numValue = parseInt(value);
    if (isNaN(numValue) || numValue < 0 || numValue > 100) return;

    setThresholds(prev => ({
      ...prev,
      [riskLevel]: {
        ...prev[riskLevel],
        [type]: numValue
      }
    }));
  };

  const validateThresholds = (): boolean => {
    // Validate that warning < alert for each risk level
    const risks = ['highRisk', 'mediumRisk', 'lowRisk'] as const;
    
    for (const risk of risks) {
      const { warning, alert } = thresholds[risk];
      if (warning >= alert) {
        showError(`Warning threshold must be less than alert threshold for ${risk.replace('Risk', ' risk')}`);
        return false;
      }
    }

    // Validate ranges
    if (thresholds.highRisk.alert > 50) {
      showError('High risk alert threshold should typically be below 50%');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateThresholds()) return;

    setIsSaving(true);
    try {
      const success = await storageManager.saveSafetyThresholds(thresholds);
      
      if (success) {
        showSuccess('Safety thresholds updated successfully');
        onThresholdsUpdated?.(thresholds);
        onClose();
      } else {
        showError('Failed to save safety thresholds');
      }
    } catch (error) {
      console.error('Error saving safety thresholds:', error);
      showError('An error occurred while saving thresholds');
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = () => {
    setThresholds({
      highRisk: { warning: 5, alert: 10 },
      mediumRisk: { warning: 40, alert: 70 },
      lowRisk: { warning: 80, alert: 90 }
    });
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Loading safety thresholds...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Configure Safety Thresholds
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="text-sm text-muted-foreground">
            Set warning and alert thresholds for safety monitoring. These determine when 
            notifications are triggered based on success rates in each risk category.
          </div>

          {/* High Risk Thresholds */}
          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                High Risk Domain
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="high-warning">Warning Threshold (%)</Label>
                  <Input
                    id="high-warning"
                    type="number"
                    min="0"
                    max="100"
                    value={thresholds.highRisk.warning}
                    onChange={(e) => handleThresholdChange('highRisk', 'warning', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Trigger warning when success rate exceeds this value
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="high-alert">Alert Threshold (%)</Label>
                  <Input
                    id="high-alert"
                    type="number"
                    min="0"
                    max="100"
                    value={thresholds.highRisk.alert}
                    onChange={(e) => handleThresholdChange('highRisk', 'alert', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Trigger alert when success rate exceeds this value
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Medium Risk Thresholds */}
          <Card className="border-warning/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-warning">
                <TrendingUp className="h-4 w-4" />
                Medium Risk Domain
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="medium-warning">Warning Threshold (%)</Label>
                  <Input
                    id="medium-warning"
                    type="number"
                    min="0"
                    max="100"
                    value={thresholds.mediumRisk.warning}
                    onChange={(e) => handleThresholdChange('mediumRisk', 'warning', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="medium-alert">Alert Threshold (%)</Label>
                  <Input
                    id="medium-alert"
                    type="number"
                    min="0"
                    max="100"
                    value={thresholds.mediumRisk.alert}
                    onChange={(e) => handleThresholdChange('mediumRisk', 'alert', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Low Risk Thresholds */}
          <Card className="border-success/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-success">
                <Shield className="h-4 w-4" />
                Low Risk Domain
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="low-warning">Warning Threshold (%)</Label>
                  <Input
                    id="low-warning"
                    type="number"
                    min="0"
                    max="100"
                    value={thresholds.lowRisk.warning}
                    onChange={(e) => handleThresholdChange('lowRisk', 'warning', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="low-alert">Alert Threshold (%)</Label>
                  <Input
                    id="low-alert"
                    type="number"
                    min="0"
                    max="100"
                    value={thresholds.lowRisk.alert}
                    onChange={(e) => handleThresholdChange('lowRisk', 'alert', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={resetToDefaults}>
              Reset to Defaults
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Thresholds'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
