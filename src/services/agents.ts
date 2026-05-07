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

export { describeCron, nextRunFromCron } from "@/components/settings/agents/scheduleHelpers";

export interface UpdateAgentInput {
  name?: string;
  description?: string | null;
  schedule?: string;
  max_actions_per_run?: number;
  config?: Record<string, unknown>;
}

export async function updateAgent(id: string, patch: UpdateAgentInput) {
  const { error } = await supabase.from("ai_agents").update(patch as any).eq("id", id);
  if (error) throw error;
  // Recompute next_run_at server-side if schedule changed.
  if (patch.schedule) {
    await supabase.rpc("ai_recompute_next_run", { p_agent_id: id });
  }
}

export interface CreateCustomAgentInput {
  tenant_id: string;
  name: string;
  description: string;
  system_prompt: string;
  schedule: string;
  allowed_tools: string[];
  max_actions_per_run: number;
}

export async function createCustomAgent(input: CreateCustomAgentInput) {
  const { data, error } = await supabase.from("ai_agents").insert({
    tenant_id: input.tenant_id,
    name: input.name,
    description: input.description,
    agent_type: "custom",
    system_prompt: input.system_prompt,
    schedule: input.schedule,
    model: "google/gemini-2.5-flash",
    allowed_tools: input.allowed_tools,
    max_actions_per_run: input.max_actions_per_run,
    is_active: true,
  }).select("id").single();
  if (error) throw error;
  await supabase.rpc("ai_recompute_next_run", { p_agent_id: data!.id });
  return data;
}

export async function getRunningAgents(): Promise<{ id: string; agent_id: string; agent_name?: string }[]> {
  const { data, error } = await supabase
    .from("ai_agent_runs")
    .select("id, agent_id")
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as any;
}