import { create } from "zustand";
import type { User, Session } from "@supabase/supabase-js";

export type Role = "super_admin" | "tenant_admin" | "sales_manager" | "sales_rep";

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: Role[];
  loading: boolean;
  setSession: (session: Session | null) => void;
  setRoles: (roles: Role[]) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  roles: [],
  loading: true,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setRoles: (roles) => set({ roles }),
  setLoading: (loading) => set({ loading }),
  reset: () => set({ user: null, session: null, roles: [] }),
}));