import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/walix/LoadingSpinner";

export default function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen grid place-items-center"><LoadingSpinner label="Cargando Walix.ai..." /></div>;
  }
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}