import { describe, it, expect } from "vitest";
import { attentionPriority, attentionLink, type HumanAttention } from "./humanAttention";

describe("Atención humana", () => {
  it("prioriza pendientes sin cambiar el orden del resto", () => {
    const rows = [{ id: "a" }, { id: "b", requiresAdvisor: true }, { id: "c" }, { id: "d", requiresAdvisor: true }];
    expect([...rows].sort(attentionPriority).map(r => r.id)).toEqual(["b", "d", "a", "c"]);
  });
  it("abre la conversación y usa el contacto para canales sin conversación", () => {
    const item = { conversation_id: "conv", contact_id: "lead" } as HumanAttention;
    expect(attentionLink(item)).toBe("/whatsapp?conversationId=conv");
    expect(attentionLink({ ...item, conversation_id: null })).toBe("/contacts/lead");
  });
});