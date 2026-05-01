import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore, type Role, type OrgMembership } from "@/store/auth";
import { toastError } from "@/lib/toast";

async function loadUserContextOnce(userId: string) {
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

  const hasProfile = !!profileRes.data;
  return { roles, activeTenantId, organizations, hasProfile };
}

// Reintenta para tolerar la latencia del trigger handle_new_user al hacer signup.
// Solo marcamos la cuenta como huérfana si después del grace period seguimos sin
// perfil ni roles.
async function loadUserContext(userId: string) {
  const maxAttempts = 5;
  const delayMs = 400;
  let last = await loadUserContextOnce(userId);
  for (let i = 1; i < maxAttempts; i++) {
    if (last.hasProfile && (last.roles.length > 0 || !!last.activeTenantId)) break;
    await new Promise((r) => setTimeout(r, delayMs));
    last = await loadUserContextOnce(userId);
  }
  const accountValid = last.hasProfile && (last.roles.length > 0 || !!last.activeTenantId);
  return { ...last, accountValid };
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
  const { setSession, setRoles, setOrganizations, setActiveTenantId, setLoading, setContextLoading, reset } = useAuthStore();

  useEffect(() => {
    // 1. Listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setContextLoading(true);
        setTimeout(async () => {
          const ctx = await loadUserContext(session.user.id);
          if (!ctx.accountValid) {
            await forceSignOut(reset);
            setContextLoading(false);
            return;
          }
          setRoles(ctx.roles);
          setOrganizations(ctx.organizations);
          setActiveTenantId(ctx.activeTenantId);
          setContextLoading(false);
        }, 0);
      } else {
        setRoles([]);
        setOrganizations([]);
        setActiveTenantId(null);
        setContextLoading(false);
      }
    });

    // 2. Then check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session?.user) {
        setContextLoading(true);
        loadUserContext(session.user.id).then(async (ctx) => {
          if (!ctx.accountValid) {
            await forceSignOut(reset);
            setContextLoading(false);
            return;
          }
          setRoles(ctx.roles);
          setOrganizations(ctx.organizations);
          setActiveTenantId(ctx.activeTenantId);
          setContextLoading(false);
        });
      } else {
        setContextLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [setSession, setRoles, setOrganizations, setActiveTenantId, setLoading, setContextLoading, reset]);
}

export function useAuth() {
  return useAuthStore();
}