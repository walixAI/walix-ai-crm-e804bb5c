# Resetear contraseña del usuario demo

Asignar una nueva contraseña al usuario `qa.signup.5012@walix-test.io` usando la Admin API de autenticación.

## Nueva contraseña propuesta
```
WalixDemo2026!
```

## Pasos

1. **Crear edge function temporal `admin-reset-password`** (one-shot)
   - Usa `SUPABASE_SERVICE_ROLE_KEY` (ya disponible en secrets).
   - Llama `supabase.auth.admin.updateUserById(userId, { password })`.
   - Protegida por un token simple en el body para evitar uso accidental.

2. **Ejecutar la función vía curl** contra el usuario demo:
   - Buscar el `id` en `auth.users` por email.
   - Actualizar la contraseña a `WalixDemo2026!`.
   - Confirmar respuesta exitosa.

3. **Eliminar la edge function** después de usarla (no debe quedar un endpoint capaz de resetear contraseñas arbitrariamente).

## Entregable
- Credenciales finales en chat:
  - Email: `qa.signup.5012@walix-test.io`
  - Password: `WalixDemo2026!`
- Recomendación de cambiarla desde **Mi perfil → Seguridad → Cambiar contraseña** tras el primer login.

## Alternativa más simple (si prefieres)
En lugar de crear/borrar una función, puedo enviarte un **magic link** o un **password recovery email** al correo demo — pero como es una cuenta de QA sin buzón real, el reset directo vía Admin API es lo práctico.

¿Confirmas la contraseña `WalixDemo2026!` o prefieres definir tú una?