import { createClient } from "@supabase/supabase-js";
import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { analyzeCall } from "./call-analyzer";

// Opt-in only, against an explicitly supplied disposable test tenant. No phone calls.
const live = process.env.CALL_ANALYSIS_LIVE_TEST === "true";
describe.skipIf(!live)("live call analysis claim", () => {
  it("serializes concurrent claims, separates tenants, caches results and permits explicit reanalysis", async () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const tenantId = process.env.CALL_ANALYSIS_TEST_TENANT;
    if (!url || !key || !tenantId) throw new Error("Explicit test tenant and service credentials required");
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const id = randomUUID();
    const { error: insertError } = await admin.from("calls").insert({ id, tenant_id: tenantId, to_number: "+525500000000", transcript: "[Silencio]" });
    if (insertError) throw new Error("Unable to create disposable call");
    try {
      const params = { p_call_id: id, p_tenant_id: tenantId, p_fingerprint: "test-fingerprint", p_manual: false };
      const results = await Promise.all([admin.rpc("claim_call_analysis", params), admin.rpc("claim_call_analysis", params)]);
      expect(results.every(r => !r.error)).toBe(true);
      expect(results.map(r => r.data.state).sort()).toEqual(["claimed", "processing"]);
      const wrongTenant = await admin.rpc("claim_call_analysis", { ...params, p_tenant_id: randomUUID() });
      expect(wrongTenant.error).not.toBeNull();
      const held = await admin.rpc("claim_call_analysis", { ...params, p_manual: true, p_fingerprint: "manual-while-processing" });
      expect(held.data.state).toBe("processing");
      const { error: finishError } = await admin.from("call_analysis_runs").update({ status: "completed" }).eq("call_id", id);
      expect(finishError).toBeNull();
      expect((await admin.rpc("claim_call_analysis", params)).data.state).toBe("completed");
      expect((await admin.rpc("claim_call_analysis", { ...params, p_manual: true, p_fingerprint: "manual-explicit" })).data.state).toBe("claimed");
      await admin.from("call_analysis_runs").update({ status: "completed" }).eq("call_id", id);
      const skipped = await analyzeCall(admin, id);
      expect(skipped).toMatchObject({ ok: true, skipped: true });
      expect(await analyzeCall(admin, id)).toMatchObject({ ok: true, skipped: true, reused: true });
      const { data: saved } = await admin.from("calls").select("transcript,ai_suggestions").eq("id", id).single();
      expect(saved?.transcript).toBe("[Silencio]");
      expect(saved?.ai_suggestions.analysis_skip_reason).toBe("silence");
    } finally {
      const { error } = await admin.from("calls").delete().eq("id", id).eq("tenant_id", tenantId);
      if (error) throw new Error("Disposable call cleanup failed");
    }
  });
});