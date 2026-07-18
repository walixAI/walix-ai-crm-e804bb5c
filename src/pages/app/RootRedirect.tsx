import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/walix/LoadingSpinner";
import { useMyProfile } from "@/lib/queries/profile";

export default function RootRedirect() {
  const { user, loading } = useAuth();
  const { data: profile, isLoading: pLoading } = useMyProfile();
  if (loading || (user && pLoading)) {
    return <div className="min-h-screen grid place-items-center"><LoadingSpinner label="Cargando Walix.ai..." /></div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  const mode = (profile as any)?.ui_prefs?.mode;
  return <Navigate to={mode === "simple" ? "/mi-dia" : "/dashboard"} replace />;
}