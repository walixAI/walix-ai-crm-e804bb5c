// Backfill manual del Agente Aprendiz: procesa los últimos N días (default 90)
// para un tenant. Solo accesible para tenant_admin/owner del tenant o platform.
// Rate limit: máximo 1 ejecución por día por tenant (registrada en ai_agents.config).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const token = auth.slice(7);
    const isService = token === SERVICE_ROLE;

    const body = await req.json().catch(() => ({})) as { tenant_id?: string; days?: number };
    const days = Math.max(7, Math.min(180, Number(body.days ?? 90)));

    const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    let tenantId = body.tenant_id ?? "";
    if (!isService) {
      const sbUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
      const { data: u } = await sbUser.auth.getUser();
      if (!u?.user) return json({ error: "unauthorized" }, 401);
      const { data: prof } = await sbAdmin.from("profiles")
        .select("active_tenant_id, tenant_id").eq("id", u.user.id).maybeSingle();
      const userTenant = prof?.active_tenant_id ?? prof?.tenant_id;
      if (!userTenant) return json({ error: "no tenant" }, 403);
      if (!tenantId) tenantId = userTenant;
      if (tenantId !== userTenant) return json({ error: "forbidden" }, 403);

      const { data: roles } = await sbAdmin.from("user_roles")
        .select("role").eq("user_id", u.user.id).eq("tenant_id", tenantId);
      const ok = (roles ?? []).some((r: any) => r.role === "tenant_admin" || r.role === "tenant_owner");
      if (!ok) return json({ error: "admin role required" }, 403);
    }
    if (!tenantId) return json({ error: "tenant_id required" }, 400);

    // Rate limit: 1 ejecución / día / tenant.
    const { data: aprendiz } = await sbAdmin.from("ai_agents")
      .select("id, config").eq("tenant_id", tenantId).eq("agent_type", "aprendiz").maybeSingle();
    const lastBackfillAt = (aprendiz?.config as any)?.last_backfill_at as string | undefined;
    if (lastBackfillAt) {
      const elapsed = Date.now() - new Date(lastBackfillAt).getTime();
      if (elapsed < 24 * 3600 * 1000) {
        return json({ error: "Backfill ya ejecutado hoy. Intenta mañana." }, 429);
      }
    }

    const since = new Date(Date.now() - days * 86400_000).toISOString();
    let usersUpdated = 0;
    let patternsCreated = 0;

    // ───── Perfiles individuales ─────
    const { data: profiles } = await sbAdmin.from("profiles")
      .select("id").eq("tenant_id", tenantId).eq("is_active", true);

    for (const p of profiles ?? []) {
      const userId = p.id;
      const patch: Record<string, any> = {};

      const { data: edits } = await sbAdmin.from("ai_draft_edits")
        .select("edited, created_at").eq("user_id", userId)
        .gte("created_at", since).limit(500);
      if (edits && edits.length >= 5) {
        const avgLen = edits.reduce((s: number, e: any) => s + (e.edited?.length ?? 0), 0) / edits.length;
        patch.preferred_message_length = avgLen < 120 ? "short" : avgLen < 300 ? "medium" : "long";
        const all = edits.map((e: any) => (e.edited ?? "").toLowerCase()).join(" ");
        const tuteo = / tu | tú | tuyo | te /.test(all);
        const usted = / usted | suyo | le /.test(all);
        const emoji = /[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/u.test(all);
        patch.communication_style = (emoji || (tuteo && !usted)) ? (emoji ? "muy_casual" : "casual") : "formal";
      }

      const { data: deals } = await sbAdmin.from("deals")
        .select("id, is_won, is_lost, stage_name, updated_at")
        .eq("tenant_id", tenantId).eq("owner_id", userId);
      if (deals && deals.length) {
        const won = deals.filter((d: any) => d.is_won).length;
        const lost = deals.filter((d: any) => d.is_lost).length;
        const finished = won + lost;
        patch.total_deals_closed = won;
        patch.total_deals_lost = lost;
        patch.close_rate = finished ? won / finished : 0;

        const wonDeals = deals.filter((d: any) => d.is_won && d.updated_at);
        if (wonDeals.length >= 3) {
          const { data: profRow } = await sbAdmin.from("profiles").select("timezone").eq("id", userId).maybeSingle();
          const tz = (profRow?.timezone as string) || "America/Mexico_City";
          const dayMap: Record<string, number> = {};
          const hourMap: Record<number, number> = {};
          const dows = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
          for (const d of wonDeals) {
            const dt = new Date(d.updated_at);
            const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", hour: "2-digit", hour12: false });
            const parts = fmt.formatToParts(dt);
            const wd = (parts.find(p => p.type === "weekday")?.value || "").toLowerCase();
            const hr = parseInt(parts.find(p => p.type === "hour")?.value || "0", 10);
            const key = dows.includes(wd) ? wd : dows[dt.getDay()];
            dayMap[key] = (dayMap[key] || 0) + 1;
            hourMap[hr] = (hourMap[hr] || 0) + 1;
          }
          patch.best_close_day = Object.entries(dayMap).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? null;
          patch.best_close_hour = Number(Object.entries(hourMap).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? null);
        }

        const stageMap: Record<string, number> = {};
        for (const d of wonDeals) {
          if (d.stage_name) stageMap[d.stage_name] = (stageMap[d.stage_name] || 0) + 1;
        }
        const topStage = Object.entries(stageMap).sort((a,b)=>b[1]-a[1])[0]?.[0];
        if (topStage) patch.top_performing_stage = topStage;
      }

      if (Object.keys(patch).length) {
        await sbAdmin.from("ai_user_profile").upsert(
          { user_id: userId, tenant_id: tenantId, ...patch },
          { onConflict: "user_id" },
        );
        usersUpdated++;
      }
    }

    // ───── Patrones del tenant ─────
    const { data: outcomes } = await sbAdmin.from("ai_outcome_feedback")
      .select("outcome, days_to_outcome, created_at")
      .eq("tenant_id", tenantId).gte("created_at", since).limit(5000);

    const list = outcomes ?? [];
    const dows = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
    const byDow: Record<string, { responded: number; total: number }> = {};
    const byHour: Record<number, number> = {};
    let closeDaysSum = 0, closeDaysN = 0;

    for (const o of list) {
      const d = new Date(o.created_at);
      const dowName = dows[d.getDay()];
      if (o.outcome === "contact_responded") {
        byDow[dowName] = byDow[dowName] || { responded: 0, total: 0 };
        byDow[dowName].responded++;
        byDow[dowName].total++;
        byHour[d.getHours()] = (byHour[d.getHours()] || 0) + 1;
      }
      if (o.outcome === "deal_closed" && o.days_to_outcome != null) {
        closeDaysSum += o.days_to_outcome; closeDaysN++;
      }
    }

    const sample = list.length;
    const conf = sample >= 50 ? 0.85 : sample >= 20 ? 0.65 : 0.4;

    if (sample >= 20) {
      const bestDay = Object.entries(byDow).sort((a,b) => (b[1].responded - a[1].responded))[0];
      if (bestDay) {
        await sbAdmin.from("ai_tenant_patterns").upsert({
          tenant_id: tenantId,
          pattern_type: "best_followup_day",
          pattern_data: { day: bestDay[0], response_rate: bestDay[1].responded / Math.max(1, bestDay[1].total) },
          confidence_score: conf, sample_size: sample,
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id,pattern_type" });
        patternsCreated++;
      }

      const peakHours = Object.entries(byHour).sort((a,b) => Number(b[1]) - Number(a[1])).slice(0, 3).map(([h]) => Number(h));
      if (peakHours.length) {
        await sbAdmin.from("ai_tenant_patterns").upsert({
          tenant_id: tenantId,
          pattern_type: "peak_response_hours",
          pattern_data: { hours: peakHours, timezone: "America/Mexico_City" },
          confidence_score: conf, sample_size: sample,
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id,pattern_type" });
        patternsCreated++;
      }

      if (closeDaysN >= 5) {
        await sbAdmin.from("ai_tenant_patterns").upsert({
          tenant_id: tenantId,
          pattern_type: "avg_close_days",
          pattern_data: { days: Math.round(closeDaysSum / closeDaysN) },
          confidence_score: conf, sample_size: closeDaysN,
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id,pattern_type" });
        patternsCreated++;
      }
    }

    // Marcar last_backfill_at
    if (aprendiz?.id) {
      const newConfig = { ...((aprendiz.config as any) || {}), last_backfill_at: new Date().toISOString() };
      await sbAdmin.from("ai_agents").update({ config: newConfig }).eq("id", aprendiz.id);
    }

    return json({
      ok: true, days, sample_outcomes: sample,
      users_updated: usersUpdated, patterns_created: patternsCreated,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Error" }, 500);
  }
});
