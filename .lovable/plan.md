## Bug — Signup queda atorado por falso "cuenta huérfana"

### Causa raíz
Al hacer signup, Supabase crea la fila en `auth.users` y el trigger `handle_new_user` crea profile + tenant + roles. El cliente, al recibir la nueva sesión vía `onAuthStateChange`, llama inmediatamente a `loadUserContext()`. Si esa primera consulta llega **antes** de que el trigger termine (carrera de milisegundos), `profiles` viene vacío y `roles` vienen vacíos → marcamos la cuenta como huérfana → `forceSignOut()` cierra la sesión y muestra "Tu cuenta ya no está disponible".

Esto se ve en los logs: el signup termina con éxito (`immediate_login_after_signup: true`) pero el usuario nunca llega a `/onboarding`.

### Arreglo
Agregar **reintentos con backoff** a la verificación de cuenta huérfana antes de considerar realmente que la cuenta no existe.

### Cambios en `src/hooks/useAuth.ts`

1. Convertir `loadUserContext` para que reintente cuando `profileRes.data` viene `null`:
   - Hasta **5 intentos** espaciados ~400 ms (≈2 s total).
   - Si después del último intento `profile` sigue `null` Y no hay roles → entonces sí marcar `accountValid = false`.
2. Mantener la lógica de `forceSignOut` igual — solo se dispara cuando ya pasó el grace period.
3. Esto cubre tanto el caso del signup recién hecho como el caso real de cuenta borrada (espera ~2 s y luego cierra).

### Cambio menor en `src/pages/Login.tsx`
- En modo `signup`, si `data.session` viene `null` (caso edge si se desactiva auto-confirm en el futuro), mostrar mensaje "Revisa tu correo para confirmar la cuenta" en lugar de redirigir a `/onboarding` (que terminaría en login). Hoy el proyecto auto-confirma así que no aplica, pero es defensivo y barato.

### Archivos a tocar
- `src/hooks/useAuth.ts` — reintentos en `loadUserContext`.
- `src/pages/Login.tsx` — manejo defensivo de signup sin sesión.

Sin cambios de DB.

¿Procedo?
