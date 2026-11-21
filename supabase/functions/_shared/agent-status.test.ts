import { describe, it, expect } from "vitest";
import { unavailableAgents } from "./agent-status";
const now = Date.parse("2026-11-21T16:00:00Z");
describe("unavailableAgents", () => {
  it("excluye asesores en pausa", () => {
    expect([...unavailableAgents([{ user_id: "a", kind: "pause", last_seen_at: "2026-11-21T15:59:50Z" }], now)]).toEqual(["a"]);
  });
  it("mantiene disponibles con latido reciente", () => {
    expect(unavailableAgents([{ user_id: "a", kind: "available", last_seen_at: "2026-11-21T15:59:00Z" }], now).size).toBe(0);
  });
  it("excluye disponibles sin latido por más de 3 minutos", () => {
    expect(unavailableAgents([{ user_id: "a", kind: "available", last_seen_at: "2026-11-21T15:56:00Z" }], now).has("a")).toBe(true);
  });
});
