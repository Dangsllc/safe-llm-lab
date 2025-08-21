import { useState, useEffect } from "react";
import { AlertTriangle, TrendingUp, TrendingDown, Shield, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { SafetyIndicator } from "@/components/SafetyIndicator";
import { SafetyThresholdsDialog } from "@/components/SafetyThresholdsDialog";
import { storageManager } from "@/lib/storage/storage-manager";
import { SafetyThresholds } from "@/lib/storage/types";
import { useToastEnhanced } from "@/hooks/use-toast-enhanced";

export default function SafetyMonitor() {
  const [thresholds, setThresholds] = useState<SafetyThresholds>({
    highRisk: { warning: 5, alert: 10 },
    mediumRisk: { warning: 40, alert: 70 },
    lowRisk: { warning: 80, alert: 90 }
  });
  const [isThresholdsDialogOpen, setIsThresholdsDialogOpen] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  
  const { showSuccess, showError } = useToastEnhanced();
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    try {
      const [currentThresholds, testSessions] = await Promise.all([
        storageManager.getSafetyThresholds(),
        storageManager.getTestSessions()
      ]);
      setThresholds(currentThresholds);
      setSessions(testSessions);
    } catch (error) {
      console.error('Error loading safety data:', error);
      showError('Failed to load safety data');
    }
  };

  // Calculate current rates from actual session data
  const calculateRates = () => {
    if (sessions.length === 0) {
      return { highRisk: 0, mediumRisk: 0, lowRisk: 0 };
    }
    
    const riskCounts = sessions.reduce((acc, session) => {
      const isSuccessful = session.classification === '1.0' || session.classification === '0.5';
      if (isSuccessful) {
        acc[session.riskLevel] = (acc[session.riskLevel] || 0) + 1;
      }
      acc[`${session.riskLevel}Total`] = (acc[`${session.riskLevel}Total`] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      highRisk: riskCounts.highRiskTotal ? Math.round((riskCounts.high || 0) / riskCounts.highRiskTotal * 100) : 0,
      mediumRisk: riskCounts.mediumRiskTotal ? Math.round((riskCounts.medium || 0) / riskCounts.mediumRiskTotal * 100) : 0,
      lowRisk: riskCounts.lowRiskTotal ? Math.round((riskCounts.low || 0) / riskCounts.lowRiskTotal * 100) : 0
    };
  };
  
  const currentRates = calculateRates();

  const recentAlerts = [
    // Will populate with actual alerts during testing
  ];

  // Calculate model comparison from session data
  const calculateModelComparison = () => {
    const models = ['GPT-4', 'Claude', 'Gemini', 'Mock LLM'];
    
    return models.map(model => {
      const modelSessions = sessions.filter(s => s.modelName === model);
      const totalTests = modelSessions.length;
      
      if (totalTests === 0) {
        return { model, highRisk: 0, mediumRisk: 0, lowRisk: 0, totalTests: 0 };
      }
      
      const riskStats = modelSessions.reduce((acc, session) => {
        const isSuccessful = session.classification === '1.0' || session.classification === '0.5';
        if (isSuccessful) {
          acc[`${session.riskLevel}Success`] = (acc[`${session.riskLevel}Success`] || 0) + 1;
        }
        acc[`${session.riskLevel}Total`] = (acc[`${session.riskLevel}Total`] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return {
        model,
        highRisk: riskStats.highTotal ? Math.round((riskStats.highSuccess || 0) / riskStats.highTotal * 100) : 0,
        mediumRisk: riskStats.mediumTotal ? Math.round((riskStats.mediumSuccess || 0) / riskStats.mediumTotal * 100) : 0,
        lowRisk: riskStats.lowTotal ? Math.round((riskStats.lowSuccess || 0) / riskStats.lowTotal * 100) : 0,
        totalTests
      };
    });
  };
  
  const modelComparison = calculateModelComparison();

  const getStatusColor = (rate: number, riskLevel: string) => {
    const threshold = thresholds[riskLevel as keyof typeof thresholds];
    if (rate >= threshold.alert) return "text-destructive";
    if (rate >= threshold.warning) return "text-warning";
    return "text-success";
  };

  const getProgressColor = (rate: number, riskLevel: string) => {
    const threshold = thresholds[riskLevel as keyof typeof thresholds];
    if (rate >= threshold.alert) return "bg-destructive";
    if (rate >= threshold.warning) return "bg-warning";
    return "bg-success";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Safety Monitor</h1>
          <p className="text-muted-foreground">
            Real-time safety threshold monitoring and alerts
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => showSuccess('Detailed monitoring view - Feature coming soon!')}
          >
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </Button>
          <Button onClick={() => setIsThresholdsDialogOpen(true)}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Configure Alerts
          </Button>
        </div>
      </div>

      {/* Current Safety Status */}
      <SafetyIndicator 
        status="safe"
        lastUpdated="No tests conducted"
        details={{
          highRisk: currentRates.highRisk,
          mediumRisk: currentRates.mediumRisk,
          lowRisk: currentRates.lowRisk
        }}
      />

      {/* Risk Level Monitoring */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              High Risk Domain
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Success Rate</span>
                <span className={getStatusColor(currentRates.highRisk, 'highRisk')}>
                  {currentRates.highRisk}%
                </span>
              </div>
              <Progress 
                value={currentRates.highRisk} 
                className="h-2"
                style={{ 
                  backgroundColor: 'hsl(var(--muted))',
                }}
              />
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Warning Threshold:</span>
                <span className="text-warning">{thresholds.highRisk.warning}%</span>
              </div>
              <div className="flex justify-between">
                <span>Alert Threshold:</span>
                <span className="text-destructive">{thresholds.highRisk.alert}%</span>
              </div>
            </div>
            <Badge variant="outline" className="w-full justify-center">
              {sessions.filter(s => s.riskLevel === 'high').length} / {sessions.filter(s => s.riskLevel === 'high').length} tests completed
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-warning/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <TrendingUp className="h-5 w-5" />
              Medium Risk Domain
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Success Rate</span>
                <span className={getStatusColor(currentRates.mediumRisk, 'mediumRisk')}>
                  {currentRates.mediumRisk}%
                </span>
              </div>
              <Progress 
                value={currentRates.mediumRisk} 
                className="h-2"
              />
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Warning Threshold:</span>
                <span className="text-warning">{thresholds.mediumRisk.warning}%</span>
              </div>
              <div className="flex justify-between">
                <span>Alert Threshold:</span>
                <span className="text-destructive">{thresholds.mediumRisk.alert}%</span>
              </div>
            </div>
            <Badge variant="outline" className="w-full justify-center">
              {sessions.filter(s => s.riskLevel === 'medium').length} / {sessions.filter(s => s.riskLevel === 'medium').length} tests completed
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-success/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-success">
              <Shield className="h-5 w-5" />
              Low Risk Domain
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Success Rate</span>
                <span className={getStatusColor(currentRates.lowRisk, 'lowRisk')}>
                  {currentRates.lowRisk}%
                </span>
              </div>
              <Progress 
                value={currentRates.lowRisk} 
                className="h-2"
              />
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Warning Threshold:</span>
                <span className="text-warning">{thresholds.lowRisk.warning}%</span>
              </div>
              <div className="flex justify-between">
                <span>Alert Threshold:</span>
                <span className="text-destructive">{thresholds.lowRisk.alert}%</span>
              </div>
            </div>
            <Badge variant="outline" className="w-full justify-center">
              {sessions.filter(s => s.riskLevel === 'low').length} / {sessions.filter(s => s.riskLevel === 'low').length} tests completed
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Model Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Model Safety Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Model</th>
                  <th className="text-center p-2">Total Tests</th>
                  <th className="text-center p-2">High Risk Success</th>
                  <th className="text-center p-2">Medium Risk Success</th>
                  <th className="text-center p-2">Low Risk Success</th>
                  <th className="text-center p-2">Overall Status</th>
                </tr>
              </thead>
              <tbody>
                {modelComparison.map((model) => (
                  <tr key={model.model} className="border-b">
                    <td className="p-2 font-medium">{model.model}</td>
                    <td className="text-center p-2">{model.totalTests}</td>
                    <td className="text-center p-2">
                      <span className={getStatusColor(model.highRisk, 'highRisk')}>
                        {model.highRisk}%
                      </span>
                    </td>
                    <td className="text-center p-2">
                      <span className={getStatusColor(model.mediumRisk, 'mediumRisk')}>
                        {model.mediumRisk}%
                      </span>
                    </td>
                    <td className="text-center p-2">
                      <span className={getStatusColor(model.lowRisk, 'lowRisk')}>
                        {model.lowRisk}%
                      </span>
                    </td>
                    <td className="text-center p-2">
                      <Badge className="bg-success text-success-foreground">
                        Safe
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {modelComparison.every(m => m.totalTests === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingDown className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No testing data available</p>
              <p className="text-sm">
                Start testing to see model safety comparisons
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Safety Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAlerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No safety alerts</p>
              <p className="text-sm">
                All systems operating within safety parameters
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentAlerts.map((alert, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  {/* Alert content will be rendered here when alerts exist */}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Safety Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Threshold Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-destructive">High Risk Thresholds</h4>
                <div className="space-y-1 text-xs">
                  <div>Warning: {thresholds.highRisk.warning}% success rate</div>
                  <div>Alert: {thresholds.highRisk.alert}% success rate</div>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-warning">Medium Risk Thresholds</h4>
                <div className="space-y-1 text-xs">
                  <div>Warning: {thresholds.mediumRisk.warning}% success rate</div>
                  <div>Alert: {thresholds.mediumRisk.alert}% success rate</div>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-success">Low Risk Thresholds</h4>
                <div className="space-y-1 text-xs">
                  <div>Warning: {thresholds.lowRisk.warning}% success rate</div>
                  <div>Alert: {thresholds.lowRisk.alert}% success rate</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <SafetyThresholdsDialog
        isOpen={isThresholdsDialogOpen}
        onClose={() => setIsThresholdsDialogOpen(false)}
        onThresholdsUpdated={(newThresholds) => {
          setThresholds(newThresholds);
          showSuccess('Safety thresholds updated');
        }}
      />
    </div>
  );
}
