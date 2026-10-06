import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { resolveTenantModel } from "../_shared/tenant-model.ts";
import { recordAiUsage } from "../_shared/ai-usage.ts";
import { buildSystemPrompt, loadLeadFacts, resolveAgent, resolveGoal } from "../_shared/sales-agent.ts";

const Body = z.object({
  action: z.enum(["resolve", "chat"]),
  agent_id: z.string().uuid().optional(),
  pipeline_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  channel: z.enum(["test", "copilot", "whatsapp", "web"]).default("test"),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(40).default([]),
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "No autenticado" }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } });
    const { data: u } = await sb.auth.getUser(auth.slice(7));
    if (!u?.user) return json({ error: "No autenticado" }, 401);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const b = parsed.data;

    // Determinar el agente (RLS garantiza el tenant).
    let agent: any = null;
    let facts = {};
    if (b.agent_id) {
      const { data } = await sb.from("sales_agents").select("*").eq("id", b.agent_id).maybeSingle();
      agent = data;
    } else if (b.pipeline_id && b.contact_id) {
      const { data: agents } = await sb.from("sales_agents").select("*").eq("pipeline_id", b.pipeline_id);
      facts = await loadLeadFacts(sb, b.contact_id, b.pipeline_id);
      agent = resolveAgent(agents ?? [], facts);
      if (!agent) return json({ agent: null, handled_by: "advisor", reason: "Ningún agente activo cubre este lead" });
    }
    if (!agent) return json({ error: "Agente no encontrado" }, 404);
    if (b.contact_id && !Object.keys(facts).length) facts = await loadLeadFacts(sb, b.contact_id, agent.pipeline_id);

    const { data: rules } = await sb.from("sales_agent_goal_rules").select("*").eq("agent_id", agent.id);
    const goal = resolveGoal(agent, rules ?? [], facts);

    if (b.action === "resolve") {
      return json({ agent: { id: agent.id, name: agent.name }, handled_by: "agent", goal });
    }

    const { data: kb } = await sb.from("sales_agent_knowledge").select("kind,title,content,url")
      .eq("tenant_id", agent.tenant_id).or(`agent_id.is.null,agent_id.eq.${agent.id}`);
    const system = buildSystemPrompt(agent, goal, kb ?? [], b.channel === "copilot" ? "sugerencia para el asesor" : b.channel);

    const tm = await resolveTenantModel(sb, agent.tenant_id);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: tm.model, messages: [{ role: "system", content: system }, ...b.messages] }),
    });
    if (res.status === 429) return json({ error: "Demasiadas solicitudes, intenta en un momento." }, 429);
    if (res.status === 402) return json({ error: "Sin créditos de IA disponibles." }, 402);
    if (!res.ok) return json({ error: `Error de IA (${res.status})` }, 500);
    const out = await res.json();
    const reply = out.choices?.[0]?.message?.content ?? "";

    await recordAiUsage({
      tenantId: agent.tenant_id, userId: u.user.id, surface: "sales_agent", model: tm.model,
      inputTokens: out.usage?.prompt_tokens, outputTokens: out.usage?.completion_tokens, creditFactor: tm.creditFactor,
    });
    return json({ reply, agent: { id: agent.id, name: agent.name }, goal });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
