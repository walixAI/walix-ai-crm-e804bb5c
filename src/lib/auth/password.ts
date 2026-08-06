export interface PasswordChecks {
  length: boolean;
  letter: boolean;
  number: boolean;
  symbol: boolean;
}

export function evaluatePassword(pw: string): PasswordChecks {
  return {
    length: pw.length >= 10,
    letter: /[a-zA-Z]/.test(pw),
    number: /\d/.test(pw),
    symbol: /[^a-zA-Z0-9]/.test(pw),
  };
}

export function passwordValid(checks: PasswordChecks): boolean {
  return checks.length && checks.letter && checks.number && checks.symbol;
}