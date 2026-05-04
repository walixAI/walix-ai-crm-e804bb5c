## Problema
Al cambiar de pestaña del navegador y regresar, la app vuelve a mostrar el spinner de carga y "recarga". Causa: Supabase emite `TOKEN_REFRESHED` (y a veces `SIGNED_IN`) al recuperar foco, y nuestro `onAuthStateChange` siempre vuelve a llamar `loadUserContext` con `setContextLoading(true)`, lo que hace que `ProtectedRoute`/pantallas muestren el loader otra vez.

## Cambios

### 1. `src/hooks/useAuth.ts` — deduplicar eventos de auth
- Mantener un `ref` con el último `user.id` cuyo contexto ya cargamos.
- En `onAuthStateChange`:
  - `INITIAL_SESSION`: ignorar (lo maneja `getSession()`).
  - `TOKEN_REFRESHED`: solo `setSession(session)`. No tocar `contextLoading` ni recargar roles/tenant/orgs.
  - `SIGNED_IN`: si `session.user.id === lastLoadedUserId.current`, solo `setSession`. Si cambió, recargar contexto.
  - `SIGNED_OUT` / `USER_DELETED`: limpiar como hoy.
- Marcar `lastLoadedUserId.current` tras cada carga exitosa de contexto (tanto en el flujo de `getSession` como en cambios reales de usuario).

### 2. `src/App.tsx` — endurecer React Query
- Añadir defaults: `refetchOnWindowFocus: false` (ya suele estarlo, confirmar) y `refetchOnMount: false` con `staleTime: 30_000`, para que componentes lazy no disparen refetch al volver.

## Verificación
- Cambiar de pestaña 30s y volver: sin spinner, sin cambio de ruta.
- Logout + login con otra cuenta: contexto se recarga correctamente.
- Refresh de token (cada ~1h): silencioso, sin parpadeo.

## Archivos
- `src/hooks/useAuth.ts`
- `src/App.tsx`
