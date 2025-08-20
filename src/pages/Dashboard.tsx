import { BarChart3, TestTube, AlertTriangle, TrendingUp } from "lucide-react";
import { StatusCard } from "@/components/StatusCard";
import { SafetyIndicator } from "@/components/SafetyIndicator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

  // Initial empty state - no research conducted yet
  const stats = {
    totalTests: 0,
    flaggedResponses: 0,
    completionRate: 0,
    safetyScore: 100
  };

  const modelProgress = {
    "GPT-4": 0,
    "Claude": 0,
    "Gemini": 0
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Research Dashboard</h1>
          <p className="text-muted-foreground">
            LLM Safety Research Data Collection Platform
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/prompts")} variant="outline">
            Manage Prompts
          </Button>
          <Button onClick={() => navigate("/testing")}>
            Start Testing
          </Button>
        </div>
      </div>

      {/* Safety Status */}
      <SafetyIndicator 
        status="safe" 
        lastUpdated="No tests conducted"
        details={{
          highRisk: 0,
          mediumRisk: 0,
          lowRisk: 0
        }}
      />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard
          title="Total Tests"
          value={stats.totalTests}
          subtitle="across all models"
          icon={TestTube}
        />
        <StatusCard
          title="Flagged Responses"
          value={stats.flaggedResponses}
          subtitle="safety concerns"
          icon={AlertTriangle}
          className="border-warning/20"
        />
        <StatusCard
          title="Completion Rate"
          value={`${stats.completionRate}%`}
          subtitle="of planned 486 tests"
          icon={TrendingUp}
        />
        <StatusCard
          title="Safety Score"
          value={`${stats.safetyScore}%`}
          subtitle="overall compliance"
          icon={BarChart3}
          className="border-success/20"
        />
      </div>

      {/* Model Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Model Testing Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(modelProgress).map(([model, progress]) => (
              <div key={model} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{model}</span>
                  <span className="text-muted-foreground">{progress}% complete</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            ))}
            <div className="pt-2 text-xs text-muted-foreground">
              Target: 162 tests per model (486 total)
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <TestTube className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No testing activity yet</p>
              <p className="text-sm">
                Begin systematic testing to see real-time progress
              </p>
              <Button 
                className="mt-4" 
                onClick={() => navigate("/testing")}
                size="sm"
              >
                Start First Test
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              className="h-20 flex-col gap-2"
              onClick={() => navigate("/prompts")}
            >
              <TestTube className="h-5 w-5" />
              <span>Review Prompt Templates</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex-col gap-2"
              onClick={() => navigate("/testing")}
            >
              <BarChart3 className="h-5 w-5" />
              <span>Begin Testing</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex-col gap-2"
              onClick={() => navigate("/safety")}
            >
              <AlertTriangle className="h-5 w-5" />
              <span>Safety Monitor</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}