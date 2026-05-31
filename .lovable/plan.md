
# Esquema visual de páginas, funcionalidades y permisos por rol

Voy a generar **un único artefacto Mermaid** (`.mmd`) descargable y previsualizable en el chat, construido a partir de las fuentes reales del proyecto:

- Rutas: `src/App.tsx` (incluye `requireRoles` por ruta)
- Capacidades por rol: `src/constants/permissions.ts` (`ROLE_CAPABILITIES`, `ROUTE_PERMISSIONS`, `ROLE_LABEL`)
- Reglas de matching: `src/lib/permissions.ts` (`can`, `canAccessRoute`)
- Etiquetas y descripciones de roles: `ROLE_LABEL`, `ROLE_DESCRIPTION`

## Qué contendrá el diagrama

El archivo Mermaid combinará **dos vistas** en un solo documento para cubrir los dos niveles solicitados (página y funcionalidad).

### 1. Árbol de páginas (flowchart)

Agrupado por zona de la app, con un badge de roles permitidos en cada nodo:

```text
Walix
├── Público          → /  /login  /pricing  /privacy  /terms
├── Onboarding       → /onboarding
├── App (todos los roles autenticados)
│   ├── /dashboard
│   ├── /contacts  /contacts/:id
│   ├── /pipeline
│   ├── /tasks
│   ├── /whatsapp
│   ├── /ai-inbox
│   ├── /reports
│   ├── /automations
│   ├── /marketplace
│   └── /profile
├── Administración tenant
│   └── /settings           [tenant_owner, tenant_admin, platform_*]
├── Organización
│   └── /org                [org_owner, platform_*]
└── Plataforma Walix
    ├── /admin              [platform_owner, platform_staff]
    ├── /platform           [platform_owner, platform_staff]
    └── /admin/ai-metrics   [platform_owner, platform_staff]
```

Cada nodo llevará color según la zona (público / app / admin tenant / org / plataforma).

### 2. Matriz funcionalidad × rol

Como Mermaid no tiene tablas nativas, se renderizará como un **`classDiagram`** donde cada "clase" es un módulo funcional (Contactos, Deals, Pipeline, Reports, WhatsApp, AI, Automations, Settings, Billing, Team, Org, Platform) y cada miembro es una acción con los roles que la pueden ejecutar y su **scope** (`own` / `team` / `tenant`):

Ejemplo (extracto):

```text
class Contactos {
  read.own        : sales_rep
  read.team       : sales_manager
  read / *        : tenant_admin, tenant_owner, platform_*
  create          : sales_rep+
  update.own      : sales_rep
  update.team     : sales_manager
  reassign.team   : sales_manager
}
class Billing {
  *               : tenant_owner, platform_owner
}
class Plataforma {
  tenants.manage  : platform_staff, platform_owner
  tenants.delete  : platform_owner (solo)
  impersonate     : platform_staff, platform_owner
}
```

Se cubrirán los módulos: **contacts, deals, pipeline, reports, automations, whatsapp, ai, templates, settings (read/branding/pipeline/whatsapp/modules), billing, team, audit, tenant (transfer/cancel), org (tenants/members/transfer), platform (tenants/staff/impersonate)**.

### 3. Leyenda de roles

Nodo final con `ROLE_LABEL` + descripción corta de `ROLE_DESCRIPTION` para los 9 roles (incluido `super_admin` marcado como *legacy*).

## Entregable

- Archivo: `/mnt/documents/Walix_Paginas_Permisos.mmd`
- Se muestra inline en el chat como artefacto Mermaid (renderizado nativo, con auto‑tema claro/oscuro).
- Sin cambios en el código de la app.

## Detalles técnicos

- Un solo `.mmd` con varios bloques separados por comentarios `%% ===`.
- Sin emojis (causan errores de lexer).
- Colores vía `classDef` con tonos suficientes para contraste en ambos temas.
- Las capacidades wildcard (`contacts.*`, `*`) se expanden manualmente en la matriz para que el lector vea explícitamente qué acción cubre cada rol.
- Roles `platform_owner` y `super_admin` se muestran como equivalentes (alias legacy) tal como define `ROLE_CAPABILITIES`.

Si lo apruebas, lo genero y te dejo el artefacto listo para descargar/visualizar.
