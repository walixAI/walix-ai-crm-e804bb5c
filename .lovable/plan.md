# Recuperación de contraseña: página propia y enlaces que no fallan

## Qué está pasando

El correo de recuperación apunta a `https://s1.walix.app/reset-password`, pero esa ruta **no existe** en la app (las rutas públicas actuales son `/`, `/login`, `/invitacion`, `/pricing`, `/privacy`, `/terms`). Cuando además el enlace ya venció, el backend redirige a la raíz con `#error=access_denied&error_code=otp_expired`, y la app no interpreta ese error: solo muestra el landing como si nada.

Dos causas combinadas:
1. Falta la pantalla de restablecimiento.
2. El enlace de recuperación caduca (por defecto ~1 hora) y también puede consumirse solo si el escáner de seguridad del correo lo abre antes que la persona.

## Qué se va a construir

**1. Pantalla `/reset-password`**
- Nueva página con la marca Walix (mismo estilo que la de invitación): contraseña nueva + confirmación, con los mismos requisitos (10 caracteres, letra, número, símbolo) y botón de mostrar/ocultar.
- Al cargar toma la sesión temporal del enlace; al guardar actualiza la contraseña y lleva al usuario a su inicio (`/dashboard` o `/mi-dia` según su modo).

**2. Manejo del enlace vencido**
- Si el enlace llega con `error_code=otp_expired` o inválido (a la raíz o a `/reset-password`), se muestra un mensaje claro en español: "Este enlace ya venció o fue usado", con un botón **Enviar nuevo enlace**.
- Ese botón pide el correo y reenvía la recuperación al instante, sin salir de la pantalla.

**3. "¿Olvidaste tu contraseña?" en el login**
- Enlace en la pantalla de inicio de sesión que abre el mismo flujo de reenvío, para que nadie dependa de que un administrador mande el correo manualmente.

**4. Correo de recuperación con la marca**
- Se verifica que la plantilla de recuperación apunte siempre a `https://s1.walix.app/reset-password` y se amplía la vigencia del enlace para evitar el vencimiento por escáneres de correo.

## Detalles técnicos

- Nuevo `src/pages/ResetPassword.tsx` + ruta pública en `src/App.tsx` (`/reset-password`), fuera de `ProtectedRoute`.
- Detección del hash (`type=recovery`, `access_token`, o `error_code`) al montar; `supabase.auth.updateUser({ password })` una vez establecida la sesión de recuperación.
- Reenvío con `resetPasswordForEmail(email, { redirectTo: origin + "/reset-password" })`.
- La raíz (`LandingOrHome` en `src/App.tsx` / `src/pages/Index.tsx`) detecta el hash de error y reenvía a `/reset-password` conservando el hash, para no perder el mensaje.
- Validación de contraseña reutilizando las funciones ya presentes en `src/pages/Login.tsx`, extraídas a un helper compartido.
- Ajuste del tiempo de expiración del enlace de recuperación en la configuración de autenticación del backend.

## Después de implementar

Se envía un enlace nuevo a `hola@walix.ai` para probar el flujo completo de punta a punta.