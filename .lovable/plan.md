# Plan: Diagramas ERD para Walix.ai

## Objetivo
Agregar diagramas Entidad-Relación (ERD) en formato **Mermaid** que visualicen las 24 tablas de Supabase agrupadas por dominio funcional, más un diagrama global de alto nivel.

## Entregables (en `/mnt/documents/`)

### 1. `Walix_ERD_Global.mmd` — Vista panorámica
Diagrama de alto nivel mostrando los **4 dominios** y cómo se conectan vía `tenant_id` y `organization_id`:

```text
auth.users ──► profiles ──► tenants ──► organization
                  │            │
                  └─► user_roles (RBAC)
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
   CRM Domain          WhatsApp Domain        Billing Domain
 (contacts, deals,    (conversations,         (tenant_modules,
  pipelines, tasks)    messages, templates)    plan_limits)
```

### 2. `Walix_ERD_Identity.mmd` — Identidad y Multi-tenancy
Tablas: `organizations`, `organization_members`, `tenants`, `profiles`, `user_roles`, `invitations`, `org_plan_limits`, `plan_limits`.
Muestra la jerarquía Org → Tenant → User y el sistema de roles separado.

### 3. `Walix_ERD_CRM.mmd` — Núcleo CRM
Tablas: `contacts`, `contact_tags`, `deals`, `pipelines`, `pipeline_stages`, `deal_stage_history`, `tasks`, `activities`, `ai_suggestions`.
Relaciones clave: `deals.contact_id → contacts`, `deals.stage_id → pipeline_stages`, `pipeline_stages.pipeline_id → pipelines`, historial automático vía trigger.

### 4. `Walix_ERD_Communications.mmd` — WhatsApp y Notificaciones
Tablas: `conversations`, `messages`, `message_templates`, `notifications`, `ai_feedback`.
Relaciones: `conversations.contact_id → contacts`, `conversations.deal_id → deals`, `messages.conversation_id → conversations`.

### 5. `Walix_ERD_Operations.mmd` — Automatizaciones, Marketplace y Auditoría
Tablas: `automations`, `automation_runs`, `tenant_modules`, `audit_log`.
Relaciones: `automation_runs.automation_id → automations`, `tenant_modules.tenant_id → tenants`.

### 6. `Walix_ai_ERD.md` — Documento que envuelve los 5 diagramas
- Introducción explicando el modelo multi-tenant
- Cada sección con: descripción del dominio, lista de tablas, RLS típico, y referencia al `.mmd` correspondiente
- Notas sobre relaciones implícitas (no hay FKs físicas en muchos casos — se usa `tenant_id` + RLS)
- Convenciones: PK `id uuid`, scoping `tenant_id`, timestamps `created_at/updated_at`

## Detalles técnicos

- Sintaxis: `erDiagram` de Mermaid con cardinalidades (`||--o{`, `}o--o{`).
- Sin emojis (causan errores de lexer).
- Cada `.mmd` se publica con `<lov-artifact>` MIME `text/vnd.mermaid` para renderizado interactivo.
- El `.md` resumen va con `<lov-artifact>` MIME `text/markdown`.
- **Importante**: las tablas Supabase del proyecto no tienen FKs físicas declaradas (confirmado en el schema). Los diagramas reflejarán las relaciones **lógicas** reales usadas por el código, anotadas como tales.

## Fuera de alcance
- No se modifica la base de datos.
- No se modifica código fuente del proyecto.
- No se exporta a PDF (puede agregarse después si se solicita).
