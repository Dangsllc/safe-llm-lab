import { SidebarTrigger } from "@/components/ui/sidebar";
import { Shield, AlertTriangle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type SafetyStatus = "safe" | "warning" | "alert";

export function Header() {
  // Initial safety status - Green (no tests conducted yet)
  const safetyStatus: SafetyStatus = "safe";
  
  const getStatusConfig = (status: SafetyStatus) => {
    switch (status) {
      case "safe":
        return {
          icon: CheckCircle,
          label: "Safe",
          variant: "default" as const,
          className: "bg-success text-success-foreground"
        };
      case "warning":
        return {
          icon: AlertTriangle,
          label: "Warning",
          variant: "destructive" as const,
          className: "bg-warning text-warning-foreground"
        };
      case "alert":
        return {
          icon: Shield,
          label: "Alert",
          variant: "destructive" as const,
          className: "bg-destructive text-destructive-foreground"
        };
      default:
        return {
          icon: CheckCircle,
          label: "Safe",
          variant: "default" as const,
          className: "bg-success text-success-foreground"
        };
    }
  };

  const statusConfig = getStatusConfig(safetyStatus);
  const StatusIcon = statusConfig.icon;

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">LLM Safety Research Platform</h1>
            <p className="text-sm text-muted-foreground">Data Collection & Analysis Tool</p>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <Badge className={statusConfig.className}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {statusConfig.label}
        </Badge>
        <div className="text-sm text-muted-foreground">
          Ready to begin research
        </div>
      </div>
    </header>
  );
}