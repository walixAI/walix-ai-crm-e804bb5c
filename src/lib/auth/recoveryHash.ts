// Captura el hash de la URL ANTES de que el cliente de Supabase lo procese/limpie.
// Este módulo debe importarse primero en main.tsx.
const initialHash = typeof window !== "undefined" ? window.location.hash : "";

export function getInitialHashParams(): URLSearchParams {
  return new URLSearchParams(initialHash.replace(/^#/, ""));
}

export function getInitialHash(): string {
  return initialHash;
}

export interface RecoveryHashInfo {
  isRecovery: boolean;
  errorCode: string | null;
  errorDescription: string | null;
}

export function readRecoveryHash(): RecoveryHashInfo {
  const params = getInitialHashParams();
  const type = params.get("type");
  const errorCode = params.get("error_code") || params.get("error");
  return {
    isRecovery: type === "recovery" || !!params.get("access_token"),
    errorCode,
    errorDescription: params.get("error_description"),
  };
}