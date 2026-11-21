import { describe, expect, it } from "vitest";
import { defaultInboundPolicy, inboundRecipients, mayReceivePhone, profileReceivingPhone } from "./inbound-routing-policy";
const roles = [{ user_id: "a", role: "sales_rep" }, { user_id: "b", role: "sales_manager" }, { user_id: "c", role: "tenant_owner" }];
describe("política de llamadas entrantes de la empresa", () => {
  it("dirige contactos asignados a su asesor", () => { expect(inboundRecipients(defaultInboundPolicy, roles, "a")).toEqual(["a"]); });
  it("dirige números sin contacto a un asesor específico", () => { expect(inboundRecipients({ ...defaultInboundPolicy, unassigned_mode: "specific", unassigned_user_id: "a" }, roles, null)).toEqual(["a"]); });
  it("todos incluye cada miembro una sola vez", () => { expect(inboundRecipients({ ...defaultInboundPolicy, unassigned_mode: "all" }, [...roles, roles[0]], null)).toEqual(["a", "b", "c"]); });
  it("solo supervisores excluye asesores", () => { expect(inboundRecipients(defaultInboundPolicy, roles, null)).toEqual(["b", "c"]); });
  it("solo asesores excluye supervisores", () => { expect(inboundRecipients({ ...defaultInboundPolicy, unassigned_mode: "advisors" }, roles, null)).toEqual(["a"]); });
  it("no dirige a un asesor ajeno al tenant", () => { expect(inboundRecipients({ ...defaultInboundPolicy, unassigned_mode: "specific", unassigned_user_id: "outside" }, roles, null)).toEqual([]); });
  it("la empresa puede desactivar la recepción aunque el asesor la active", () => { expect(mayReceivePhone({ ...defaultInboundPolicy, phone_mode: "none" }, "a")).toBe(false); });
  it("solo usuarios autorizados pueden activar recepción", () => { const p = { ...defaultInboundPolicy, phone_mode: "selected" as const, allowed_user_ids: ["a"] }; expect(mayReceivePhone(p, "a")).toBe(true); expect(mayReceivePhone(p, "b")).toBe(false); });
  it("el destino es el número actual del perfil", () => { expect(profileReceivingPhone("+52 55 1234 5678", true, true, [])).toBe("+525512345678"); });
  it("no desvía sin consentimiento personal", () => { expect(profileReceivingPhone("+525512345678", false, true, [])).toBeNull(); });
  it("no desvía sin autorización del tenant", () => { expect(profileReceivingPhone("+525512345678", true, false, [])).toBeNull(); });
  it("no crea bucles hacia un número de Walix", () => { expect(profileReceivingPhone("+525512345678", true, true, ["+525512345678"])).toBeNull(); });
});