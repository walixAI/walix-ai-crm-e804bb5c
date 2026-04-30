import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore, type Role, type OrgMembership } from "@/store/auth";
import { toastError } from "@/lib/toast";

async function loadUserContext(userId: string) {
  const [rolesRes, profileRes, membershipsRes] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("profiles").select("active_tenant_id, tenant_id").eq("id", userId).maybeSingle(),
    supabase
      .from("organization_members")
      .select("organization_id, role, organizations(name)")
      .eq("user_id", userId),
  ]);

  const roles = (rolesRes.data ?? []).map((r) => r.role as Role);
  const activeTenantId =
    profileRes.data?.active_tenant_id ?? profileRes.data?.tenant_id ?? null;
  const organizations: OrgMembership[] = (membershipsRes.data ?? []).map((m: any) => ({
    organization_id: m.organization_id,
    organization_name: m.organizations?.name ?? "Mi organización",
    role: m.role,
  }));

  // Cuenta huérfana: sin perfil, sin tenant y sin roles → la cuenta fue
  // borrada o revocada en backend mientras el JWT seguía vigente en el cliente.
  const accountValid = !!profileRes.data && (roles.length > 0 || !!activeTenantId);

  return { roles, activeTenantId, organizations, accountValid };
}

async function forceSignOut(reset: () => void) {
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore
  }
  reset();
  toastError(
    "Tu cuenta ya no está disponible",
    "La sesión fue cerrada. Si crees que es un error, contacta a tu administrador."
  );
}

export function useInitAuth() {
  const { setSession, setRoles, setOrganizations, setActiveTenantId, setLoading, reset } = useAuthStore();

  useEffect(() => {
    // 1. Listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setTimeout(async () => {
          const ctx = await loadUserContext(session.user.id);
          if (!ctx.accountValid) {
            await forceSignOut(reset);
            return;
          }
          setRoles(ctx.roles);
          setOrganizations(ctx.organizations);
          setActiveTenantId(ctx.activeTenantId);
        }, 0);
      } else {
        setRoles([]);
        setOrganizations([]);
        setActiveTenantId(null);
      }
    });

    // 2. Then check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session?.user) {
        loadUserContext(session.user.id).then(async (ctx) => {
          if (!ctx.accountValid) {
            await forceSignOut(reset);
            return;
          }
          setRoles(ctx.roles);
          setOrganizations(ctx.organizations);
          setActiveTenantId(ctx.activeTenantId);
        });
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [setSession, setRoles, setOrganizations, setActiveTenantId, setLoading, reset]);
}

export function useAuth() {
  return useAuthStore();
}