import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PeriodPicker } from "./PeriodPicker";

vi.mock("@/lib/reports/filters", () => ({ periodLabel: () => "Periodo" }));
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("requires start and end clicks when replacing a previously selected custom range", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-24T02:19:00Z"));
  const onChange = vi.fn();
  render(<PeriodPicker value={{ preset: "custom", from: "2026-11-10", to: "2026-11-18" }} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Periodo" }));
  const day = (n: string) => screen.getAllByRole("gridcell", { name: n }).find(b => !b.classList.contains("day-outside"));
  const start = day("1");
  if (!start) throw new Error("Missing start day");
  fireEvent.click(start);
  expect(onChange).not.toHaveBeenCalled();
  const end = day("23");
  if (!end) throw new Error("Missing end day");
  fireEvent.click(end);
  expect(onChange).toHaveBeenCalledExactlyOnceWith({ preset: "custom", from: "2026-11-01", to: "2026-11-23" });
});