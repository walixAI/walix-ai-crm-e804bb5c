import { describe, it, expect } from "vitest";
import { filterPeriodSet } from "./DealsPerformanceView";

const deal = (over: any) => ({ id: "d", isWon: false, isLost: false, wonAt: null, updatedAt: "2026-10-07T22:00:00Z", createdAt: "2026-10-07T22:00:00Z", expectedCloseDate: null, stageId: "agendado", ...over });
const nov = [new Date(2026, 10, 1), new Date(2026, 11, 1)] as const;

describe("filterPeriodSet lente activas", () => {
  it("muestra en noviembre una oportunidad abierta creada en octubre", () => {
    expect(filterPeriodSet([deal({})] as any, "active" as any, nov[0], nov[1], "agendado", [] as any)).toHaveLength(1);
  });
  it("no muestra una oportunidad creada después del periodo", () => {
    expect(filterPeriodSet([deal({ createdAt: "2026-12-05T12:00:00Z" })] as any, "active" as any, nov[0], nov[1], "all", [] as any)).toHaveLength(0);
  });
});
