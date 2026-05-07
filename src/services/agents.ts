import { supabase } from "@/integrations/supabase/client";

export type AgentType =
  | "followup_watchdog" | "lead_qualifier" | "deal_risk_detector"
  | "morning_briefing" | "weekly_coach" | "custom";

export interface AiAgent {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  agent_type: AgentType;
  schedule: string;
  model: string;
  allowed_tools: string[];
  is_active: boolean;
  max_actions_per_run: number;
  last_run_at: string | null;
  last_run_status: string | null;
  actions_taken_today: number;
  next_run_at: string | null;
  config: any;
  created_at: string;
}

export interface AiAgentRun {
  id: string;
  agent_id: string;
  started_at: string;
  completed_at: string | null;
  status: "running" | "completed" | "failed" | "partial";
  entities_processed: number;
  actions_taken: number;
  suggestions_created: number;
  error_message: string | null;
  run_log: any[];
}

export async function listAgents(): Promise<AiAgent[]> {
  const { data, error } = await supabase.from("ai_agents")
    .select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AiAgent[];
}

export async function setAgentActive(id: string, active: boolean) {
  const { error } = await supabase.from("ai_agents")
    .update({ is_active: active }).eq("id", id);
  if (error) throw error;
}

export async function runAgentNow(agentId: string) {
  const { data, error } = await supabase.functions.invoke("ai-agent-runner", {
    body: { agent_id: agentId },
  });
  if (error) throw error;
  return data;
}

export async function listAgentRuns(agentId: string): Promise<AiAgentRun[]> {
  const { data, error } = await supabase.from("ai_agent_runs")
    .select("*").eq("agent_id", agentId)
    .order("started_at", { ascending: false }).limit(10);
  if (error) throw error;
  return (data ?? []) as AiAgentRun[];
}

const CRON_HUMAN: Record<string, string> = {
  "0 9 * * 1-5": "Lunes a viernes a las 9:00 AM",
  "0 18 * * 1-5": "Lunes a viernes a las 6:00 PM",
  "30 7 * * 1-5": "Lunes a viernes a las 7:30 AM",
  "0 8 * * 1": "Lunes a las 8:00 AM",
};

export function describeCron(expr: string): string {
  return CRON_HUMAN[expr] ?? expr;
}