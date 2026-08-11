import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContactCustomFieldDef {
  id: string;
  key: string;
  label: string;
  fieldType: string;
  placeholder: string | null;
  position: number;
}

export function useContactCustomFieldDefs() {
  return useQuery({
    queryKey: ["contact-custom-field-defs"],
    queryFn: async (): Promise<ContactCustomFieldDef[]> => {
      const { data, error } = await supabase
        .from("contact_custom_fields")
        .select("*")
        .eq("is_active", true)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((f: any) => ({
        id: f.id,
        key: f.key,
        label: f.label,
        fieldType: f.field_type ?? "text",
        placeholder: f.placeholder ?? null,
        position: f.position ?? 0,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}
