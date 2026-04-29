import { create } from "zustand";
import type { User, Session } from "@supabase/supabase-js";

export type Role =
  | "platform_owner"
  | "platform_staff"
  | "org_owner"
  | "org_member"
  | "tenant_owner"
  | "tenant_admin"
  | "sales_manager"
  | "sales_rep"
  // Deprecated alias kept for backward compatibility while migrating
  | "super_admin";

export interface OrgMembership {
  organization_id: string;
  organization_name: string;
  role: "org_owner" | "org_member";
}

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: Role[];
  organizations: OrgMembership[];
  activeTenantId: string | null;
  loading: boolean;
  setSession: (session: Session | null) => void;
  setRoles: (roles: Role[]) => void;
  setOrganizations: (orgs: OrgMembership[]) => void;
  setActiveTenantId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  roles: [],
  organizations: [],
  activeTenantId: null,
  loading: true,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setRoles: (roles) => set({ roles }),
  setOrganizations: (organizations) => set({ organizations }),
  setActiveTenantId: (activeTenantId) => set({ activeTenantId }),
  setLoading: (loading) => set({ loading }),
  reset: () => set({ user: null, session: null, roles: [], organizations: [], activeTenantId: null }),
}));