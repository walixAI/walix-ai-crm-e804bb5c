import { describe, expect, it } from "vitest";
import { terminalHangup } from "./call-hangup";

describe("termination evidence", () => {
  const at = "2026-11-21T20:25:00.000Z";
  it("never attributes a completed Twilio callback to the prospect or advisor", () => {
    expect(terminalHangup("completed", at)).toEqual({ hangup_at: at });
  });
  it("does not assign timeout or voicemail to a person", () => {
    expect(terminalHangup("no_answer", at)).toEqual({ hangup_at: at });
    expect(terminalHangup("voicemail", at)).toEqual({ hangup_at: at });
  });
  it("records provider connection failure as a system end", () => {
    expect(terminalHangup("failed", at)).toEqual({ hangup_at: at, hangup_by: "system" });
  });
  it("preserves the authenticated advisor hangup and original time on duplicate events", () => {
    expect(terminalHangup("completed", at, { hangup_by: "agent", hangup_at: "2026-11-21T20:24:59.000Z" })).toEqual({});
  });
  it("never creates hangup evidence while ringing or answered", () => {
    expect(terminalHangup("ringing", at)).toEqual({});
    expect(terminalHangup("answered", at)).toEqual({});
  });
});
import { inboundDialHangup as idh } from "./call-hangup";
describe("inbound dial hangup", () => {
  it("caller leg completed means the prospect hung up", () => expect(idh("completed", "completed").hangup_by).toBe("prospect"));
  it("caller still connected means the advisor hung up", () => expect(idh("completed", "in-progress").hangup_by).toBe("agent"));
  it("ring timeout is the system", () => expect(idh("no_answer", "in-progress").hangup_by).toBe("system"));
  it("keeps existing evidence", () => expect(idh("completed", "completed", "agent").hangup_by).toBeUndefined());
});

import { outboundDialHangup as odh } from "./call-hangup";
describe("outbound dial hangup", () => {
  it("prospect leg ended while advisor connected means the prospect hung up", () => expect(odh("completed", "in-progress").hangup_by).toBe("prospect"));
  it("advisor leg completed means the advisor hung up", () => expect(odh("completed", "completed").hangup_by).toBe("agent"));
  it("unanswered prospect is a system timeout", () => expect(odh("no_answer", "in-progress").hangup_by).toBe("system"));
  it("keeps the Walix button evidence", () => expect(odh("completed", "in-progress", "agent").hangup_by).toBeUndefined());
});
