## Roles, Permisos, `/settings` y `/admin` — Plan aprobado para ejecutar

Decisiones del usuario:
1. **Drag-and-drop** real para etapas de pipeline (instalar `@dnd-kit/core` + `@dnd-kit/sortable` si no están).
2. **Color primario**: aplicar solo a `--primary` y derivar accents (sin tocar sidebar/gradientes).
3. **Tab "Actividad" (audit log)** visible para `tenant_admin` dentro de Settings.

---

### Migración de base de datos

```sql
-- Tenants: plan, marca, locale
ALTER TABLE tenants
  ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  ADD COLUMN locale text NOT NULL DEFAULT 'es-MX',
  ADD COLUMN timezone text NOT NULL DEFAULT 'America/Mexico_City',
  ADD COLUMN currency text NOT NULL DEFAULT 'MXN',
  ADD COLUMN logo_url text,
  ADD COLUMN brand_primary text,
  ADD COLUMN brand_name text,
  ADD COLUMN mrr numeric NOT NULL DEFAULT 0,
  ADD COLUMN nps integer;

-- Profiles: estado y email denormalizado
ALTER TABLE profiles
  ADD COLUMN is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN last_seen_at timestamptz,
  ADD COLUMN email text;

-- UPDATE policy del tenant: permitir tenant_admin actualizar su tenant
CREATE POLICY "tenant_admin updates own tenant" ON tenants FOR UPDATE TO authenticated
  USING (id = get_user_tenant(auth.uid()) AND has_role(auth.uid(),'tenant_admin'))
  WITH CHECK (id = get_user_tenant(auth.uid()) AND has_role(auth.uid(),'tenant_admin'));
CREATE POLICY "super_admin updates any tenant" ON tenants FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'super_admin'));

-- Plan limits
CREATE TABLE plan_limits (
  plan text PRIMARY KEY,
  max_users integer NOT NULL,
  max_active_automations integer NOT NULL,
  max_pipelines integer NOT NULL,
  monthly_price numeric NOT NULL DEFAULT 0
);
INSERT INTO plan_limits VALUES
  ('starter',1,0,1,0),('pyme',5,3,3,990),
  ('growth',15,99,10,2490),('enterprise',999,99,99,5990);
ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read plan_limits" ON plan_limits FOR SELECT TO authenticated USING (true);

-- Invitaciones
CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  email text NOT NULL,
  role app_role NOT NULL,
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','revoked','expired')),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_admin manages invites" ON invitations FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(),'tenant_admin'))
  WITH CHECK (tenant_id = get_user_tenant(auth.uid()) AND has_role(auth.uid(),'tenant_admin'));
CREATE POLICY "super_admin manages all invites" ON invitations FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'super_admin'));

-- Audit log
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant reads own audit" ON audit_log FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant(auth.uid()) OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "authenticated inserts audit" ON audit_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- Helper para SuperAdmin
CREATE OR REPLACE FUNCTION public.tenant_active_users(_tenant_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM profiles WHERE tenant_id = _tenant_id AND is_active = true
$$;

-- Storage bucket para logos
INSERT INTO storage.buckets (id, name, public) VALUES ('tenant-assets','tenant-assets', true);
CREATE POLICY "tenant_admin uploads logos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='tenant-assets' AND has_role(auth.uid(),'tenant_admin')
              AND (storage.foldername(name))[1] = get_user_tenant(auth.uid())::text);
CREATE POLICY "tenant_admin updates logos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='tenant-assets' AND has_role(auth.uid(),'tenant_admin')
         AND (storage.foldername(name))[1] = get_user_tenant(auth.uid())::text);
CREATE POLICY "public reads logos" ON storage.objects FOR SELECT TO public
  USING (bucket_id='tenant-assets');
```

### Edge functions

- **`tenant-invite`** — valida `tenant_admin` + límite de plan; crea fila en `invitations`; llama `auth.admin.inviteUserByEmail`; inserta `audit_log`.
- **`super-tenant-action`** — solo `super_admin`. Acciones: `suspend | activate | change_plan | delete | impersonate | create_tenant`. Cada una registra en `audit_log`. `impersonate` devuelve token temporal (15min) usado en sesión "shadow" en sessionStorage.

### Frontend — archivos a crear

**Permisos**
- `src/constants/permissions.ts` — capacidades base por rol con tokens `recurso.acción.scope`.
- `src/lib/permissions.ts` — `can(roles, token)`, `canAccessRoute(roles, path)`, etiquetas/descripciones de rol.
- `src/hooks/usePermissions.ts` — `{ can, canAccess, isSuperAdmin, isTenantAdmin, isManager, isRep, primaryRole }`.
- `src/components/auth/RequirePermission.tsx` — wrapper declarativo con `fallback?`.

**Settings (`/settings`)** — 7 tabs: General · Equipo · Pipeline · WhatsApp · Módulos · Facturación · Actividad
- `src/pages/app/Settings.tsx`
- `src/components/settings/SettingsTabs.tsx`
- `src/components/settings/general/GeneralTab.tsx` (logo upload, color primario aplicado a `--primary` con derivación HSL para hover/foreground)
- `src/components/settings/team/TeamTab.tsx` + `InviteUserDialog.tsx` + `MemberRow.tsx`
- `src/components/settings/pipeline/PipelineTab.tsx` + `PipelineEditor.tsx` + `SortableStage.tsx` (dnd-kit)
- `src/components/settings/whatsapp/WhatsappTab.tsx` (estado mock + agentes + plantillas reales sobre `message_templates` + horario)
- `src/components/settings/modules/ModulesTab.tsx` (toggles mock + nota Prompt 11)
- `src/components/settings/billing/BillingTab.tsx` (plan + facturas mock + CTA)
- `src/components/settings/activity/ActivityTab.tsx` (lectura de `audit_log`)

**SuperAdmin (`/admin`)**
- `src/pages/app/SuperAdmin.tsx`
- `src/components/admin/GlobalKpis.tsx`
- `src/components/admin/TenantsTable.tsx`
- `src/components/admin/TenantDrawer.tsx`
- `src/components/admin/CreateTenantDialog.tsx`
- `src/components/admin/ImpersonationBanner.tsx` (sticky en TopBar)

**Servicios y queries**
- `src/services/tenant.ts` — get/update tenant, members, invites, plantillas, pipelines.
- `src/services/admin.ts` — listado tenants, llamadas a `super-tenant-action`.
- `src/services/audit.ts` — log y consulta.
- `src/lib/queries/tenant.ts` (extender), `src/lib/queries/admin.ts`, `src/lib/queries/auditLog.ts`, `src/lib/queries/planLimits.ts`.
- `src/lib/branding.ts` — `applyBrandPrimary(hsl)` + reset.

**Routing y guards**
- `src/App.tsx` — montar `<Settings />` y `<SuperAdmin />`.
- `src/components/layout/Sidebar.tsx` — usar `canAccessRoute`.
- `src/components/layout/AppLayout.tsx` — montar `<ImpersonationBanner />` y aplicar branding cargado.

### Detalles clave

- **Matriz compacta** (capacidades base, expandidas en runtime):
  - `super_admin: ["*"]`
  - `tenant_admin: ["settings.*","contacts.*","deals.*","pipeline.*","reports.*","automations.*","whatsapp.*","ai.*","audit.read"]`
  - `sales_manager: ["contacts.*.team","deals.*.team","pipeline.read","reports.read.team","automations.read","whatsapp.use","ai.use"]`
  - `sales_rep: ["contacts.*.own","deals.*.own","pipeline.read","reports.read.own","automations.read","whatsapp.use","ai.use"]`
- **Drag-and-drop**: `DndContext` + `SortableContext` (vertical) en `PipelineTab` para reordenar etapas; persistir `position` en BD al `dragEnd`.
- **Color primario**: input HSL (`H S% L%`); al guardar, persiste en `tenants.brand_primary` y se inyecta en `:root` solo en `--primary` y `--primary-foreground` (calculado por luminancia). Reset al logout.
- **Impersonación segura**: token temporal en sessionStorage; banner amarillo con "Saliendo: Acme · Salir". Nunca tocar sesión real del super_admin.
- **Audit log**: helper `logAudit(action, target, metadata)` invocado desde mutaciones sensibles del cliente (cambio plan/equipo/etapas) y desde edge functions.

### Dependencias

- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (si no existen ya por Pipeline kanban).

### Fuera de alcance v1

- WhatsApp Business Cloud API real (estado/QR mock).
- Stripe real (BillingTab mock, cambio de plan vía SuperAdmin).
- Tabla `teams` con membresías explícitas (manager = todos los reps del tenant).
- Email templates personalizados de invitación.
