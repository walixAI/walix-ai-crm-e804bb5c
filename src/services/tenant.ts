import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/store/auth";

export interface Tenant {
  id: string;
  name: string;
  plan: string;
  status: "active" | "suspended";
  locale: string;
  timezone: string;
  currency: string;
  logo_url: string | null;
  brand_primary: string | null;
  brand_name: string | null;
  mrr: number;
  nps: number | null;
  created_at: string;
}

export interface Member {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  roles: Role[];
  created_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
}

export async function fetchTenant(id: string): Promise<Tenant | null> {
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Tenant) ?? null;
}

export async function updateTenant(id: string, patch: Partial<Tenant>) {
  const { data, error } = await supabase
    .from("tenants")
    .update(patch as never)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Tenant;
}

export async function fetchMembers(tenantId: string): Promise<Member[]> {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, is_active, last_seen_at, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const ids = (profiles ?? []).map((p) => p.id);
  if (ids.length === 0) return [];

  const { data: rolesRows } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", ids);

  const rolesByUser = new Map<string, Role[]>();
  (rolesRows ?? []).forEach((r) => {
    const arr = rolesByUser.get(r.user_id) ?? [];
    arr.push(r.role as Role);
    rolesByUser.set(r.user_id, arr);
  });

  return (profiles ?? []).map((p) => ({
    ...p,
    roles: rolesByUser.get(p.id) ?? [],
  })) as Member[];
}

export async function setMemberActive(userId: string, active: boolean) {
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: active })
    .eq("id", userId);
  if (error) throw error;
}

export async function fetchInvitations(tenantId: string): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from("invitations")
    .select("id, email, role, status, expires_at, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Invitation[];
}

export async function createInvitation(input: {
  tenantId: string;
  email: string;
  role: Role;
  invitedBy: string;
}) {
  const { data, error } = await supabase
    .from("invitations")
    .insert({
      tenant_id: input.tenantId,
      email: input.email.toLowerCase().trim(),
      role: input.role,
      invited_by: input.invitedBy,
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Invitation;
}

export async function revokeInvitation(id: string) {
  const { error } = await supabase
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", id);
  if (error) throw error;
}

export async function uploadTenantLogo(tenantId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${tenantId}/logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("tenant-assets")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (error) throw error;
  const { data } = await supabase.storage
    .from("tenant-assets")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? path;
}