## Objetivo

Crear 3 asesores de venta de prueba en el tenant de `qa.signup.5012@walix-test.io` y distribuir los contactos (≈?) y los 11 negocios existentes entre ellos para poder probar reportes, filtros por vendedor, reasignación, etc.

## Asesores a crear

Tres usuarios funcionales (login real con email + password de prueba) dentro del mismo tenant `24314271-0f64-41de-81e4-dab2dd8e7620`:

| # | Nombre | Email | Rol |
|---|--------|-------|-----|
| 1 | Ana Torres | qa.seller1.5012@walix-test.io | tenant_member |
| 2 | Luis Pérez | qa.seller2.5012@walix-test.io | tenant_member |
| 3 | Sofía Ramírez | qa.seller3.5012@walix-test.io | tenant_member |

Password de prueba común: `Walix2026!` (solo cuenta QA).

## Pasos técnicos

1. **Crear usuarios en auth** vía inserción directa en `auth.users` + `auth.identities` con email confirmado (cuenta QA, sin envío de correo).
2. **Insertar `profiles`** para cada uno con `tenant_id` = tenant de la cuenta y `is_active = true`. El trigger `seed_ai_user_profile` creará su `ai_user_profile`.
3. **Asignar roles** en `user_roles` (`tenant_member`) ligados al tenant.
4. **Reasignar datos existentes** (round-robin entre los 3 nuevos vendedores + el owner original opcional):
   - `UPDATE contacts SET owner_id = ...` por bloques.
   - `UPDATE deals SET owner_id = ...` por bloques (los 11 negocios).
5. Verificar con un `SELECT` final que cada vendedor tenga contactos y deals asignados.

## Notas

- Las contraseñas de QA quedan documentadas solo en este plan; no se guardan en código.
- No se modifica ningún componente de UI. Es solo data seeding + reasignación.
- Si más adelante quieres eliminar a estos asesores de prueba, basta con borrar sus filas en `auth.users` (cascada a `profiles`, `user_roles`, etc.).