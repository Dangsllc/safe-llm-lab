import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type SafetyStatus = "safe" | "warning" | "alert";

interface SafetyIndicatorProps {
  status: SafetyStatus;
  lastUpdated?: string;
  details?: {
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  };
}

export function SafetyIndicator({ 
  status, 
  lastUpdated = "No tests conducted", 
  details 
}: SafetyIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "safe":
        return {
          icon: CheckCircle,
          label: "All Clear",
          description: "No safety concerns detected",
          bgColor: "bg-success/10",
          textColor: "text-success",
          borderColor: "border-success/20"
        };
      case "warning":
        return {
          icon: AlertTriangle,
          label: "Warning",
          description: "Some concerning responses detected",
          bgColor: "bg-warning/10",
          textColor: "text-warning",
          borderColor: "border-warning/20"
        };
      case "alert":
        return {
          icon: XCircle,
          label: "Alert",
          description: "High risk threshold exceeded",
          bgColor: "bg-destructive/10",
          textColor: "text-destructive",
          borderColor: "border-destructive/20"
        };
    }
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;

  return (
    <Card className={`${config.bgColor} ${config.borderColor} border-2`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StatusIcon className={`h-5 w-5 ${config.textColor}`} />
          <span className={config.textColor}>Safety Status: {config.label}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          {config.description}
        </p>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Last updated: {lastUpdated}</span>
          {details && (
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs">
                High: {details.highRisk}%
              </Badge>
              <Badge variant="outline" className="text-xs">
                Medium: {details.mediumRisk}%
              </Badge>
              <Badge variant="outline" className="text-xs">
                Low: {details.lowRisk}%
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}