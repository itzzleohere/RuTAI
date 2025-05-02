import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/store/auth";
import LoadingOverlay from "@/components/LoadingOverlay";

export default function Logout() {
  const { logout } = useAuth();
  const [_, navigate] = useLocation();

  useEffect(() => {
    // Clear authentication
    logout();
    
    // Redirect to language selector/login
    navigate("/web-login");
  }, [logout, navigate]);

  return <LoadingOverlay message="Logging out..." />;
}