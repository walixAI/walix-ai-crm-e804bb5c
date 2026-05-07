import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { appendUserProfile, appendLearnedPatterns, type AIUserProfile, type LearnedPattern } from "./ai-tools.ts";
import { isWithinWorkHours, nextDigest9amCDMX } from "./notifications.ts";

Deno.test("appendUserProfile añade bloque cuando hay perfil", () => {
  const profile: AIUserProfile = {
    user_id: "u1", tenant_id: "t1",
    communication_style: "casual", preferred_message_length: "short",
    best_close_day: null, best_close_hour: null, close_rate: 0.42,
    total_deals_closed: 5, custom_instructions: "Siempre tutea",
    strengths: ["cierres rápidos"], improvement_areas: [],
    allow_auto_tasks: true, weekly_coaching_report: true,
  };
  const out = appendUserProfile("BASE", profile);
  assert(out.includes("PERFIL DEL VENDEDOR ACTIVO"));
  assert(out.includes("Casual y directo"));
  assert(out.includes("Siempre tutea"));
});

Deno.test("appendUserProfile no toca el prompt si no hay perfil", () => {
  assertEquals(appendUserProfile("BASE", null), "BASE");
});

Deno.test("appendLearnedPatterns formatea con confianza y sample size", () => {
  const p: LearnedPattern[] = [{
    pattern_type: "best_followup_day",
    pattern_data: { day: "jueves", response_rate: 0.62 },
    confidence_score: 0.8, sample_size: 40,
  }];
  const out = appendLearnedPatterns("BASE", p);
  assert(out.includes("PATRONES APRENDIDOS"));
  assert(out.includes("jueves"));
  assert(out.includes("80%"));
  assert(out.includes("n=40"));
});

Deno.test("isWithinWorkHours: martes 14:00 CDMX = true", () => {
  const d = new Date("2026-05-12T20:00:00Z"); // 14:00 CDMX
  assertEquals(isWithinWorkHours(d), true);
});

Deno.test("isWithinWorkHours: sábado mediodía = false", () => {
  const d = new Date("2026-05-09T18:00:00Z"); // sábado 12:00 CDMX
  assertEquals(isWithinWorkHours(d), false);
});

Deno.test("nextDigest9amCDMX siempre devuelve fecha futura", () => {
  const now = new Date();
  const next = nextDigest9amCDMX(now);
  assert(next.getTime() > now.getTime());
});
