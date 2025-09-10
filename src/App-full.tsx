import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Authentication and context providers
import { AuthProvider } from "./contexts/AuthContext";
import { StudyProvider } from "./contexts/StudyContext";
import { AuthPage } from "./components/auth/AuthPage";
import { useAuth } from "./contexts/AuthContext";

// Safe imports that won't cause circular dependencies
import { Layout } from "./components/Layout";
import { PageLoader } from "./components/LoadingSpinner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Lazy load the complex pages to avoid initialization issues
const PromptLibrary = React.lazy(() => import("./pages/PromptLibrary"));
const TestingInterface = React.lazy(() => import("./pages/TestingInterface"));
const SafetyMonitor = React.lazy(() => import("./pages/SafetyMonitor"));
const Results = React.lazy(() => import("./pages/Results"));
const DataManagement = React.lazy(() => import("./pages/DataManagement"));

// Protected routes component
const ProtectedApp = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader text="Initializing secure session..." />;
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <StudyProvider>
      <Layout>
        <React.Suspense fallback={<PageLoader text="Loading page..." />}>
          <ErrorBoundary fallback={
            <div className="p-6">
              <PageLoader text="Error loading page content" />
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
          </ErrorBoundary>
        </React.Suspense>
      </Layout>
    </StudyProvider>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            <AuthProvider>
              <ProtectedApp />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
