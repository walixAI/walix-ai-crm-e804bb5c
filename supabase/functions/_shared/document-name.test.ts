import { describe, expect, it } from "vitest";
import { documentFilename, shortDocumentTitle } from "./document-name";
import { docMessageBody, waMediaPayload } from "./tenant-documents";

describe("Document titles", () => {
  it("cleans separators and preserves meaningful short titles", () => {
    expect(shortDocumentTitle("Temario_Licenciatura_en_Administración.pdf")).toBe("Temario Licenciatura en Administración");
    expect(shortDocumentTitle("Plan de estudios.xlsx")).toBe("Plan de estudios");
  });
  it("cuts long titles at a word boundary and bounds unbroken strings", () => {
    const name = shortDocumentTitle("Licenciatura en Administración Temario completo del programa académico con especialización.pdf");
    expect(name).toBe("Licenciatura en Administración Temario completo del programa");
    expect(shortDocumentTitle("A".repeat(500) + ".pdf")).toHaveLength(64);
    expect(shortDocumentTitle("___ .pdf")).toBe("Documento");
  });
  it("keeps the extension for delivery, including legacy names", () => {
    expect(documentFilename("Plan.pdf", "tenant/category/id-plan.pdf")).toBe("Plan.pdf");
    expect(documentFilename("A".repeat(300), "id.xlsx")).toBe("A".repeat(64) + ".xlsx");
  });
  it("bounds outgoing filenames and message titles without dropping captions", () => {
    const doc = { id: "d", name: "A".repeat(500), storage_path: "id.pdf", mime_type: "application/pdf", description: null };
    expect(waMediaPayload("123", doc, "https://example.test/file").document?.filename).toBe("A".repeat(64) + ".pdf");
    expect(docMessageBody(doc, "Aquí tienes el temario.")).toBe(`📎 Documento enviado: ${"A".repeat(64)}\nAquí tienes el temario.`);
  });
});