import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * AI Inbox — proactive suggestion center.
 * Computes deterministic, RLS-scoped suggestions from the tenant data:
 *  - cold_deal:        deal sin actividad >10 días
 *  - unread_message:   conversación con mensajes sin leer (inbound)
 *  - stale_lead:       lead nuevo sin actividad >2h
 *  - hot_deal:         deal con respuesta reciente <2h y prob >70
 *  - missing_followup: conversación con último mensaje saliente >3 días sin respuesta
 *
 * Output: { suggestions: AiInboxItem[], counts: {...} }
 */

type Severity = "low" | "medium" | "high";
type ItemType = "cold_deal" | "unread_message" | "stale_lead" | "hot_deal" | "missing_followup";

interface AiInboxItem {
  id: string;
  type: ItemType;
  category: "deals" | "messages" | "pipeline";
  severity: Severity;
  title: string;
  description: string;
  amount?: number;
  daysSince?: number;
  action: { label: string; type: "open_deal" | "open_conversation" | "open_contact"; id: string };
  createdAt: string;
}

function fmtMXN(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}
function daysSince(iso: string | null | undefined) {
  if (!iso) return 9999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}
function hoursSince(iso: string | null | undefined) {
  if (!iso) return 9999;
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [dealsRes, convosRes, contactsRes, msgsRes] = await Promise.all([
      supabase.from("deals")
        .select("id, name, amount, probability, stage_name, is_won, is_lost, updated_at, created_at, contact_id")
        .eq("is_won", false).eq("is_lost", false)
        .limit(200),
      supabase.from("conversations")
        .select("id, contact_id, status, unread_count, preview, last_message_at")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(100),
      supabase.from("contacts")
        .select("id, name, company, status, last_activity_at, created_at")
        .limit(200),
      supabase.from("messages")
        .select("id, conversation_id, direction, sent_at")
        .order("sent_at", { ascending: false })
        .limit(500),
    ]);

    const deals = dealsRes.data ?? [];
    const convos = convosRes.data ?? [];
    const contacts = contactsRes.data ?? [];
    const msgs = msgsRes.data ?? [];

    const contactById = new Map(contacts.map((c: any) => [c.id, c]));
    // Most recent message per conversation
    const lastByConvo = new Map<string, any>();
    for (const m of msgs) {
      if (!lastByConvo.has(m.conversation_id)) lastByConvo.set(m.conversation_id, m);
    }

    const items: AiInboxItem[] = [];

    // 1) cold_deal
    for (const d of deals) {
      const ds = daysSince(d.updated_at ?? d.created_at);
      if (ds >= 10) {
        const contact: any = d.contact_id ? contactById.get(d.contact_id) : null;
        items.push({
          id: `cold-${d.id}`,
          type: "cold_deal",
          category: "deals",
          severity: ds >= 20 ? "high" : "medium",
          title: d.name,
          description: `${ds} días sin actividad · ${d.stage_name ?? "—"} · ${fmtMXN(Number(d.amount ?? 0))}${contact?.name ? ` · ${contact.name}` : ""}`,
          amount: Number(d.amount ?? 0),
          daysSince: ds,
          action: { label: "Abrir deal", type: "open_deal", id: d.id },
          createdAt: d.updated_at ?? d.created_at,
        });
      }
    }

    // 2) hot_deal
    for (const d of deals) {
      const hs = hoursSince(d.updated_at);
      if (hs <= 4 && Number(d.probability ?? 0) >= 70) {
        const contact: any = d.contact_id ? contactById.get(d.contact_id) : null;
        items.push({
          id: `hot-${d.id}`,
          type: "hot_deal",
          category: "deals",
          severity: "high",
          title: `🔥 ${d.name}`,
          description: `Actividad reciente · prob ${d.probability}% · ${fmtMXN(Number(d.amount ?? 0))}${contact?.name ? ` · ${contact.name}` : ""}`,
          amount: Number(d.amount ?? 0),
          action: { label: "Cerrar ahora", type: "open_deal", id: d.id },
          createdAt: d.updated_at ?? d.created_at,
        });
      }
    }

    // 3) unread_message
    for (const c of convos) {
      if ((c.unread_count ?? 0) > 0) {
        const contact: any = contactById.get(c.contact_id);
        const hs = hoursSince(c.last_message_at);
        items.push({
          id: `unread-${c.id}`,
          type: "unread_message",
          category: "messages",
          severity: hs > 24 ? "high" : hs > 4 ? "medium" : "low",
          title: contact?.name ?? "Conversación sin asignar",
          description: `${c.unread_count} sin leer · "${(c.preview ?? "").slice(0, 70)}"`,
          action: { label: "Responder", type: "open_conversation", id: c.id },
          createdAt: c.last_message_at ?? new Date().toISOString(),
        });
      }
    }

    // 4) missing_followup — last message outbound >3 days ago, no inbound after
    for (const c of convos) {
      const last = lastByConvo.get(c.id);
      if (!last) continue;
      if (last.direction === "outbound" && hoursSince(last.sent_at) > 72) {
        const contact: any = contactById.get(c.contact_id);
        const ds = daysSince(last.sent_at);
        items.push({
          id: `followup-${c.id}`,
          type: "missing_followup",
          category: "messages",
          severity: ds >= 7 ? "high" : "medium",
          title: contact?.name ?? "Sin contacto",
          description: `No respondió hace ${ds} días tras tu último mensaje`,
          daysSince: ds,
          action: { label: "Reactivar", type: "open_conversation", id: c.id },
          createdAt: last.sent_at,
        });
      }
    }

    // 5) stale_lead — contact "Nuevo" sin actividad >2h
    for (const k of contacts) {
      if (k.status === "Nuevo" && hoursSince(k.last_activity_at ?? k.created_at) >= 2) {
        items.push({
          id: `lead-${k.id}`,
          type: "stale_lead",
          category: "pipeline",
          severity: hoursSince(k.last_activity_at ?? k.created_at) > 24 ? "high" : "medium",
          title: k.name,
          description: `Lead nuevo sin atender${k.company ? ` · ${k.company}` : ""}`,
          action: { label: "Abrir contacto", type: "open_contact", id: k.id },
          createdAt: k.created_at,
        });
      }
    }

    // sort: severity high → low, then most recent
    const sevWeight = { high: 3, medium: 2, low: 1 } as const;
    items.sort((a, b) => {
      const w = sevWeight[b.severity] - sevWeight[a.severity];
      if (w !== 0) return w;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const counts = {
      total: items.length,
      deals: items.filter((i) => i.category === "deals").length,
      messages: items.filter((i) => i.category === "messages").length,
      pipeline: items.filter((i) => i.category === "pipeline").length,
    };

    return new Response(JSON.stringify({ suggestions: items.slice(0, 80), counts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-inbox error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});