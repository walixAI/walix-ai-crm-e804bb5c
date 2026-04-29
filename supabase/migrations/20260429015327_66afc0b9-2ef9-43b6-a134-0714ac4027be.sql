-- Paso 1/2: Extender enum app_role con nuevos roles.
-- Debe ir en migración separada porque PostgreSQL no permite usar
-- nuevos valores de enum en la misma transacción donde se añaden.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'platform_owner';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'platform_staff';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'org_owner';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'org_member';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tenant_owner';