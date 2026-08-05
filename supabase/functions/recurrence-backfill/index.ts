// Función temporal: reconstruye ocurrencias/oportunidades/tareas de servicios recurrentes 2026.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const body = await req.json().catch(() => null);
  if (!body || body.key !== "walix-backfill-2026") {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const log: Record<string, unknown> = {};
  try {
    const { data: old } = await admin.from("recurrence_occurrences").select("id, generated_deal_id, generated_task_id");
    const oldTasks = (old ?? []).map((o) => o.generated_task_id).filter(Boolean);
    const oldDeals = (old ?? []).map((o) => o.generated_deal_id).filter(Boolean);
    if (old?.length) await admin.from("recurrence_occurrences").delete().in("id", old.map((o) => o.id));
    for (let i = 0; i < oldTasks.length; i += 200) await admin.from("tasks").delete().in("id", oldTasks.slice(i, i + 200));
    for (let i = 0; i < oldDeals.length; i += 200) await admin.from("deals").delete().in("id", oldDeals.slice(i, i + 200));
    log.deleted = { occurrences: old?.length ?? 0, tasks: oldTasks.length, deals: oldDeals.length };

    for (const [table, rows] of [["deals", body.deals], ["tasks", body.tasks], ["recurrence_occurrences", body.occurrences]] as const) {
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await admin.from(table).insert(rows.slice(i, i + 200));
        if (error) throw new Error(`${table}: ${error.message}`);
      }
      log[table] = rows.length;
    }
    for (const s of body.subs) {
      await admin.from("recurrence_subscriptions").update({ next_due_date: s.next_due_date, last_executed_date: s.last_executed_date }).eq("id", s.id);
    }
    log.subs = body.subs.length;
    return new Response(JSON.stringify({ ok: true, log }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), log }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
