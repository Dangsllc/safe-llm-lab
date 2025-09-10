import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

// Safe imports that won't cause circular dependencies
import { Layout } from "./components/Layout";
import { PageLoader } from "./components/LoadingSpinner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import AdminRoute from "./components/auth/AdminRoute";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Lazy load the complex pages to avoid initialization issues
const PromptLibrary = React.lazy(() => import("./pages/PromptLibrary"));
const TestingInterface = React.lazy(() => import("./pages/TestingInterface"));
const SafetyMonitor = React.lazy(() => import("./pages/SafetyMonitor"));
const Results = React.lazy(() => import("./pages/Results"));
const DataManagement = React.lazy(() => import("./pages/DataManagement"));
const AdminDashboard = React.lazy(() => import("./pages/admin/AdminDashboard"));

// Lite version without authentication and backend dependencies
const LiteApp = () => {
  return (
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
  );
};

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const [initialCheck, setInitialCheck] = React.useState(true);

  React.useEffect(() => {
    // After the first check, we can start redirecting if needed
    const timer = setTimeout(() => setInitialCheck(false), 100);
    return () => clearTimeout(timer);
  }, []);

  // Show loading state only during initial check
  if (initialCheck || isLoading) {
    return <PageLoader text="Checking authentication..." />;
  }

  // Only redirect to login if we're sure the user is not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: window.location.pathname }} />;
  }

  return <>{children}</>;
};

// Main App with authentication
const AuthenticatedApp = () => {
  return (
    <ProtectedRoute>
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
    </ProtectedRoute>
  );
};

// Login page component
const LoginPage = () => {
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = React.useState('test@example.com'); // Pre-fill for testing
  const [password, setPassword] = React.useState('password'); // Pre-fill for testing
  const [error, setError] = React.useState('');
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // If already authenticated, redirect to the home page or the originally requested page
  React.useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setError('');
    setIsLoggingIn(true);
    
    try {
      const result = await login({ email, password });
      if (!result.success) {
        setError(result.error || 'Login failed. Please check your credentials.');
      } else {
        // The useEffect will handle the redirect when isAuthenticated becomes true
        console.log('Login successful, redirecting...');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">Email address</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoggingIn}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${isLoggingIn ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
            >
              {isLoggingIn ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </>
              ) : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route 
                  path="/admin" 
                  element={
                    <React.Suspense fallback={<PageLoader text="Loading admin dashboard..." />}>
                      <AdminRoute>
                        <AdminDashboard />
                      </AdminRoute>
                    </React.Suspense>
                  } 
                />
                <Route path="/*" element={<AuthenticatedApp />} />
              </Routes>
              <Toaster />
              <Sonner />
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
