import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Safe imports that won't cause circular dependencies
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Lazy load the complex pages to avoid initialization issues
const PromptLibrary = React.lazy(() => import("./pages/PromptLibrary"));
const TestingInterface = React.lazy(() => import("./pages/TestingInterface"));
const SafetyMonitor = React.lazy(() => import("./pages/SafetyMonitor"));
const Results = React.lazy(() => import("./pages/Results"));
const DataManagement = React.lazy(() => import("./pages/DataManagement"));

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Layout>
            <React.Suspense fallback={
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            }>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/prompts" element={<PromptLibrary />} />
                <Route path="/testing" element={<TestingInterface />} />
                <Route path="/safety" element={<SafetyMonitor />} />
                <Route path="/results" element={<Results />} />
                <Route path="/data" element={<DataManagement />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </React.Suspense>
          </Layout>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
