import { describe, it, expect } from "vitest";
import { providerResult, inboundDialResult } from "./call-events";
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
  it("a phone voicemail or unaccepted screening is not an attended inbound call", () => {
    expect(inboundDialResult({ DialCallStatus: "completed", DialCallDuration: "43" }, false)?.status).toBe("no_answer");
    expect(inboundDialResult({ DialCallStatus: "completed", DialCallDuration: "0" }, true)?.status).toBe("no_answer");
  });
  it("an accepted 43-second incoming conversation is attended", () => {
    expect(inboundDialResult({ DialCallStatus: "completed", DialCallDuration: "43" }, true)).toEqual({ status: "completed", duration: 43 });
  });
});