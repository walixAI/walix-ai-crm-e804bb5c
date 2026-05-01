## Problema detectado

El flujo actual de **registro → onboarding** falla por una **condición de carrera** entre tres procesos asíncronos:

1. `signUp()` resuelve y devuelve sesión → `navigate("/onboarding")`.
2. En paralelo, `onAuthStateChange` dispara `loadUserContext()` que consulta `profiles`/`user_roles` (con reintentos de hasta 2s).
3. `ProtectedRoute` se monta inmediatamente y evalúa `roles.length === 0 && !activeTenantId` → como el trigger `handle_new_user` aún no ha terminado de poblar las tablas, **redirige al usuario a `/login`** antes de que termine la carga.

Resultado: el usuario nuevo es expulsado a /login justo después de registrarse, aunque la cuenta sí se creó correctamente.

### Causa raíz exacta

En `src/components/layout/ProtectedRoute.tsx` (líneas 27–31):

```tsx
if (roles.length === 0 && !activeTenantId) {
  return <Navigate to="/login" ... />;
}
```

Este chequeo se ejecuta **inmediatamente** después de que `loading` pasa a `false`, pero `loading` solo refleja `getSession()`, no la carga del contexto (roles/tenant). El store arranca con `roles: []` y `activeTenantId: null`, así que durante la ventana en la que el contexto aún se está cargando (los ~2s del retry loop), el guard expulsa al usuario.

## Solución

### 1. Añadir un flag `contextLoading` al auth store

En `src/store/auth.ts`: agregar `contextLoading: boolean` (default `true`) y su setter `setContextLoading`.

### 2. Marcar contextLoading en `useInitAuth`

En `src/hooks/useAuth.ts`:
- Al detectar sesión (`onAuthStateChange` y `getSession`), poner `contextLoading = true` antes de llamar a `loadUserContext`.
- Al terminar (éxito o fallo), poner `contextLoading = false`.
- Cuando no hay sesión, también `contextLoading = false`.

### 3. Esperar el contexto en `ProtectedRoute`

En `src/components/layout/ProtectedRoute.tsx`: mostrar el spinner mientras `loading || (user && contextLoading)`. Solo después evaluar el guard de cuenta huérfana.

### 4. Mejorar el flujo de signup en `Login.tsx`

En `src/pages/Login.tsx` (líneas 27–41):
- Tras `signUp` exitoso con sesión, **no** llamar `navigate` inmediatamente. En su lugar, esperar a que el listener `onAuthStateChange` haya cargado el contexto antes de navegar (polling corto del store hasta que `contextLoading === false`, máx 3s).
- Esto garantiza que cuando `/onboarding` se monte, el guard ya tenga roles/tenant.
- Mantener el manejo de "sin sesión devuelta" (cuando se requiere confirmación de email).

### 5. Verificación

Tras los cambios, el flujo será:

```text
signUp() ──► sesión creada
   │
   ├─► onAuthStateChange dispara loadUserContext (con retries)
   │       │
   │       └─► profiles + user_roles listos → contextLoading=false
   │
   └─► Login espera contextLoading=false → navigate("/onboarding")
                                                   │
                                                   └─► ProtectedRoute ve roles/tenant ✓ → renderiza Onboarding
```

## Archivos a modificar

- `src/store/auth.ts` — añadir `contextLoading` + setter.
- `src/hooks/useAuth.ts` — gestionar `contextLoading` durante la carga del contexto.
- `src/components/layout/ProtectedRoute.tsx` — esperar `contextLoading` antes de evaluar guard.
- `src/pages/Login.tsx` — esperar contexto cargado antes de `navigate("/onboarding")`.

No se requieren cambios en BD ni en edge functions.
