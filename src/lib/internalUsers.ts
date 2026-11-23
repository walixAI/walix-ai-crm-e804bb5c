/** Cuentas internas de QA de Walix: nunca cuentan en equipo, reportes, facturación ni uso de IA. */
export const INTERNAL_TEST_EMAIL_DOMAIN = "@walix-test.io";
export function isInternalTestEmail(email?: string | null): boolean {
  return !!email && email.trim().toLowerCase().endsWith(INTERNAL_TEST_EMAIL_DOMAIN);
}
