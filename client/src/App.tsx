import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import LanguageSelector from "@/pages/LanguageSelector";
import Login from "@/pages/Login";
import WebLogin from "@/pages/WebLogin";
import Dashboard from "@/pages/Dashboard";
import NewCase from "@/pages/NewCase";
import CaseResult from "@/pages/CaseResult";
import WebDashboard from "@/pages/WebDashboard";
import WebCaseView from "@/pages/WebCaseView";
import Logout from "@/pages/Logout";
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

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={LanguageSelector} />
        <Route path="/login" component={Login} />
        <Route path="/web-login" component={WebLogin} />
        <Route path="/web-dashboard" component={WebLogin} />
        <Route path="/logout" component={Logout} />
        <Route component={LanguageSelector} /> {/* Catch-all for unauthenticated */}
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/case/new" component={NewCase} />
      <Route path="/case/:id" component={CaseResult} />
      <Route path="/web-dashboard" component={WebDashboard} />
      <Route path="/web-case/:id" component={WebCaseView} />
      <Route path="/logout" component={Logout} />
      <Route component={NotFound} /> {/* Catch-all for authenticated */}
    </Switch>
  );
}

function App() {
  // Get the current path to apply specific styling for web dashboard routes
  const [location] = useLocation();
  const isWebRoute = location.startsWith('/web');
  
  return (
    <QueryClientProvider client={queryClient}>
      <div className={`w-full mx-auto min-h-screen ${!isWebRoute ? 'max-w-lg shadow-lg' : ''} relative overflow-hidden`}>
        <Router />
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}

// Apply auth and language providers
export default withLanguage(withAuth(App));
