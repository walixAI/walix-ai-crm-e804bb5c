import { describe, it, expect } from "vitest";
import { nonConversationReason, transcriptFingerprint, compactCallCatalog } from "./call-analysis-policy";
describe("conservative non-conversation detection", () => {
  it.each(["", "[Silencio]", "[Sin audio]"])("skips silence marker %s", text => expect(nonConversationReason(text)).toBe("silence"));
  it("skips only greetings", () => expect(nonConversationReason("Hola, buenos días. Hola.")).toBe("greeting"));
  it("skips a complete standard voicemail message", () => expect(nonConversationReason("Bienvenido al buzón de voz. Por favor deje su mensaje después del tono.")).toBe("voicemail"));
  it.each(["Hola, quiero cotizar", "No tengo dinero, llámame mañana", "Bienvenido al buzón de voz. Me interesa el servicio", "Me llamaron del buzón pero sí quiero comprar"])("preserves real or uncertain content: %s", text => expect(nonConversationReason(text)).toBeNull());
});
describe("persistent fingerprints and compact catalogs", () => {
  it("deduplicates whitespace but not a changed conversation", async () => {
    expect(await transcriptFingerprint("Hola  quiero\nvisita")).toBe(await transcriptFingerprint("Hola quiero visita"));
    expect(await transcriptFingerprint("No quiero visita")).not.toBe(await transcriptFingerprint("Hola quiero visita"));
  });
  it("preserves every label and relationship without repeating database UUIDs", () => {
    const compact = compactCallCatalog([{ key: "programa", label: "Programa" }], [{ id: "11111111-1111-4111-8111-111111111111", label: "Contacto efectivo" }], [{ id: "22222222-2222-4222-8222-222222222222", label: "Interesado", outcome_id: "11111111-1111-4111-8111-111111111111", sentiment: "positive" }]);
    expect(compact.fieldMap.get("f0")).toBe("programa");
    expect(compact.outcomeMap.get("o0")).toBe("11111111-1111-4111-8111-111111111111");
    expect(JSON.parse(compact.catalog).tipificaciones).toEqual([["t0", "o0", "Interesado", "positive"]]);
    expect(compact.catalog).not.toContain("11111111-1111-4111-8111-111111111111");
  });
});