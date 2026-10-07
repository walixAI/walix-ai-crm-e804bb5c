// Chat web público del Agente de ventas. Se identifica por la llave pública del agente.
// GET ?key=XXX  -> devuelve el widget JS embebible.
// POST {action:"start"|"message", key, session_id?, text?, name?, phone?, email?}
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { resolveTenantModel } from "../_shared/tenant-model.ts";
import { recordAiUsage } from "../_shared/ai-usage.ts";
import { applyAgentTurn, buildSystemPrompt, jsonInstructions, loadLeadFacts, resolveGoal } from "../_shared/sales-agent.ts";
import { ensureLeadDeal } from "../_shared/lead-deal.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.object({
  action: z.enum(["start", "message", "meta"]),
  key: z.string().min(8).max(200),
  session_id: z.string().uuid().optional(),
  text: z.string().trim().min(1).max(2000).optional(),
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
});

const MAX_MSGS_PER_SESSION = 40;

function widget(endpoint: string, key: string, name: string) {
  return `(function(){if(window.__walixChat)return;window.__walixChat=1;
var E=${JSON.stringify(endpoint)},K=${JSON.stringify(key)},N=${JSON.stringify(name)},S=localStorage.getItem("walix_chat_"+K);
var css="#wxc-b{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:56px;height:56px;border-radius:50%;border:0;background:#0f766e;color:#fff;font:600 22px system-ui;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25)}#wxc-p{position:fixed;right:20px;bottom:88px;z-index:2147483000;width:340px;max-width:calc(100vw - 40px);height:460px;max-height:70vh;background:#fff;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden;font:14px system-ui;color:#111}#wxc-h{background:#0f766e;color:#fff;padding:12px 14px;font-weight:600}#wxc-m{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}.wxc-u{align-self:flex-end;background:#0f766e;color:#fff;padding:8px 10px;border-radius:12px;max-width:80%;white-space:pre-wrap}.wxc-a{align-self:flex-start;background:#f1f5f9;padding:8px 10px;border-radius:12px;max-width:85%;white-space:pre-wrap}#wxc-f{display:flex;gap:6px;padding:10px;border-top:1px solid #e5e7eb}#wxc-f input{flex:1;border:1px solid #d1d5db;border-radius:8px;padding:8px}#wxc-f button{border:0;background:#0f766e;color:#fff;border-radius:8px;padding:0 12px;cursor:pointer}#wxc-l{padding:12px;display:flex;flex-direction:column;gap:8px}#wxc-l input{border:1px solid #d1d5db;border-radius:8px;padding:8px}#wxc-l button{border:0;background:#0f766e;color:#fff;border-radius:8px;padding:9px;cursor:pointer}";
var st=document.createElement("style");st.textContent=css;document.head.appendChild(st);
var b=document.createElement("button");b.id="wxc-b";b.setAttribute("aria-label","Abrir chat");b.textContent="💬";
var p=document.createElement("div");p.id="wxc-p";p.innerHTML='<div id="wxc-h"></div><div id="wxc-m"></div>';
document.body.appendChild(b);document.body.appendChild(p);p.querySelector("#wxc-h").textContent=N;
var m=p.querySelector("#wxc-m");
function add(t,r){var d=document.createElement("div");d.className=r=="u"?"wxc-u":"wxc-a";d.textContent=t;m.appendChild(d);m.scrollTop=m.scrollHeight;return d}
function post(o){o.key=K;return fetch(E,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(o)}).then(function(r){return r.json()})}
function composer(){var f=document.createElement("form");f.id="wxc-f";f.innerHTML='<input placeholder="Escribe tu mensaje..." maxlength="2000"/><button>Enviar</button>';p.appendChild(f);
f.onsubmit=function(e){e.preventDefault();var i=f.querySelector("input"),t=i.value.trim();if(!t)return;i.value="";add(t,"u");var w=add("…","a");
post({action:"message",session_id:S,text:t}).then(function(r){w.textContent=r.reply||r.error||"Ocurrió un error"}).catch(function(){w.textContent="Ocurrió un error"})}}
function lead(){var l=document.createElement("form");l.id="wxc-l";l.innerHTML='<div>Para atenderte mejor, déjanos tus datos:</div><input name="n" placeholder="Nombre" required/><input name="p" placeholder="WhatsApp / teléfono"/><input name="e" type="email" placeholder="Correo"/><button>Iniciar chat</button>';m.appendChild(l);
l.onsubmit=function(e){e.preventDefault();post({action:"start",name:l.n.value,phone:l.p.value,email:l.e.value}).then(function(r){if(!r.session_id){alert(r.error||"Error");return}S=r.session_id;localStorage.setItem("walix_chat_"+K,S);l.remove();if(r.greeting)add(r.greeting,"a");composer()})}}
var init=0;b.onclick=function(){p.style.display=p.style.display=="flex"?"none":"flex";if(init)return;init=1;
if(S){post({action:"start",session_id:S}).then(function(r){if(!r.session_id){S=null;lead();return}(r.history||[]).forEach(function(h){add(h.body,h.role=="visitor"?"u":"a")});composer()})}else lead()};
})();`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    if (req.method === "GET") {
      const key = new URL(req.url).searchParams.get("key") ?? "";
      const { data: agent } = await sb.from("sales_agents").select("name, enabled, channels").eq("public_key", key).maybeSingle();
      const off = !agent || !agent.enabled || agent.channels?.web === false;
      const endpoint = `${Deno.env.get("SUPABASE_URL")}/functions/v1/web-chat`;
      return new Response(off ? "/* Walix: chat no disponible */" : widget(endpoint, key, agent!.name), {
        headers: { ...corsHeaders, "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=300" },
      });
    }

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Datos inválidos" }, 400);
    const b = parsed.data;

    const { data: agent } = await sb.from("sales_agents").select("*").eq("public_key", b.key).maybeSingle();
    if (!agent || !agent.enabled || agent.channels?.web === false) {
      if (b.action === "meta") return json({ enabled: false });
      return json({ error: "Chat no disponible" }, 404);
    }
    if (b.action === "meta") return json({ enabled: true, name: agent.name });

    // ---- start: reanudar o crear sesión (y contacto/oportunidad si dejó teléfono o correo)
    if (b.action === "start") {
      if (b.session_id) {
        const { data: s } = await sb.from("web_chat_sessions").select("id").eq("id", b.session_id).eq("agent_id", agent.id).maybeSingle();
        if (!s) return json({ error: "Sesión no encontrada" }, 404);
        const { data: history } = await sb.from("web_chat_messages").select("role, body").eq("session_id", s.id)
          .order("created_at", { ascending: true }).limit(60);
        return json({ session_id: s.id, history: history ?? [] });
      }
      const name = b.name || "Visitante web";
      const phone = b.phone?.replace(/[^\d+]/g, "") || null;
      const email = b.email || null;
      let contactId: string | null = null;
      let dealId: string | null = null;
      if (phone || email) {
        if (phone) contactId = (await sb.from("contacts").select("id").eq("tenant_id", agent.tenant_id).eq("phone", phone).limit(1).maybeSingle()).data?.id ?? null;
        if (!contactId && email) contactId = (await sb.from("contacts").select("id").eq("tenant_id", agent.tenant_id).eq("email", email).limit(1).maybeSingle()).data?.id ?? null;
        if (!contactId) {
          const { data: c } = await sb.from("contacts").insert({ tenant_id: agent.tenant_id, name, phone, email, source: "Formulario web" }).select("id").single();
          contactId = c?.id ?? null;
        }
        if (contactId) {
          try { dealId = await ensureLeadDeal(sb, agent.tenant_id, contactId, { name, source: "Chat web", attributionId: null } as any); } catch (e) { console.error("ensureLeadDeal", e); }
        }
      }
      const { data: s, error } = await sb.from("web_chat_sessions").insert({
        tenant_id: agent.tenant_id, agent_id: agent.id, pipeline_id: agent.pipeline_id, contact_id: contactId, deal_id: dealId,
        visitor_name: name, visitor_phone: phone, visitor_email: email,
      }).select("id").single();
      if (error) return json({ error: "No se pudo iniciar el chat" }, 500);
      const greeting = `¡Hola ${name.split(" ")[0]}! Soy ${agent.name}. ¿En qué te puedo ayudar?`;
      await sb.from("web_chat_messages").insert({ tenant_id: agent.tenant_id, session_id: s.id, role: "agent", body: greeting });
      return json({ session_id: s.id, greeting });
    }

    // ---- message
    if (!b.session_id || !b.text) return json({ error: "Falta el mensaje" }, 400);
    const { data: s } = await sb.from("web_chat_sessions").select("*").eq("id", b.session_id).eq("agent_id", agent.id).maybeSingle();
    if (!s) return json({ error: "Sesión no encontrada" }, 404);

    const { data: past } = await sb.from("web_chat_messages").select("role, body").eq("session_id", s.id)
      .order("created_at", { ascending: true }).limit(MAX_MSGS_PER_SESSION + 5);
    if ((past ?? []).filter((m: any) => m.role === "visitor").length >= MAX_MSGS_PER_SESSION) {
      return json({ reply: "Gracias por tu interés. Un asesor dará seguimiento a tu conversación muy pronto." });
    }
    await sb.from("web_chat_messages").insert({ tenant_id: agent.tenant_id, session_id: s.id, role: "visitor", body: b.text });

    // Si el lead ya fue canalizado al asesor, el agente no responde.
    let agentSession: any = null;
    if (s.contact_id) {
      agentSession = (await sb.from("sales_agent_sessions").select("*").eq("contact_id", s.contact_id).eq("agent_id", agent.id).maybeSingle()).data;
      if (agentSession && agentSession.state !== "agent") {
        return json({ reply: "Gracias, ya avisé a tu asesor y te contactará en breve." });
      }
    }

    const facts = s.contact_id ? await loadLeadFacts(sb, s.contact_id, agent.pipeline_id) : {};
    const { data: rules } = await sb.from("sales_agent_goal_rules").select("*").eq("agent_id", agent.id);
    const goal = resolveGoal(agent, rules ?? [], facts);
    const { data: kb } = await sb.from("sales_agent_knowledge").select("kind,title,content,url")
      .eq("tenant_id", agent.tenant_id).or(`agent_id.is.null,agent_id.eq.${agent.id}`);

    // Memoria entre canales: últimos mensajes de WhatsApp del mismo contacto.
    let waMemory = "";
    if (s.contact_id) {
      const { data: convs } = await sb.from("conversations").select("id").eq("contact_id", s.contact_id).limit(3);
      const ids = (convs ?? []).map((c: any) => c.id);
      if (ids.length) {
        const { data: wa } = await sb.from("messages").select("direction, body, is_internal_note").in("conversation_id", ids)
          .order("sent_at", { ascending: false }).limit(12);
        const lines = (wa ?? []).reverse().filter((m: any) => !m.is_internal_note && m.body)
          .map((m: any) => `${m.direction === "inbound" ? "Lead" : "Nosotros"}: ${String(m.body).slice(0, 300)}`);
        if (lines.length) waMemory = `\n\n## Lo hablado antes por WhatsApp\n${lines.join("\n")}`;
      }
    }

    const system = buildSystemPrompt(agent, goal, kb ?? [], "chat del sitio web", {
      query: [...(past ?? []).slice(-3).map((m: any) => m.body), b.text].join(" "),
      profile: agentSession?.profile_data ?? {}, known: { nombre: s.visitor_name },
    }) + waMemory + jsonInstructions(agent);
    const history = [...(past ?? []), { role: "visitor", body: b.text }].slice(-20)
      .map((m: any) => ({ role: m.role === "visitor" ? "user" : "assistant", content: m.body }));

    const tm = await resolveTenantModel(sb, agent.tenant_id);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: tm.model, messages: [{ role: "system", content: system }, ...history], response_format: { type: "json_object" } }),
    });
    if (!res.ok) {
      console.error("web-chat ai", res.status, await res.text());
      return json({ reply: "En este momento no puedo responder. Un asesor te contactará pronto." });
    }
    const out = await res.json();
    await recordAiUsage({ tenantId: agent.tenant_id, actorLabel: agent.name, surface: "sales_agent_web", model: tm.model,
      inputTokens: out.usage?.prompt_tokens, outputTokens: out.usage?.completion_tokens, creditFactor: tm.creditFactor });

    let parsedOut: any = {};
    const raw = out.choices?.[0]?.message?.content ?? "";
    try { parsedOut = JSON.parse(raw.replace(/```json|```/g, "").trim()); } catch { parsedOut = { reply: raw }; }
    const reply = String(parsedOut.reply ?? "").trim().slice(0, 1500) || "¿Me puedes dar un poco más de detalle?";
    await sb.from("web_chat_messages").insert({ tenant_id: agent.tenant_id, session_id: s.id, role: "agent", body: reply });

    if (s.contact_id) {
      if (!agentSession) {
        agentSession = (await sb.from("sales_agent_sessions").insert({ tenant_id: agent.tenant_id, contact_id: s.contact_id, agent_id: agent.id,
          pipeline_id: agent.pipeline_id, state: "agent", last_channel: "web", last_agent_message_at: new Date().toISOString() }).select("*").single()).data;
      }
      const { data: c } = await sb.from("contacts").select("owner_id").eq("id", s.contact_id).maybeSingle();
      const turn = await applyAgentTurn(sb, { agent, session: agentSession, parsed: parsedOut, tenantId: agent.tenant_id,
        contactId: s.contact_id, dealId: s.deal_id ?? null, ownerId: c?.owner_id ?? null, channelLabel: "chat web",
        note: async (t: string) => sb.from("activities").insert({ tenant_id: agent.tenant_id, contact_id: s.contact_id, deal_id: s.deal_id ?? null,
          type: "note", description: t, metadata: { sales_agent_id: agent.id, kind: "agent_handoff", channel: "web" } }) });
      if (turn.handoff && !turn.scheduled && agent.handoff_message) {
        await sb.from("web_chat_messages").insert({ tenant_id: agent.tenant_id, session_id: s.id, role: "agent", body: agent.handoff_message });
        return json({ reply: `${reply}\n\n${agent.handoff_message}` });
      }
    }
    return json({ reply });
  } catch (e) {
    console.error("web-chat error", e);
    return json({ error: "Error inesperado" }, 500);
  }
});
