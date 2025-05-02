import { Switch, Route } from "wouter";
import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import LanguageSelector from "@/pages/LanguageSelector";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import NewCase from "@/pages/NewCase";
import CaseResult from "@/pages/CaseResult";
import WebDashboard from "@/pages/WebDashboard";
import { queryClient } from "./lib/queryClient";
import { useAuth } from "./store/auth.tsx";
import { withAuth } from "./store/auth.tsx";
import { withLanguage } from "./lib/i18n.tsx";
import LoadingOverlay from "./components/LoadingOverlay";

function Router() {
  const { isAuthenticated, loading, checkAuth } = useAuth();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (loading) {
    return <LoadingOverlay message="Loading application..." />;
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <>
          <Route path="/" component={LanguageSelector} />
          <Route path="/login" component={Login} />
        </>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/case/new" component={NewCase} />
          <Route path="/case/:id" component={CaseResult} />
          <Route path="/web-dashboard" component={WebDashboard} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-lg relative overflow-hidden">
        <Router />
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}

// Apply auth and language providers
export default withLanguage(withAuth(App));
