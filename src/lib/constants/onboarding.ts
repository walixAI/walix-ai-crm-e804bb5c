export const INDUSTRIES = [
  "Inmobiliaria",
  "Seguros",
  "Educación",
  "Salud",
  "Belleza",
  "Legal",
  "Finanzas",
  "Tecnología",
  "Otro",
];

export const TEAM_SIZES = ["1-5", "6-10", "11-20", "20+"];

export const SALES_CHANNELS = ["WhatsApp", "Llamadas", "Presencial", "Online"];

export interface CountryConfig {
  code: string;
  label: string;
  currency: string;
  timezone: string;
  locale: string;
}

export const COUNTRIES: CountryConfig[] = [
  { code: "MX", label: "México", currency: "MXN", timezone: "America/Mexico_City", locale: "es-MX" },
  { code: "CO", label: "Colombia", currency: "COP", timezone: "America/Bogota", locale: "es-CO" },
  { code: "AR", label: "Argentina", currency: "ARS", timezone: "America/Argentina/Buenos_Aires", locale: "es-AR" },
  { code: "CL", label: "Chile", currency: "CLP", timezone: "America/Santiago", locale: "es-CL" },
  { code: "PE", label: "Perú", currency: "PEN", timezone: "America/Lima", locale: "es-PE" },
  { code: "ES", label: "España", currency: "EUR", timezone: "Europe/Madrid", locale: "es-ES" },
  { code: "US", label: "Estados Unidos", currency: "USD", timezone: "America/Mexico_City", locale: "es-US" },
  { code: "OTHER", label: "Otro", currency: "USD", timezone: "America/Mexico_City", locale: "es-419" },
];

export const DEFAULT_COUNTRY_CODE = "MX";

export function getCountryByCode(code: string): CountryConfig {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];
}

export function getCountryByCurrency(currency: string | null | undefined): CountryConfig {
  if (!currency) return getCountryByCode(DEFAULT_COUNTRY_CODE);
  return COUNTRIES.find((c) => c.currency === currency) ?? getCountryByCode(DEFAULT_COUNTRY_CODE);
}