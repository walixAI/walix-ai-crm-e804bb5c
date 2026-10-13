import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageList } from "./MessageList";
import type { MessageItem } from "@/lib/queries/whatsapp";

vi.mock("@/lib/queries/tenantUsers", () => ({ useTenantUsers: () => ({ data: [] }), resolveOwner: () => null }));

describe("WhatsApp documents", () => {
  it("contains and shortens legacy long names while keeping captions", () => {
    Element.prototype.scrollIntoView = vi.fn();
    const filename = "A".repeat(500) + ".pdf";
    render(<MessageList messages={[{ id: "m", direction: "outbound", body: `📎 Documento enviado: ${filename}\nTu temario.`, type: "document", metadata: { document_name: filename }, sentAt: new Date().toISOString() } as MessageItem]} />);
    const title = screen.getByTitle(filename);
    expect(title).toHaveTextContent("A".repeat(64));
    expect(title).toHaveClass("min-w-0", "truncate");
    expect(screen.getByText(/Tu temario/)).toHaveClass("[overflow-wrap:anywhere]");
    expect(screen.getByText(/Tu temario/).textContent).not.toContain("A".repeat(65));
  });
});