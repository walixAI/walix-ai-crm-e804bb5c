import { supabase } from "@/integrations/supabase/client";

export interface AIUserProfile {
  user_id: string;
  tenant_id: string;
  communication_style: "formal" | "casual" | "muy_casual";
  preferred_message_length: "short" | "medium" | "long";
  best_close_day: string | null;
  best_close_hour: number | null;
  avg_response_time_hours: number | null;
  top_performing_stage: string | null;
  close_rate: number;
  total_deals_closed: number;
  total_deals_lost: number;
  strengths: string[];
  improvement_areas: string[];
  custom_instructions: string;
  notify_only_work_hours: boolean;
  notify_digest_9am: boolean;
  allow_auto_tasks: boolean;
  weekly_coaching_report: boolean;
  updated_at: string;
}

export async function getMyAIProfile(): Promise<AIUserProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("ai_user_profile")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as AIUserProfile | null) ?? null;
}

export async function updateMyAIProfile(patch: Partial<AIUserProfile>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { error } = await supabase
    .from("ai_user_profile")
    .update(patch)
    .eq("user_id", user.id);
  if (error) throw error;
}

export async function logDraftEdit(opts: {
  original: string;
  edited: string;
  contactId?: string | null;
}) {
  if (!opts.original || !opts.edited || opts.original === opts.edited) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: prof } = await supabase
    .from("profiles")
    .select("active_tenant_id, tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  const tenantId = prof?.active_tenant_id ?? prof?.tenant_id;
  if (!tenantId) return;
  await supabase.from("ai_draft_edits").insert({
    user_id: user.id,
    tenant_id: tenantId,
    original: opts.original,
    edited: opts.edited,
    char_delta: Math.abs(opts.edited.length - opts.original.length),
    contact_id: opts.contactId ?? null,
  });
}

export async function countMyDealsClosed(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count } = await supabase
    .from("deals")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);
  return count ?? 0;
}

export async function getTeamCloseRate(tenantId: string): Promise<number> {
  const { data } = await supabase
    .from("deals")
    .select("is_won, is_lost")
    .eq("tenant_id", tenantId);
  if (!data?.length) return 0;
  const closed = data.filter((d: any) => d.is_won).length;
  const finished = data.filter((d: any) => d.is_won || d.is_lost).length;
  return finished ? closed / finished : 0;
}