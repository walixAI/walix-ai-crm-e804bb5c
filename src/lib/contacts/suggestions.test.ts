import { describe, it, expect } from "vitest";
import { buildContactSuggestions } from "./suggestions";
import type { ContactRow, DealRow, ActivityRow } from "@/lib/queries/contacts";

const baseContact: ContactRow = {
  id: "c1",
  name: "Ana López",
  lastName: "López",
  phone: "+5215555555555",
  email: null,
  phoneAlt: null,
  address: null,
  notes: null,
  company: null,
  companyId: null,
  position: null,
  status: "prospecto",
  source: "Manual" as any,
  sourceId: null,
  tags: [],
  ownerId: null,
  ownerName: "Sin asignar",
  ownerInitials: "—",
  avatarColor: "hsl(0 0% 50%)",
  lastActivity: new Date().toISOString(),
  createdAt: new Date().toISOString(),
};

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

describe("buildContactSuggestions", () => {
  it("always returns at least one suggestion (fallback)", () => {
    const out = buildContactSuggestions({
      contact: baseContact, activity: [], deals: [], lastInbound: null,
    });
    expect(out.length).toBeGreaterThan(0);
    expect(out[out.length - 1].id).toBe("schedule-followup");
  });

  it("prioritizes unanswered inbound message", () => {
    const out = buildContactSuggestions({
      contact: baseContact,
      activity: [],
      deals: [],
      lastInbound: { receivedAt: daysAgo(1), lastOutboundAt: daysAgo(3) },
    });
    expect(out[0].id).toBe("inbound-pending");
    expect(out[0].action).toBe("whatsapp");
  });

  it("does NOT flag inbound when already answered", () => {
    const out = buildContactSuggestions({
      contact: baseContact,
      activity: [],
      deals: [],
      lastInbound: { receivedAt: daysAgo(3), lastOutboundAt: daysAgo(1) },
    });
    expect(out.find((s) => s.id === "inbound-pending")).toBeUndefined();
  });

  it("flags inactive prospects", () => {
    const out = buildContactSuggestions({
      contact: { ...baseContact, lastActivity: daysAgo(10), status: "prospecto" },
      activity: [],
      deals: [],
      lastInbound: null,
    });
    expect(out.find((s) => s.id === "reactivate")).toBeDefined();
  });

  it("welcomes brand-new contacts with no activity", () => {
    const out = buildContactSuggestions({
      contact: { ...baseContact, createdAt: new Date().toISOString(), lastActivity: new Date().toISOString() },
      activity: [],
      deals: [],
      lastInbound: null,
    });
    expect(out.find((s) => s.id === "welcome")).toBeDefined();
  });

  it("highlights high-probability open deals", () => {
    const deal: DealRow = {
      id: "d1", name: "Plan Premium", amount: 50000, stage: "Propuesta",
      probability: 75, contactId: "c1", isWon: false, isLost: false,
      createdAt: daysAgo(20),
    };
    const out = buildContactSuggestions({
      contact: baseContact, activity: [], deals: [deal], lastInbound: null,
    });
    expect(out.find((s) => s.id.startsWith("deal-push-"))).toBeDefined();
  });
});
