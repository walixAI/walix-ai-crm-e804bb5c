import { describe, expect, it } from "vitest";
import { dateBoundary, nextDateBoundary, mexicoDateKey, localDayEnd } from "./date-range";

describe("complete selected calendar days", () => {
  it("covers November 1 through the entire November 23 in Mexico City", () => {
    expect(dateBoundary("2026-11-01", "start")).toBe("2026-11-01T06:00:00.000Z");
    expect(dateBoundary("2026-11-23", "end")).toBe("2026-11-24T05:59:59.999Z");
    expect(nextDateBoundary("2026-11-23").toISOString()).toBe("2026-11-24T06:00:00.000Z");
  });
  it("retains explicit timestamps rather than expanding them to a calendar day", () => {
    expect(dateBoundary("2026-11-23T12:34:56Z", "end")).toBe("2026-11-23T12:34:56Z");
  });
  it("places the evening of November 23 in that day's chart bucket", () => {
    expect(mexicoDateKey("2026-11-24T05:59:59.999Z")).toBe("2026-11-23");
  });
  it("includes the last millisecond in browser-local monthly periods", () => {
    const day = new Date(2026, 10, 23);
    const end = localDayEnd(day);
    expect(end.getTime() - day.getTime()).toBe(86_399_999);
    expect(end.getMilliseconds()).toBe(999);
  });
});