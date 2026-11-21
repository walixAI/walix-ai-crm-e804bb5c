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