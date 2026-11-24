import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ isTenantAdmin: true }) }));
vi.mock("@/lib/queries/tenantUsers", () => ({ useTenantUsers: () => ({ data: [] }) }));
vi.mock("@/lib/queries/activityReport", () => ({
  useActivityReport: (params: unknown) => { state.query(params); return { data: [], isLoading: false }; },
  buildActivityCSV: vi.fn(), downloadCsvFile: vi.fn(), activityTypeLabel: vi.fn(),
}));
import { ActivityReportCard } from "./ActivityReportCard";
afterEach(cleanup);
it("activity card sends complete-day boundaries for selected November 1–23 dates", () => {
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  const { container } = render(<ActivityReportCard />);
  // The same input handlers drive custom and preset ranges.
  // Select custom using the real selector rather than mocking the range calculation.
  const trigger = container.querySelector('[role="combobox"]');
  if (!trigger) throw new Error("Missing period selector");
  fireEvent.keyDown(trigger, { key: "Enter" });
  const custom = [...document.querySelectorAll('[role="option"]')].find(o => o.textContent === "Personalizado");
  if (!custom) throw new Error("Missing custom period option");
  fireEvent.click(custom);
  const inputs = container.querySelectorAll('input[type="date"]');
  if (!inputs[0] || !inputs[1]) throw new Error("Missing dates");
  fireEvent.change(inputs[0], { target: { value: "2026-11-01" } });
  fireEvent.change(inputs[1], { target: { value: "2026-11-23" } });
  expect(state.query).toHaveBeenLastCalledWith(expect.objectContaining({ from: "2026-11-01T06:00:00.000Z", to: "2026-11-24T05:59:59.999Z" }));
});