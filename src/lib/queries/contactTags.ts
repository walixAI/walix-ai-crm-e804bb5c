import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/lib/queries/tenant";

export type TagFamily = "temperature" | "cycle" | "special";

export interface ContactTag {
  id: string;
  name: string;
  family: TagFamily;
  icon: string | null;
}

/** Fallback metadata when tag not found in DB */
const DEFAULT_META = {
  family: "special" as TagFamily,
  icon: "#",
  className: "bg-muted text-muted-foreground border-border",
};

const FAMILY_CLASS: Record<TagFamily, string> = {
  temperature: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  cycle: "bg-primary/10 text-primary border-primary/20",
  special: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400",
};

export function tagClassFor(family: TagFamily | undefined): string {
  if (!family) return DEFAULT_META.className;
  return FAMILY_CLASS[family];
}

export function useContactTags() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["contact-tags", tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ContactTag[]> => {
      const { data, error } = await supabase
        .from("contact_tags")
        .select("id, name, family, icon")
        .eq("tenant_id", tenantId!)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ContactTag[];
    },
  });
}

export function getTagMetaFromList(
  tags: ContactTag[] | undefined,
  name: string,
): { family: TagFamily; icon: string; className: string } {
  const t = tags?.find((x) => x.name === name);
  if (!t) return DEFAULT_META;
  return { family: t.family, icon: t.icon ?? "#", className: tagClassFor(t.family) };
}