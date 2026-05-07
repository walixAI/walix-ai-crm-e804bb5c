// Drena notifications_queue: agrupa por usuario y crea una notificación
// resumen en `notifications`. Disparado por pg_cron cada 15 min.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const nowIso = new Date().toISOString();

  const { data: due, error } = await sb.from("notifications_queue")
    .select("id, tenant_id, user_id, payload, reason")
    .lte("deliver_after", nowIso)
    .is("delivered_at", null)
    .limit(500);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!due?.length) {
    return new Response(JSON.stringify({ ok: true, drained: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Agrupar por user_id|tenant_id
  const groups = new Map<string, typeof due>();
  for (const row of due) {
    const k = `${row.tenant_id}|${row.user_id}`;
    if (!groups.has(k)) groups.set(k, [] as any);
    groups.get(k)!.push(row);
  }

  let inserted = 0;
  const drainedIds: string[] = [];
  for (const [k, rows] of groups) {
    const [tenantId, userId] = k.split("|");
    if (rows.length === 1) {
      const p = (rows[0] as any).payload;
      const { error: e } = await sb.from("notifications").insert(p);
      if (!e) { inserted++; drainedIds.push((rows[0] as any).id); }
    } else {
      const titles = rows.map((r: any) => r.payload?.title).filter(Boolean).slice(0, 3);
      const { error: e } = await sb.from("notifications").insert({
        tenant_id: tenantId,
        user_id: userId,
        type: "digest_summary",
        title: `Resumen: ${rows.length} novedades`,
        body: titles.join(" · ") + (rows.length > 3 ? ` y ${rows.length - 3} más` : ""),
        severity: "info",
        category: "ai",
        data: { count: rows.length, items: rows.map((r: any) => r.payload) },
      });
      if (!e) { inserted++; for (const r of rows) drainedIds.push((r as any).id); }
    }
  }

  if (drainedIds.length) {
    await sb.from("notifications_queue").update({ delivered_at: nowIso }).in("id", drainedIds);
  }

  return new Response(JSON.stringify({ ok: true, drained: drainedIds.length, inserted }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
