import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { PipelineDeal } from "@/lib/queries/pipeline";
vi.mock("@/lib/queries/pipeline", () => ({ useUpdateDeal: () => ({}) }));
vi.mock("./WonDateDialog", () => ({ WonDateDialog: () => null }));
import { QuickActions } from "./QuickActions";
function Location() { return <output data-testid="location">{useLocation().pathname}{useLocation().search}</output>; }
describe("Kanban WhatsApp", () => {
  it("opens the matching contact conversation, not the missing inbox route", () => {
    render(<MemoryRouter><QuickActions deal={{ id: "d1", contactId: "c1", isWon: false, isLost: false } as PipelineDeal} stages={[]} onRequestLost={vi.fn()} onNewTask={vi.fn()} /><Location /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "WhatsApp" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/whatsapp?contactId=c1");
  });
});