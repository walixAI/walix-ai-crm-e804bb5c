import { describe, it, expect } from "vitest";
import { inboundBrowserIdentity, inboundBrowserRecipients, matchesInboundBrowser } from "./inbound-browser";

describe("recepción dentro de Walix", () => {
  it("recibe sin un celular habilitado", () => {
    expect(inboundBrowserRecipients(["asesor"], true, "assigned")).toEqual(["asesor"]);
  });
  it("reserva destinos para celulares en grupos grandes", () => {
    expect(inboundBrowserRecipients(Array.from({ length: 10 }, (_, i) => String(i)), true, "queue", 10)).toHaveLength(5);
  });
  it("respeta el cierre de horario", () => {
    expect(inboundBrowserRecipients(["asesor"], false, "assigned")).toEqual([]);
  });
  it("no atiende rutas a buzón", () => {
    expect(inboundBrowserRecipients(["asesor"], true, "voicemail")).toEqual([]);
  });
  it("la identidad del mismo asesor es diferente por empresa", () => {
    expect(inboundBrowserIdentity("empresa-a", "asesor")).not.toBe(inboundBrowserIdentity("empresa-b", "asesor"));
  });
  it("rechaza aceptación de otra empresa", () => {
    expect(matchesInboundBrowser("a", "asesor", `client:${inboundBrowserIdentity("b", "asesor")}`, ["asesor"])).toBe(false);
  });
  it("rechaza aceptación de alguien fuera de los destinatarios", () => {
    expect(matchesInboundBrowser("a", "otro", `client:${inboundBrowserIdentity("a", "otro")}`, ["asesor"])).toBe(false);
  });
  it("acepta exclusivamente el destinatario con la identidad correcta", () => {
    expect(matchesInboundBrowser("a", "asesor", `client:${inboundBrowserIdentity("a", "asesor")}`, ["asesor"])).toBe(true);
  });
});