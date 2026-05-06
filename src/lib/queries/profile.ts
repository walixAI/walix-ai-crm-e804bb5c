import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  phone: string | null;
  job_title: string | null;
  timezone: string;
  locale: string;
  signature: string | null;
  wa_greeting: string | null;
  reminder_hour: number;
  notification_prefs: Record<string, boolean>;
  last_seen_at: string | null;
  created_at: string;
}

export function useMyProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<ProfileRow | null> => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useUpdateMyProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<ProfileRow>) => {
      if (!user?.id) throw new Error("No auth");
      const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
  });
}

export interface ProfileStats {
  contactsCreated: number;
  dealsWon: number;
  dealsLost: number;
  amountClosed: number;
  tasksCompleted: number;
  callsLogged: number;
  notesLogged: number;
}

export function useMyProfileStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-profile-stats", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<ProfileStats> => {
      const since = new Date(); since.setDate(since.getDate() - 30);
      const sinceIso = since.toISOString();
      const uid = user!.id;
      const [c, d, t, a] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }).eq("owner_id", uid).gte("created_at", sinceIso),
        supabase.from("deals").select("amount, is_won, is_lost, updated_at").eq("owner_id", uid).gte("updated_at", sinceIso),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("assignee_id", uid).eq("completed", true).gte("updated_at", sinceIso),
        supabase.from("activities").select("type").eq("agent_id", uid).gte("occurred_at", sinceIso),
      ]);
      const deals = d.data ?? [];
      const won = deals.filter((x: any) => x.is_won);
      const lost = deals.filter((x: any) => x.is_lost);
      const acts = a.data ?? [];
      return {
        contactsCreated: c.count ?? 0,
        dealsWon: won.length,
        dealsLost: lost.length,
        amountClosed: won.reduce((s: number, x: any) => s + Number(x.amount ?? 0), 0),
        tasksCompleted: t.count ?? 0,
        callsLogged: acts.filter((x: any) => x.type === "call").length,
        notesLogged: acts.filter((x: any) => x.type === "note").length,
      };
    },
  });
}