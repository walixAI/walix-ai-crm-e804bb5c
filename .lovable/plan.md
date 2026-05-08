## Guía de Autenticación y Seguridad — PDF (Español)

Generar `Guia_Autenticacion_Seguridad_Walix.pdf` (~25-30 páginas) en `/mnt/documents/`, dirigido a administradores de cuenta, propietarios de empresa y equipo de TI/seguridad del cliente.

### Alcance y secciones

1. Portada + índice navegable (TOC)
2. Introducción: modelo de seguridad de Walix CRM (multi-tenant, aislamiento por organización/empresa)
3. Modelo de identidad y sesión
   - Registro, inicio de sesión email/contraseña, Google OAuth
   - Verificación de correo, recuperación de contraseña, cambio de email
   - Gestión de sesiones y cierre seguro
4. Jerarquía de roles (basado en `src/constants/permissions.ts` y `src/store/auth.ts`)
   - platform_owner, platform_staff
   - org_owner, org_member
   - tenant_owner, tenant_admin, sales_manager, sales_rep
   - Tabla con descripción, capacidades y limitaciones de cada rol
5. Matriz de permisos por módulo
   - Contactos, Oportunidades (Pipeline), WhatsApp, Reportes, Automatizaciones, IA, Configuración, Facturación, Equipo, Auditoría
   - Scopes: own / team / tenant
   - Rutas protegidas (de `ROUTE_PERMISSIONS`)
6. Gestión de organizaciones, empresas (tenants) y cambio de tenant
7. Invitación y gestión de miembros del equipo
   - Roles invitables (`INVITABLE_ROSES`: tenant_admin, sales_manager, sales_rep)
   - Flujo de invitación, reasignación, desactivación
8. Aislamiento de datos (RLS) y por qué un usuario nunca ve datos de otra empresa
9. Seguridad de canales de WhatsApp (verificación de webhook, tokens)
10. IA y privacidad: qué datos se envían a los modelos, memoria de IA, controles
11. Registro de auditoría (audit log): qué se registra y quién puede consultarlo
12. Buenas prácticas para administradores (contraseñas seguras, MFA cuando aplique, revisión periódica de accesos, rotación de propiedad)
13. Respuesta a incidentes: pasos sugeridos ante acceso sospechoso o pérdida de credenciales
14. Cumplimiento y manejo de datos personales (resumen general, no asesoría legal)
15. Glosario de términos de seguridad
16. Anexo: tabla resumen rol × acción

### Detalles técnicos de generación

- Python + ReportLab Platypus, A4, márgenes 2 cm
- TOC navegable, encabezados jerárquicos en color indigo del branding Walix
- Tablas con filas alternadas para matriz de permisos y roles
- Callouts (cajas sombreadas) para "Importante", "Buena práctica", "Advertencia"
- Diagramas ASCII en `Preformatted` para flujo de login, jerarquía org → tenant → usuarios y flujo de invitación
- Sin emojis ni caracteres Unicode subíndice/superíndice (limitación ReportLab)
- Terminología: "Oportunidad" (no "Deal"), "Empresa" para tenant, "Organización" para org
- Fuentes de verdad en código: `src/constants/permissions.ts`, `src/lib/permissions.ts`, `src/store/auth.ts`, `src/components/layout/ProtectedRoute.tsx`, `src/pages/Login.tsx`, `src/components/settings/team/InviteUserDialog.tsx`, `src/components/organizations/*`

### QA

- Renderizar todas las páginas con `pdftoppm` e inspeccionar visualmente
- Verificar: sin texto cortado, tablas alineadas, TOC con páginas correctas, sin cajas negras por glifos no soportados
- Iterar hasta pase limpio

### Entrega

- `/mnt/documents/Guia_Autenticacion_Seguridad_Walix.pdf`
- Etiqueta `<lov-artifact>` para descarga inmediata

¿Apruebas el plan?
