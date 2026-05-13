## Diagnóstico

- Los 3 vendedores sí existen en la misma cuenta/empresa que `qa.signup.5012@walix-test.io`.
- Los contactos y negocios sí tienen `owner_id` asignado a esos vendedores.
- El problema principal es de permisos de lectura: la tabla de perfiles solo deja ver el perfil propio, por eso la pestaña **Equipo** y los selectores de vendedor solo muestran al usuario actual; al no poder cargar los vendedores, contactos/negocios pueden verse como “Usuario” o sin asignación visible.

## Plan de corrección

1. Actualizar las reglas de acceso de `profiles` para que los miembros de un mismo tenant puedan ver los perfiles básicos del equipo de su tenant.
2. Actualizar las reglas de acceso de `user_roles` para que los miembros del mismo tenant puedan leer los roles del equipo, permitiendo que la pestaña **Equipo** muestre “Vendedor”, “Administrador”, etc.
3. Mantener protegidas las reglas de edición: cada usuario seguirá editando solo su propio perfil, y la gestión de roles seguirá limitada a plataforma/administradores según las reglas actuales.
4. Ajustar las consultas frontend si hace falta para usar el `active_tenant_id` además de `tenant_id`, evitando que miembros activos queden fuera por cambios de tenant activo.
5. Validar con consultas que:
   - `qa.signup.5012@walix-test.io` ve 4 miembros en **Equipo**.
   - Los 13 contactos y 11 negocios aparecen asignados a Ana, Luis y Sofía.

## Archivos/reglas afectadas

- Migración de reglas de acceso para `profiles` y `user_roles`.
- Posible ajuste pequeño en:
  - `src/services/tenant.ts`
  - `src/lib/queries/tenantUsers.ts`