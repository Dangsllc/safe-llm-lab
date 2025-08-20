import { Database, Download, Upload, Search, Trash2, Archive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DataManagement() {
  // Initial empty state - database ready for research data
  const databaseStats = {
    totalSessions: 0,
    totalResponses: 0,
    flaggedItems: 0,
    dataSize: "0 MB",
    lastBackup: "Never"
  };

  const recentSessions = [
    // Will populate with actual test sessions during research
  ];

  const backupHistory = [
    // Will populate with backup records
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Data Management</h1>
          <p className="text-muted-foreground">
            Secure storage, backup, and export of research data
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import Data
          </Button>
          <Button>
            <Archive className="h-4 w-4 mr-2" />
            Create Backup
          </Button>
        </div>
      </div>

      {/* Database Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-foreground">{databaseStats.totalSessions}</div>
              <div className="text-sm text-muted-foreground">Test Sessions</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-primary">{databaseStats.totalResponses}</div>
              <div className="text-sm text-muted-foreground">LLM Responses</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-warning">{databaseStats.flaggedItems}</div>
              <div className="text-sm text-muted-foreground">Flagged Items</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-accent">{databaseStats.dataSize}</div>
              <div className="text-sm text-muted-foreground">Storage Used</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-muted-foreground">{databaseStats.lastBackup}</div>
              <div className="text-sm text-muted-foreground">Last Backup</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Management Tabs */}
      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sessions">Test Sessions</TabsTrigger>
          <TabsTrigger value="responses">Response Data</TabsTrigger>
          <TabsTrigger value="export">Export Tools</TabsTrigger>
          <TabsTrigger value="backup">Backup & Security</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Test Session Records</CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search sessions..." className="pl-10 w-64" />
                  </div>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Cleanup
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {recentSessions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Database className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No test sessions recorded</p>
                  <p className="text-sm">
                    Session data will appear here as testing progresses
                  </p>
                  <Button className="mt-4" variant="outline">
                    Start Testing
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Session records will be rendered here */}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="responses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Response Database</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Database className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No response data stored</p>
                <p className="text-sm">
                  LLM responses will be securely stored here for analysis
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Export Tools</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Button variant="outline" className="h-24 flex-col gap-2" disabled>
                  <Download className="h-6 w-6" />
                  <div className="text-center">
                    <div className="font-medium">CSV Export</div>
                    <div className="text-xs text-muted-foreground">Raw session data</div>
                  </div>
                </Button>
                <Button variant="outline" className="h-24 flex-col gap-2" disabled>
                  <Download className="h-6 w-6" />
                  <div className="text-center">
                    <div className="font-medium">JSON Export</div>
                    <div className="text-xs text-muted-foreground">Structured data</div>
                  </div>
                </Button>
                <Button variant="outline" className="h-24 flex-col gap-2" disabled>
                  <Download className="h-6 w-6" />
                  <div className="text-center">
                    <div className="font-medium">Statistical Package</div>
                    <div className="text-xs text-muted-foreground">R/SPSS ready</div>
                  </div>
                </Button>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Export Configuration</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Include metadata</span>
                    <Badge variant="outline">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Anonymize responses</span>
                    <Badge variant="outline">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Timestamp format</span>
                    <Badge variant="outline">ISO 8601</Badge>
                  </div>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">Export will include:</p>
                <ul className="space-y-1 ml-4">
                  <li>• Prompt text and variables</li>
                  <li>• Model responses and classifications</li>
                  <li>• Timestamps and session metadata</li>
                  <li>• Safety flags and risk assessments</li>
                  <li>• Researcher notes and observations</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Backup Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Button className="w-full justify-start" variant="outline">
                    <Archive className="h-4 w-4 mr-2" />
                    Create Full Backup
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download Latest Backup
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Restore from Backup
                  </Button>
                </div>

                <div className="p-3 bg-muted rounded-lg text-sm">
                  <div className="font-medium mb-1">Backup Schedule</div>
                  <div className="text-muted-foreground">
                    Automatic backups: Disabled (no data yet)
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Data encryption</span>
                    <Badge className="bg-success text-success-foreground">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Access logging</span>
                    <Badge className="bg-success text-success-foreground">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Auto-logout</span>
                    <Badge variant="outline">30 minutes</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Password protection</span>
                    <Badge className="bg-success text-success-foreground">Required</Badge>
                  </div>
                </div>

                <div className="p-3 bg-muted rounded-lg text-sm">
                  <div className="font-medium mb-1">Data Retention</div>
                  <div className="text-muted-foreground">
                    Research data will be retained indefinitely for analysis
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Backup History</CardTitle>
            </CardHeader>
            <CardContent>
              {backupHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Archive className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No backups created yet</p>
                  <p className="text-sm">
                    Backup history will appear here once backups are created
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Backup records will be rendered here */}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}