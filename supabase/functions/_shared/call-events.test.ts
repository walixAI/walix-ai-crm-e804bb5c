import { describe, it, expect } from "vitest";
import { providerResult } from "./call-events";
describe("automatic call outcomes", () => {
  it("never records advisor answer as prospect answer", () => {
    expect(providerResult({ CallStatus: "in-progress" }, "advisor")).toBeNull();
  });
  it.each([["completed", "completed"], ["failed", "failed"], ["busy", "busy"], ["no-answer", "no_answer"]])("maps %s independently of manual classification", (raw, expected) => {
    expect(providerResult({ DialCallStatus: raw, DialCallDuration: "12" }, "lead")).toEqual({ status: expected, duration: 12 });
  });
  it("records voicemail only with machine evidence", () => {
    expect(providerResult({ CallStatus: "in-progress", AnsweredBy: "machine_end_beep" }, "lead")?.status).toBe("voicemail");
  });
});