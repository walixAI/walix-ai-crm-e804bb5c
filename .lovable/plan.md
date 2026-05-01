# Mejoras al formulario de Login / Signup

Buenas observaciones — ambas son estándar de UX en pantallas de auth. Voy a aplicar dos mejoras al archivo `src/pages/Login.tsx`.

## 1. Toggle "mostrar/ocultar contraseña" (login y signup)

- Añadir un botón ícono dentro del input de contraseña (lado derecho) con íconos `Eye` / `EyeOff` de `lucide-react`.
- Estado local `showPassword` que alterna `type="password"` ↔ `type="text"`.
- Aplicar el mismo patrón al campo de confirmación (con su propio estado `showConfirmPassword`).
- Accesible: `aria-label="Mostrar contraseña" / "Ocultar contraseña"`, `aria-pressed`, foco visible.
- El input tendrá `pr-10` para que el texto no choque con el botón.

## 2. Confirmación de contraseña (solo signup)

- Nuevo campo "Confirmar contraseña" que aparece **solo cuando `mode === "signup"`**, debajo del campo de contraseña.
- Estado `confirmPassword` y validación en vivo:
  - Si está vacío → no muestra error.
  - Si no coincide con `password` → mensaje inline rojo: *"Las contraseñas no coinciden"*.
  - Si coincide y ambas no están vacías → ícono check verde + texto *"Las contraseñas coinciden"*.
- Bloquear submit (`canSubmit`) en signup hasta que `password === confirmPassword` y ambas no vacías.
- Validación adicional en `onSubmit` (defensa) que muestra un `toast.error` si no coinciden.
- Resetear `confirmPassword` al cambiar de modo en `switchMode`.

## Detalles técnicos

- Sin nuevas dependencias (ya está `lucide-react`).
- Mantener intactas: validación de email, checklist de complejidad de contraseña, `translateAuthError`, `waitForAuthContext`, redirección a `/onboarding`.
- `autoComplete="new-password"` también en el campo de confirmación.
- El checklist de requisitos sigue mostrándose para el campo principal; el de confirmación solo valida coincidencia.

## Archivos a modificar

- `src/pages/Login.tsx` (único cambio)

¿Procedo?
