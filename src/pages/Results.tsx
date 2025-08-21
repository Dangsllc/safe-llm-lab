import { useState, useEffect } from "react";
import { BarChart3, Download, Filter, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToastEnhanced } from "@/hooks/use-toast-enhanced";
import { storageManager } from "@/lib/storage/storage-manager";
import { exportToJSON, exportSessionsToCSV, generateStatisticalReport, generateResearchSummary } from "@/lib/export-utils";
import { TestSession, PromptTemplate } from "@/lib/storage/types";

export default function Results() {
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const { showSuccess, showError, showLoading, dismissToast } = useToastEnhanced();
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [testSessions, promptTemplates] = await Promise.all([
        storageManager.getTestSessions(),
        storageManager.getPromptTemplates()
      ]);
      setSessions(testSessions);
      setTemplates(promptTemplates);
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Failed to load research data');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Calculate summary statistics from actual data
  const summaryStats = {
    totalTests: sessions.length,
    singleShotTests: sessions.filter(s => {
      const template = templates.find(t => t.title === s.promptTemplate);
      return !template?.shots || template.shots === 1;
    }).length,
    multiShotTests: sessions.filter(s => {
      const template = templates.find(t => t.title === s.promptTemplate);
      return template?.shots && template.shots > 1;
    }).length,
    avgSuccessRate: sessions.length > 0 ? Math.round(
      sessions.filter(s => s.classification === '1.0' || s.classification === '0.5').length / sessions.length * 100
    ) : 0,
    flaggedResponses: sessions.filter(s => s.classification === '1.0' || s.classification === '0.5').length
  };

  // Calculate model results from session data
  const calculateModelResults = () => {
    const models = ['GPT-4', 'Claude', 'Gemini', 'Mock LLM'];
    
    return models.map(model => {
      const modelSessions = sessions.filter(s => s.modelName === model);
      const tests = modelSessions.length;
      
      if (tests === 0) {
        return { model, singleShot: 0, multiShot: 0, overall: 0, tests: 0 };
      }
      
      const singleShotSessions = modelSessions.filter(s => {
        const template = templates.find(t => t.title === s.promptTemplate);
        return !template?.shots || template.shots === 1;
      });
      
      const multiShotSessions = modelSessions.filter(s => {
        const template = templates.find(t => t.title === s.promptTemplate);
        return template?.shots && template.shots > 1;
      });
      
      const singleShotSuccess = singleShotSessions.filter(s => s.classification === '1.0' || s.classification === '0.5').length;
      const multiShotSuccess = multiShotSessions.filter(s => s.classification === '1.0' || s.classification === '0.5').length;
      const overallSuccess = modelSessions.filter(s => s.classification === '1.0' || s.classification === '0.5').length;
      
      return {
        model,
        singleShot: singleShotSessions.length > 0 ? Math.round(singleShotSuccess / singleShotSessions.length * 100) : 0,
        multiShot: multiShotSessions.length > 0 ? Math.round(multiShotSuccess / multiShotSessions.length * 100) : 0,
        overall: Math.round(overallSuccess / tests * 100),
        tests
      };
    });
  };
  
  const modelResults = calculateModelResults();

  // Calculate technique comparison from session data
  const calculateTechniqueComparison = () => {
    const techniques = ["Direct", "Role-Playing", "Gradual Escalation", "Context Manipulation", "Instruction Obfuscation"];
    
    return techniques.map(technique => {
      const techniqueSessions = sessions.filter(s => {
        const template = templates.find(t => t.title === s.promptTemplate);
        return template?.category === technique;
      });
      
      const total = techniqueSessions.length;
      
      if (total === 0) {
        return { technique, highRisk: 0, mediumRisk: 0, lowRisk: 0, total: 0 };
      }
      
      const riskStats = techniqueSessions.reduce((acc, session) => {
        const isSuccessful = session.classification === '1.0' || session.classification === '0.5';
        if (isSuccessful) {
          acc[`${session.riskLevel}Success`] = (acc[`${session.riskLevel}Success`] || 0) + 1;
        }
        acc[`${session.riskLevel}Total`] = (acc[`${session.riskLevel}Total`] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return {
        technique,
        highRisk: riskStats.highTotal ? Math.round((riskStats.highSuccess || 0) / riskStats.highTotal * 100) : 0,
        mediumRisk: riskStats.mediumTotal ? Math.round((riskStats.mediumSuccess || 0) / riskStats.mediumTotal * 100) : 0,
        lowRisk: riskStats.lowTotal ? Math.round((riskStats.lowSuccess || 0) / riskStats.lowTotal * 100) : 0,
        total
      };
    });
  };
  
  const techniqueComparison = calculateTechniqueComparison();
  
  const handleExportCSV = async () => {
    const loadingToast = showLoading('Exporting CSV...');
    try {
      await exportSessionsToCSV();
      dismissToast(loadingToast);
      showSuccess('CSV export completed successfully');
    } catch (error) {
      dismissToast(loadingToast);
      showError('Export failed: ' + (error as Error).message);
    }
  };
  
  const handleExportJSON = async () => {
    const loadingToast = showLoading('Exporting JSON...');
    try {
      await exportToJSON();
      dismissToast(loadingToast);
      showSuccess('JSON export completed successfully');
    } catch (error) {
      dismissToast(loadingToast);
      showError('Export failed: ' + (error as Error).message);
    }
  };
  
  const handleGenerateReport = async () => {
    const loadingToast = showLoading('Generating statistical report...');
    try {
      await generateStatisticalReport();
      dismissToast(loadingToast);
      showSuccess('Statistical report generated successfully');
    } catch (error) {
      dismissToast(loadingToast);
      showError('Report generation failed: ' + (error as Error).message);
    }
  };
  
  const handleGenerateSummary = async () => {
    const loadingToast = showLoading('Generating research summary...');
    try {
      await generateResearchSummary();
      dismissToast(loadingToast);
      showSuccess('Research summary generated successfully');
    } catch (error) {
      dismissToast(loadingToast);
      showError('Summary generation failed: ' + (error as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Research Results</h1>
          <p className="text-muted-foreground">
            Analysis and visualization of LLM safety research findings
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => showSuccess('Filter functionality - Feature coming soon!')}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filter Results
          </Button>
          <Button onClick={handleExportJSON}>
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">{summaryStats.totalTests}</div>
            <div className="text-sm text-muted-foreground">Total Tests</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{summaryStats.singleShotTests}</div>
            <div className="text-sm text-muted-foreground">Single-Shot</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-accent">{summaryStats.multiShotTests}</div>
            <div className="text-sm text-muted-foreground">Multi-Shot</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-warning">{summaryStats.avgSuccessRate}%</div>
            <div className="text-sm text-muted-foreground">Avg Success Rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-destructive">{summaryStats.flaggedResponses}</div>
            <div className="text-sm text-muted-foreground">Flagged Responses</div>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="models">Model Comparison</TabsTrigger>
          <TabsTrigger value="techniques">Technique Analysis</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Single-Shot vs Multi-Shot Effectiveness</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center py-12 text-muted-foreground">
                    <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No comparison data available</p>
                    <p className="text-sm">
                      Data will appear here once testing begins
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Risk Domain Success Rates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center py-12 text-muted-foreground">
                    <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No risk analysis available</p>
                    <p className="text-sm">
                      Risk domain data will populate with test results
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Performance Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Model</th>
                      <th className="text-center p-3">Total Tests</th>
                      <th className="text-center p-3">Single-Shot Success</th>
                      <th className="text-center p-3">Multi-Shot Success</th>
                      <th className="text-center p-3">Overall Success</th>
                      <th className="text-center p-3">Safety Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelResults.map((model) => (
                      <tr key={model.model} className="border-b">
                        <td className="p-3 font-medium">{model.model}</td>
                        <td className="text-center p-3">{model.tests}</td>
                        <td className="text-center p-3">{model.singleShot}%</td>
                        <td className="text-center p-3">{model.multiShot}%</td>
                        <td className="text-center p-3">{model.overall}%</td>
                        <td className="text-center p-3">
                          <Badge className="bg-success text-success-foreground">
                            Safe
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {modelResults.every(m => m.tests === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No model comparison data</p>
                  <p className="text-sm">
                    Complete tests across different models to see comparisons
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="techniques" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Technique Effectiveness by Risk Domain</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Technique</th>
                      <th className="text-center p-3">Total Tests</th>
                      <th className="text-center p-3">High Risk Success</th>
                      <th className="text-center p-3">Medium Risk Success</th>
                      <th className="text-center p-3">Low Risk Success</th>
                    </tr>
                  </thead>
                  <tbody>
                    {techniqueComparison.map((technique) => (
                      <tr key={technique.technique} className="border-b">
                        <td className="p-3 font-medium">{technique.technique}</td>
                        <td className="text-center p-3">{technique.total}</td>
                        <td className="text-center p-3">
                          <span className="text-destructive">{technique.highRisk}%</span>
                        </td>
                        <td className="text-center p-3">
                          <span className="text-warning">{technique.mediumRisk}%</span>
                        </td>
                        <td className="text-center p-3">
                          <span className="text-success">{technique.lowRisk}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {techniqueComparison.every(t => t.total === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No technique analysis data</p>
                  <p className="text-sm">
                    Test different prompt techniques to see effectiveness analysis
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Success Rate Trends Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No trend data available</p>
                  <p className="text-sm">
                    Trends will appear as research progresses
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Response Classification Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No classification data</p>
                  <p className="text-sm">
                    Response classifications will be visualized here
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle>Data Export</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              className="h-20 flex-col gap-2"
              onClick={handleExportCSV}
              disabled={sessions.length === 0}
            >
              <Download className="h-5 w-5" />
              <div className="text-center">
                <div className="font-medium">CSV Export</div>
                <div className="text-xs text-muted-foreground">Raw data for analysis</div>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex-col gap-2"
              onClick={handleGenerateReport}
              disabled={sessions.length === 0}
            >
              <BarChart3 className="h-5 w-5" />
              <div className="text-center">
                <div className="font-medium">Statistical Report</div>
                <div className="text-xs text-muted-foreground">Formatted analysis</div>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex-col gap-2"
              onClick={handleGenerateSummary}
              disabled={sessions.length === 0}
            >
              <TrendingUp className="h-5 w-5" />
              <div className="text-center">
                <div className="font-medium">Research Summary</div>
                <div className="text-xs text-muted-foreground">Executive overview</div>
              </div>
            </Button>
          </div>
          
          <div className="mt-4 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
            Export functionality will be available once research data is collected. 
            Data will be formatted for statistical analysis software.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}