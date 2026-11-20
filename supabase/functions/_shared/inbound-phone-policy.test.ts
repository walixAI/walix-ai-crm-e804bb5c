import { describe, expect, it } from "vitest";
import { validateReceivingPreference } from "./inbound-phone-policy";

describe("recepción personal opcional", () => {
  it("permite apagar la recepción sin un celular", () => {
    expect(validateReceivingPreference(false, null)).toEqual({ enabled: false, phone: null });
  });
  it("exige un celular válido antes de activar", () => {
    expect(validateReceivingPreference(true, null).error).toBeTruthy();
    expect(validateReceivingPreference(true, "hola").error).toBeTruthy();
    expect(validateReceivingPreference(true, "+52 55 0000 0000")).toEqual({ enabled: true, phone: "+525500000000" });
  });
  it("guardar un celular no activa la recepción", () => {
    expect(validateReceivingPreference(false, "+525500000000")).toEqual({ enabled: false, phone: "+525500000000" });
  });
  it("impide desviar a un número de Walix y crear un bucle", () => {
    expect(validateReceivingPreference(true, "+525571000589", ["+525571000589"]).error).toBeTruthy();
  });
});