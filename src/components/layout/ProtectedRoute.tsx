import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/walix/LoadingSpinner";
import type { Role } from "@/store/auth";

interface Props {
  children: React.ReactNode;
  requireRoles?: Role[];
}

export function ProtectedRoute({ children, requireRoles }: Props) {
  const { user, roles, loading, contextLoading, activeTenantId } = useAuth();
  const location = useLocation();

  if (loading || (user && contextLoading)) {
    return (
      <div className="min-h-screen grid place-items-center">
        <LoadingSpinner label="Cargando..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Sesión huérfana: token válido pero sin perfil/roles/tenant en BD.
  // El hook useInitAuth ya disparó signOut(); mientras tanto, no permitir entrar.
  if (roles.length === 0 && !activeTenantId) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireRoles && requireRoles.length > 0) {
    const hasRole = requireRoles.some((r) => roles.includes(r));
    if (!hasRole) return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}