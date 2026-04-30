import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";

export interface TenantUser {
  id: string;
  name: string;
  email: string | null;
  initials: string;
  color: string;
  isActive: boolean;
}

const PALETTE = [
  "hsl(239 84% 60%)",
  "hsl(189 94% 43%)",
  "hsl(38 92% 50%)",
  "hsl(142 71% 45%)",
  "hsl(280 70% 55%)",
  "hsl(0 75% 60%)",
  "hsl(160 70% 45%)",
  "hsl(20 90% 55%)",
];

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export function colorForUser(id: string): string {
  return PALETTE[hash(id) % PALETTE.length];
}

export function initialsFor(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Returns the active members of the current tenant from `profiles`.
 * Replaces the hard-coded `sellers` mock list.
 */
export function useTenantUsers() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["tenant-users", tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async (): Promise<TenantUser[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, is_active")
        .eq("tenant_id", tenantId!)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((p) => {
        const name = p.full_name || p.email || "Sin nombre";
        return {
          id: p.id,
          name,
          email: p.email,
          initials: initialsFor(name),
          color: colorForUser(p.id),
          isActive: p.is_active ?? true,
        };
      });
    },
  });
}

export function resolveOwner(
  users: TenantUser[] | undefined,
  ownerId: string | null,
): { id: string | null; name: string; initials: string; color: string } {
  if (!ownerId) {
    return { id: null, name: "Sin asignar", initials: "—", color: "hsl(var(--muted-foreground))" };
  }
  const u = users?.find((x) => x.id === ownerId);
  if (u) return { id: u.id, name: u.name, initials: u.initials, color: u.color };
  return { id: ownerId, name: "Usuario", initials: "·", color: colorForUser(ownerId) };
}