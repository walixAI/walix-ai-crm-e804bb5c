import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/walix/LoadingSpinner";
import type { Role } from "@/store/auth";

interface Props {
  children: React.ReactNode;
  requireRoles?: Role[];
}

export function ProtectedRoute({ children, requireRoles }: Props) {
  const { user, roles, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <LoadingSpinner label="Cargando..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireRoles && requireRoles.length > 0) {
    const hasRole = requireRoles.some((r) => roles.includes(r));
    if (!hasRole) return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}