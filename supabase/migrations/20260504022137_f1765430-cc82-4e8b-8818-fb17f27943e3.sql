
CREATE TYPE public.whatsapp_channel_kind AS ENUM ('clients', 'team');
CREATE TYPE public.whatsapp_channel_status AS ENUM ('pending', 'connected', 'error', 'disabled');
CREATE TYPE public.whatsapp_permission_level AS ENUM ('read', 'write_light', 'write_strong');
CREATE TYPE public.whatsapp_command_status AS ENUM ('pending_confirmation', 'executed', 'rejected', 'failed');

CREATE TABLE public.whatsapp_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  kind public.whatsapp_channel_kind NOT NULL,
  provider text NOT NULL DEFAULT 'meta_cloud',
  display_name text,
  phone_number text,
  phone_number_id text,
  business_account_id text,
  access_token_secret_name text,
  verify_token text NOT NULL,
  status public.whatsapp_channel_status NOT NULL DEFAULT 'pending',
  last_error text,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, kind)
);
CREATE INDEX idx_wa_channels_phone_number_id ON public.whatsapp_channels(phone_number_id);
CREATE INDEX idx_wa_channels_verify_token ON public.whatsapp_channels(verify_token);
ALTER TABLE public.whatsapp_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant select wa channels" ON public.whatsapp_channels FOR SELECT
  USING ((tenant_id = get_user_tenant(auth.uid())) OR is_platform(auth.uid()));
CREATE POLICY "admin insert wa channels" ON public.whatsapp_channels FOR INSERT
  WITH CHECK (is_platform(auth.uid()) OR (tenant_id = get_user_tenant(auth.uid()) AND (has_role(auth.uid(),'tenant_admin'::app_role) OR has_role(auth.uid(),'tenant_owner'::app_role))));
CREATE POLICY "admin update wa channels" ON public.whatsapp_channels FOR UPDATE
  USING (is_platform(auth.uid()) OR (tenant_id = get_user_tenant(auth.uid()) AND (has_role(auth.uid(),'tenant_admin'::app_role) OR has_role(auth.uid(),'tenant_owner'::app_role))));
CREATE POLICY "admin delete wa channels" ON public.whatsapp_channels FOR DELETE
  USING (is_platform(auth.uid()) OR (tenant_id = get_user_tenant(auth.uid()) AND (has_role(auth.uid(),'tenant_admin'::app_role) OR has_role(auth.uid(),'tenant_owner'::app_role))));
CREATE TRIGGER trg_wa_channels_updated BEFORE UPDATE ON public.whatsapp_channels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.whatsapp_user_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  phone_e164 text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  permission_level public.whatsapp_permission_level NOT NULL DEFAULT 'write_light',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id),
  UNIQUE (tenant_id, phone_e164)
);
CREATE INDEX idx_wa_user_access_phone ON public.whatsapp_user_access(phone_e164);
ALTER TABLE public.whatsapp_user_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant select wa access" ON public.whatsapp_user_access FOR SELECT
  USING ((tenant_id = get_user_tenant(auth.uid())) OR is_platform(auth.uid()));
CREATE POLICY "admin insert wa access" ON public.whatsapp_user_access FOR INSERT
  WITH CHECK (is_platform(auth.uid()) OR (tenant_id = get_user_tenant(auth.uid()) AND (has_role(auth.uid(),'tenant_admin'::app_role) OR has_role(auth.uid(),'tenant_owner'::app_role))));
CREATE POLICY "admin update wa access" ON public.whatsapp_user_access FOR UPDATE
  USING (is_platform(auth.uid()) OR (tenant_id = get_user_tenant(auth.uid()) AND (has_role(auth.uid(),'tenant_admin'::app_role) OR has_role(auth.uid(),'tenant_owner'::app_role))));
CREATE POLICY "admin delete wa access" ON public.whatsapp_user_access FOR DELETE
  USING (is_platform(auth.uid()) OR (tenant_id = get_user_tenant(auth.uid()) AND (has_role(auth.uid(),'tenant_admin'::app_role) OR has_role(auth.uid(),'tenant_owner'::app_role))));
CREATE TRIGGER trg_wa_user_access_updated BEFORE UPDATE ON public.whatsapp_user_access
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.whatsapp_command_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  user_id uuid,
  channel_id uuid,
  from_phone text NOT NULL,
  prompt text NOT NULL,
  intent text,
  action_payload jsonb,
  status public.whatsapp_command_status NOT NULL DEFAULT 'executed',
  confirmation_token text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz
);
CREATE INDEX idx_wa_cmd_tenant ON public.whatsapp_command_log(tenant_id, created_at DESC);
CREATE INDEX idx_wa_cmd_token ON public.whatsapp_command_log(confirmation_token) WHERE confirmation_token IS NOT NULL;
ALTER TABLE public.whatsapp_command_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant select wa cmd log" ON public.whatsapp_command_log FOR SELECT
  USING ((tenant_id = get_user_tenant(auth.uid())) OR is_platform(auth.uid()));

ALTER TABLE public.messages ADD COLUMN channel_id uuid;
