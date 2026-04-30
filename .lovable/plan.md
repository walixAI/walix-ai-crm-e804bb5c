## Problema

Cuando borramos una cuenta directamente en la base de datos (como pasó con `joseantoniotorres.ciudadmaderas@gmail.com`), el JWT que el navegador del usuario tiene en `localStorage` sigue siendo válido criptográficamente hasta que expire (1 hora por defecto). Mientras tanto:

- `ProtectedRoute` solo verifica `user` (existe el token) → lo deja pasar.
- `loadUserContext` consulta `profiles`, `user_roles`, `organization_members` → todas devuelven vacío, pero no se cierra sesión.
- El usuario ve la app rota (sin tenant, sin datos) en lugar de ser expulsado al login.

Hoy no hay ninguna verificación de "¿este usuario sigue existiendo / sigue teniendo perfil válido?".

## Solución

Detectar la sesión huérfana en el cliente y forzar `signOut()` + redirección a `/login` con un mensaje claro.

### 1. Detección en `useInitAuth` (src/hooks/useAuth.ts)

Modificar `loadUserContext` para que devuelva una bandera `accountValid`:

- Considerar la cuenta **inválida** si:
  - `profiles` no devuelve fila para el `user.id`, **o**
  - `profiles.tenant_id` y `active_tenant_id` son ambos `null`, **o**
  - `user_roles` está vacío.

Cuando `accountValid === false`:
- Llamar `await supabase.auth.signOut()`.
- Mostrar toast: "Tu cuenta ya no está disponible. Contacta al administrador."
- Resetear el store (`reset()`).
- El listener de `onAuthStateChange` recibirá `SIGNED_OUT` y `ProtectedRoute` redirigirá a `/login` automáticamente.

### 2. Manejo de errores de auth global

En el mismo hook, capturar el evento `TOKEN_REFRESHED` y, si Supabase devuelve un error tipo `user_not_found` / `refresh_token_not_found` durante la rehidratación de sesión inicial (`getSession`), también forzar `signOut()`.

### 3. Endurecer `ProtectedRoute` (src/components/layout/ProtectedRoute.tsx)

Añadir una segunda condición: si `user` existe pero después de cargar (`!loading`) `roles.length === 0` **y** `activeTenantId === null`, redirigir a `/login`. Esto cubre el caso en que el usuario navegue antes de que el `signOut` automático complete.

### 4. (Opcional, recomendado) Trigger de auditoría

Crear un trigger en `auth.users` `BEFORE DELETE` que escriba en `audit_log` para que quede traza cuando se borren cuentas en el futuro. — **No bloqueante**, lo dejo como punto separado por si quieres incluirlo.

## Archivos afectados

- `src/hooks/useAuth.ts` — detección de cuenta inválida + signOut automático.
- `src/components/layout/ProtectedRoute.tsx` — guardia adicional por roles/tenant vacíos.
- `src/lib/toast.ts` (uso existente) — para el mensaje de expulsión.

## Resultado

- Usuarios borrados son expulsados al login en cuanto recargan o cambian de ruta (máximo: el tiempo entre dos consultas al backend, normalmente < 1s).
- Mensaje claro en pantalla en lugar de una app vacía y rota.
- Base lista para futuros casos: suspensión de tenant, revocación de acceso, etc.
