/**
 * Tests for ai-execute edge function.
 *
 * These tests exercise the deployed edge function over HTTP.
 * They require a valid Supabase user JWT for the target tenant.
 * If credentials aren't available, the tests are skipped (ignored).
 *
 * Run with: supabase--test_edge_functions {functions: ["ai-execute"]}
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");

const ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/ai-execute` : "";

// Optional pre-issued JWT for an authenticated test user. Without it, the
// edge function rejects with 401 and we can only validate the auth gate.
const TEST_JWT = Deno.env.get("AI_EXECUTE_TEST_JWT") ?? "";

const FAKE_UUID = "00000000-0000-0000-0000-000000000000";

function authHeaders(jwt = TEST_JWT) {
  return {
    "Content-Type": "application/json",
    apikey: ANON_KEY ?? "",
    Authorization: `Bearer ${jwt || ANON_KEY || ""}`,
  };
}

async function call(body: Record<string, unknown>, jwt = TEST_JWT) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: authHeaders(jwt),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* keep as text */ }
  return { status: res.status, json, text };
}

// ── Auth gate ─────────────────────────────────────────────────────────

Deno.test("auth gate: rejects requests without a Bearer token", async () => {
  if (!ENDPOINT) {
    console.warn("Skipping: SUPABASE_URL not configured");
    return;
  }
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "update_deal_stage", payload: {} }),
  });
  await res.text();
  assertEquals(res.status, 401);
});

// ── Validation tests (require authenticated user) ──────────────────────
// These hit the validation paths that fire BEFORE any DB write,
// so they're safe even without test fixtures.

const skipNoAuth = !TEST_JWT;

Deno.test({
  name: "send_whatsapp_message: empty body → 400",
  ignore: skipNoAuth,
  fn: async () => {
    const { status, json } = await call({
      mode: "preview",
      proposal_id: "test-1",
      kind: "send_whatsapp_message",
      payload: { conversation_id: FAKE_UUID, body: "" },
    });
    assertEquals(status, 400);
    assertEquals(json?.ok, false);
  },
});

Deno.test({
  name: "send_whatsapp_message: body > 1000 chars → 400",
  ignore: skipNoAuth,
  fn: async () => {
    const { status, json } = await call({
      mode: "preview",
      proposal_id: "test-2",
      kind: "send_whatsapp_message",
      payload: { conversation_id: FAKE_UUID, body: "x".repeat(1001) },
    });
    assertEquals(status, 400);
    assertEquals(json?.ok, false);
  },
});

Deno.test({
  name: "send_whatsapp_message: invalid conversation_id → 400",
  ignore: skipNoAuth,
  fn: async () => {
    const { status, json } = await call({
      mode: "preview",
      proposal_id: "test-3",
      kind: "send_whatsapp_message",
      payload: { conversation_id: "not-a-uuid", body: "hola" },
    });
    assertEquals(status, 400);
    assertEquals(json?.ok, false);
  },
});

Deno.test({
  name: "update_deal_amount: empty payload → 400",
  ignore: skipNoAuth,
  fn: async () => {
    const { status, json } = await call({
      mode: "execute",
      proposal_id: "test-4",
      kind: "update_deal_amount",
      payload: { deal_id: FAKE_UUID },
    });
    // Either 400 (nothing to update) or 404 (deal not found) — both validate the guard ran.
    assertEquals([400, 404].includes(status), true);
    assertEquals(json?.ok, false);
  },
});

Deno.test({
  name: "create_contact: missing name → 400",
  ignore: skipNoAuth,
  fn: async () => {
    const { status, json } = await call({
      mode: "execute",
      proposal_id: "test-5",
      kind: "create_contact",
      payload: { phone: "+5215555555555" },
    });
    assertEquals(status, 400);
    assertEquals(json?.ok, false);
  },
});

Deno.test({
  name: "unsupported kind → 400",
  ignore: skipNoAuth,
  fn: async () => {
    const { status, json } = await call({
      mode: "execute",
      proposal_id: "test-6",
      kind: "delete_universe" as any,
      payload: {},
    });
    assertEquals(status, 400);
    assertEquals(json?.ok, false);
  },
});