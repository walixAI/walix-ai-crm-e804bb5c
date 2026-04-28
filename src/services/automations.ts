import { supabase } from "@/integrations/supabase/client";
import type { TriggerType, AutomationCondition, AutomationAction } from "@/lib/automations/registry";

export interface AutomationDraft {
  name: string;
  description: string;
  triggerType: TriggerType;
  triggerConfig: Record<string, any>;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
}

export async function draftAutomationWithAi(prompt: string): Promise<AutomationDraft> {
  const { data, error } = await supabase.functions.invoke("automations-ai-draft", {
    body: { prompt },
  });
  if (error) throw error;
  if (!data?.draft) throw new Error("La IA no devolvió un borrador");
  return data.draft as AutomationDraft;
}