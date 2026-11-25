import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTypificationSuggestion } from "./useTypificationSuggestion";
import { suggestTypification } from "@/lib/queries/typifications";
vi.mock("@/lib/queries/typifications", () => ({ suggestTypification: vi.fn() }));
const defaults = { open: true, contactId: "contact", callId: "call", outcomeId: "effective", enabled: true, initialNote: "Resumen", note: "Resumen", onSuggestion: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(suggestTypification).mockResolvedValue("interested"); });
describe("bounded typification suggestions", () => {
  it("typing and pausing never sends additional requests", async () => {
    const { rerender } = renderHook(p => useTypificationSuggestion(p), { initialProps: defaults });
    await waitFor(() => expect(defaults.onSuggestion).toHaveBeenCalledWith("interested"));
    for (const note of ["Quiero", "Quiero una", "Quiero una visita"]) {
      rerender({ ...defaults, note });
      await act(async () => { await new Promise(r => setTimeout(r, 950)); });
    }
    expect(suggestTypification).toHaveBeenCalledTimes(1);
  });
  it("explicit update sends the edited note once and deduplicates repeated clicks", async () => {
    const { result } = renderHook(() => useTypificationSuggestion({ ...defaults, note: "No desea visita" }));
    await waitFor(() => expect(result.current.busy).toBe(false));
    await act(async () => { await Promise.all([result.current.refresh(), result.current.refresh()]); });
    expect(suggestTypification).toHaveBeenCalledTimes(2);
    expect(suggestTypification).toHaveBeenLastCalledWith("contact", "effective", "No desea visita", "call");
  });
  it("disabled attempts do not invoke AI", () => {
    renderHook(() => useTypificationSuggestion({ ...defaults, enabled: false }));
    expect(suggestTypification).not.toHaveBeenCalled();
  });
  it("late responses cannot change another contact or closed dialog", async () => {
    let resolve: (id: string) => void = () => {};
    vi.mocked(suggestTypification).mockReturnValue(new Promise(r => { resolve = r; }));
    const { rerender } = renderHook(p => useTypificationSuggestion(p), { initialProps: defaults });
    rerender({ ...defaults, open: false });
    await act(async () => { resolve("interested"); });
    expect(defaults.onSuggestion).not.toHaveBeenCalled();
  });
});