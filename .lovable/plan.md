## Modelo de Roles + Organizaciones Multi-Tenant — Plan de implementación

### Decisiones del usuario

1. **1 cuenta puede estar en N organizaciones** (tabla puente `organization_members`).
2. **Onboarding:** al registrarse se crea automáticamente `organization` + 1 tenant trial; el usuario queda como `org_owner` + `tenant_owner`.
3. **Límite de tenants por plan de organización:**
   - `org_starter`: 1 tenant
   - `org_pyme`: 2 tenants
   - `org_growth`: 5 tenants
   - `org_enterprise`: ilimitado
4. **Trial:** solo el primer tenant. Tenants adicionales se cobran desde el día 1 según su plan elegido.

---

### Jerarquía final

```text
platform_owner / platform_staff       (Walix - nivel plataforma)
        │
        ▼
organization (cuenta del cliente, agrupa N tenants, sin datos de negocio)
  ├── org_owner / org_member
  └── tenants[]
        ├── tenant_owner               (recibe factura de ESE tenant)
        ├── tenant_admin
        ├── sales_manager
        └── sales_rep
```

---

### Migración de base de datos

**1. Extender enum `app_role`:**

```sql
ALTER TYPE app_role ADD VALUE 'platform_owner';
ALTER TYPE app_role ADD VALUE 'platform_staff';
ALTER TYPE app_role ADD VALUE 'org_owner';
ALTER TYPE app_role ADD VALUE 'org_member';
ALTER TYPE app_role ADD VALUE 'tenant_owner';
-- tenant_admin, sales_manager, sales_rep ya existen
-- super_admin queda obsoleto: usuarios con ese rol se migran a platform_owner
```

**2. Tabla `organizations`:**

```sql
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan text NOT NULL DEFAULT 'org_starter',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE organization_members (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role app_role NOT NULL CHECK (role IN ('org_owner','org_member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Garantizar al menos un org_owner por organización (índice parcial)
CREATE UNIQUE INDEX one_owner_per_org_min
  ON organization_members(organization_id, user_id)
  WHERE role = 'org_owner';
```

**3. Vincular tenants y profiles a organizations:**

```sql
ALTER TABLE tenants
  ADD COLUMN organization_id uuid REFERENCES organizations(id),
  ADD COLUMN trial_ends_at timestamptz;

ALTER TABLE profiles
  ADD COLUMN active_tenant_id uuid;  -- tenant activo en sesión

-- Garantizar 1 tenant_owner por tenant
CREATE UNIQUE INDEX one_owner_per_tenant
  ON user_roles(tenant_id)
  WHERE role = 'tenant_owner';
```

**4. Tabla `org_plan_limits`:**

```sql
CREATE TABLE org_plan_limits (
  plan text PRIMARY KEY,
  max_tenants integer NOT NULL,
  monthly_price numeric NOT NULL DEFAULT 0
);
INSERT INTO org_plan_limits VALUES
  ('org_starter', 1, 0),
  ('org_pyme', 2, 0),
  ('org_growth', 5, 0),
  ('org_enterprise', 999, 0);
ALTER TABLE org_plan_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read org_plan_limits" ON org_plan_limits FOR SELECT TO authenticated USING (true);
```

**5. Helpers SECURITY DEFINER:**

```sql
-- ¿Es de la plataforma?
CREATE OR REPLACE FUNCTION public.is_platform(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT has_role(_user_id, 'platform_owner') OR has_role(_user_id, 'platform_staff')
$$;

-- ¿Pertenece a la organización?
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM organization_members WHERE user_id = _user_id AND organization_id = _org_id)
$$;

-- ¿Es org_owner de esa organización?
CREATE OR REPLACE FUNCTION public.is_org_owner(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM organization_members
                WHERE user_id = _user_id AND organization_id = _org_id AND role = 'org_owner')
$$;

-- get_user_tenant ajustado: devuelve active_tenant_id si está definido, si no el tenant_id del profile
CREATE OR REPLACE FUNCTION public.get_user_tenant(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(active_tenant_id, tenant_id) FROM profiles WHERE id = _user_id
$$;

-- Cuenta tenants de una organización
CREATE OR REPLACE FUNCTION public.org_tenant_count(_org_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM tenants WHERE organization_id = _org_id
$$;
```

**6. RLS para `organizations` y `organization_members`:**

```sql
CREATE POLICY "members read own org" ON organizations FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), id) OR is_platform(auth.uid()));
CREATE POLICY "owners update own org" ON organizations FOR UPDATE TO authenticated
  USING (is_org_owner(auth.uid(), id) OR is_platform(auth.uid()));
CREATE POLICY "platform creates orgs" ON organizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "members read own membership" ON organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_org_owner(auth.uid(), organization_id) OR is_platform(auth.uid()));
CREATE POLICY "owners manage members" ON organization_members FOR ALL TO authenticated
  USING (is_org_owner(auth.uid(), organization_id) OR is_platform(auth.uid()))
  WITH CHECK (is_org_owner(auth.uid(), organization_id) OR is_platform(auth.uid()));
```

**7. Migrar RLS existentes:** reemplazar `has_role(auth.uid(), 'super_admin')` por `is_platform(auth.uid())` en las ~15 tablas (contacts, deals, conversations, messages, activities, automations, audit_log, etc).

**8. Migración de datos existentes:**

```sql
-- Para cada tenant existente sin organization, crear una org y asignarla
DO $$
DECLARE t RECORD; new_org uuid; first_admin uuid;
BEGIN
  FOR t IN SELECT id, name FROM tenants WHERE organization_id IS NULL LOOP
    INSERT INTO organizations(name, created_by, plan)
    VALUES (t.name, (SELECT id FROM profiles WHERE tenant_id = t.id LIMIT 1), 'org_starter')
    RETURNING id INTO new_org;
    UPDATE tenants SET organization_id = new_org WHERE id = t.id;
    -- Primer tenant_admin del tenant pasa a ser org_owner + tenant_owner
    SELECT user_id INTO first_admin FROM user_roles
      WHERE role = 'tenant_admin' AND user_id IN (SELECT id FROM profiles WHERE tenant_id = t.id) LIMIT 1;
    IF first_admin IS NOT NULL THEN
      INSERT INTO organization_members(organization_id, user_id, role) VALUES (new_org, first_admin, 'org_owner');
      INSERT INTO user_roles(user_id, role, tenant_id) VALUES (first_admin, 'tenant_owner', t.id);
    END IF;
  END LOOP;
END $$;

-- Migrar super_admin → platform_owner
UPDATE user_roles SET role = 'platform_owner' WHERE role = 'super_admin';

ALTER TABLE tenants ALTER COLUMN organization_id SET NOT NULL;
```

**9. Trigger de signup ajustado:**

```sql
-- handle_new_user: crea org, tenant trial, asigna roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_org uuid; new_tenant uuid;
BEGIN
  INSERT INTO organizations(name, created_by, plan)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'company_name', 'Mi organización'), NEW.id, 'org_starter')
  RETURNING id INTO new_org;

  INSERT INTO tenants(name, organization_id, plan, trial_ends_at)
  VALUES ('Mi empresa', new_org, 'starter', now() + interval '14 days')
  RETURNING id INTO new_tenant;

  INSERT INTO profiles(id, full_name, email, tenant_id, active_tenant_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email, new_tenant, new_tenant);

  INSERT INTO organization_members(organization_id, user_id, role) VALUES (new_org, NEW.id, 'org_owner');
  INSERT INTO user_roles(user_id, role) VALUES (NEW.id, 'org_owner');
  INSERT INTO user_roles(user_id, role, tenant_id) VALUES (NEW.id, 'tenant_owner', new_tenant);
  RETURN NEW;
END;
$$;
```

---

### Edge functions

- **`org-create-tenant`** — valida `org_owner` + límite de plan (`org_tenant_count < max_tenants`). Crea tenant, asigna creador como `tenant_owner`, copia branding default. Sin trial. Registra en `audit_log`.
- **`tenant-switch`** — valida que el usuario pertenezca al tenant. Actualiza `profiles.active_tenant_id`. Devuelve datos del nuevo contexto.
- **`platform-tenant-action`** (renombre de `super-tenant-action`) — usa `is_platform()`. Acción `delete` solo `platform_owner`.
- **`tenant-invite`** (existente, ajustar) — valida invitador `tenant_owner` o `tenant_admin`; restringe roles asignables.
- **`tenant-transfer-ownership`** (nueva) — solo `tenant_owner` actual o `org_owner` de la org dueña.

---

### Frontend — archivos a crear/modificar

**Roles y permisos:**
- `src/store/auth.ts` — extender `Role` type con nuevos roles. Añadir `activeTenantId` y `organizations[]` al store.
- `src/constants/permissions.ts` — añadir `ROLE_LABEL`, `ROLE_DESCRIPTION` y `ROLE_CAPABILITIES` para los nuevos roles. Reemplazar referencias `super_admin`.
- `src/lib/permissions.ts` — sin cambios estructurales (la matriz hace el trabajo).
- `src/hooks/usePermissions.ts` — añadir `isPlatformOwner`, `isPlatformStaff`, `isPlatform`, `isOrgOwner`, `isTenantOwner`.
- `src/components/auth/RequirePermission.tsx` — sin cambios.

**Organizaciones y switcher:**
- `src/lib/queries/organizations.ts` — `useOrganizations()`, `useOrgTenants(orgId)`, `useOrgPlanLimit(orgId)`.
- `src/services/organizations.ts` — `createTenant(orgId, payload)`, `switchTenant(tenantId)`.
- `src/components/layout/TenantSwitcher.tsx` — dropdown en TopBar: lista tenants de la org activa + "+ Nueva empresa" (deshabilitado si alcanzó límite, con tooltip explicando).
- `src/components/layout/TopBar.tsx` — montar `<TenantSwitcher />` a la izquierda.
- `src/components/organizations/CreateTenantDialog.tsx` — modal con nombre + selector de plan + aviso "Se cobra desde día 1".
- `src/components/organizations/PlanLimitBanner.tsx` — banner cuando se alcanza el límite, CTA "Mejorar plan de organización".

**Página `/org` (vista de organización para org_owner):**
- `src/pages/app/Organization.tsx` — header con nombre/plan, KPIs (tenants activos, total miembros), tabla de tenants con plan/MRR/último acceso, botón "Crear empresa".
- `src/components/organizations/OrgTenantsTable.tsx`.
- `src/components/organizations/OrgPlanCard.tsx`.

**SuperAdmin (renombre conceptual a "Platform"):**
- `src/pages/app/SuperAdmin.tsx` → renombrar referencias internas pero mantener ruta `/admin`. Mostrar también lista de organizaciones.
- `src/components/admin/OrganizationsTable.tsx` (nueva).
- `src/components/admin/PlatformStaffSection.tsx` (nueva, solo para `platform_owner`): invitar/listar `platform_staff`.

**Routing y guards:**
- `src/App.tsx` — añadir `/org` (requiere `org_owner`), mantener `/admin` (requiere `is_platform`).
- `src/components/layout/ProtectedRoute.tsx` — sin cambios.
- `src/components/layout/Sidebar.tsx` — entrada "Mi organización" visible solo para `org_owner`.
- `src/components/layout/AppLayout.tsx` — al cambiar tenant activo, refetch de tenant + recargar branding.

**Settings ajustes finos:**
- `src/components/settings/billing/BillingTab.tsx` — solo visible para `tenant_owner`. Mostrar plan del tenant actual (no de la org).
- `src/components/settings/team/InviteUserDialog.tsx` — restringir roles asignables: `tenant_admin` no puede invitar a otros `tenant_admin`.

---

### Bootstrap del primer `platform_owner`

Migración con email del usuario hardcoded:

```sql
DO $$
DECLARE me uuid;
BEGIN
  SELECT id INTO me FROM auth.users WHERE email = 'EMAIL_DEL_USUARIO';
  IF me IS NOT NULL THEN
    INSERT INTO user_roles(user_id, role) VALUES (me, 'platform_owner')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
```

Si el usuario aún no existe, la migración no hace nada y se reintenta tras el registro mediante una función `bootstrap_platform_owner(email)` que también queda disponible.

**Nota:** necesitamos el email del usuario antes de ejecutar.

---

### Aislamiento de datos verificado

- RLS de tablas de negocio sigue filtrando por `tenant_id = get_user_tenant(auth.uid())`.
- `get_user_tenant` ahora devuelve `active_tenant_id` (el tenant elegido en el switcher).
- Datos entre tenants NUNCA se mezclan, ni siquiera para `org_owner`.
- `org_owner` solo ve metadatos de tenants (nombre, plan, MRR) en `/org`, no datos operativos.

---

### Fuera de alcance v1

- Facturación real con Stripe/Paddle (BillingTab sigue mock).
- Cambio de plan de organización vía UI (manual en BD por ahora).
- Notificación email al alcanzar límite de tenants.
- Auditoría cross-tenant para org_owner.
- Migración de tenant entre organizaciones.

---

### Pregunta operativa

Para el bootstrap, necesito tu email para hardcodearlo en la migración.
**¿Cuál es el email con el que te vas a registrar como `platform_owner`?**
