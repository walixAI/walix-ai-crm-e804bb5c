import { describe, it, expect } from "vitest";
import { storedCallTypification } from "./call-suggestion";
const call = { ai_summary: "Quiere una visita", ai_suggestions: { outcome_id: "effective", typification_id: "interested" } };
describe("reuse existing call analysis", () => {
  it("reuses a matching confirmed suggestion without another AI request", () => {
    expect(storedCallTypification(call, "effective", "Quiere una visita", ["interested"])).toBe("interested");
  });
  it("requires new inference when the advisor changes the comment", () => {
    expect(storedCallTypification(call, "effective", "No desea una visita", ["interested"])).toBeNull();
  });
  it("does not reuse other outcomes or deleted catalog entries", () => {
    expect(storedCallTypification(call, "lost", "", ["interested"])).toBeNull();
    expect(storedCallTypification(call, "effective", "", [])).toBeNull();
  });
});