
-- Helper function: get tenant for current user (SECURITY DEFINER, no recursion)
CREATE OR REPLACE FUNCTION public.get_user_tenant(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = _user_id
$$;

-- Enums
CREATE TYPE public.lead_status AS ENUM ('Nuevo', 'Contactado', 'Calificado', 'En negociación', 'Cliente', 'Inactivo');
CREATE TYPE public.lead_source AS ENUM ('WhatsApp', 'Formulario web', 'Referido', 'Manual');
CREATE TYPE public.tag_family AS ENUM ('temperature', 'cycle', 'special');
CREATE TYPE public.activity_type AS ENUM ('wa_sent', 'wa_received', 'note', 'deal', 'task');
CREATE TYPE public.message_direction AS ENUM ('inbound', 'outbound');

-- ============ CONTACT_TAGS (catalog) ============
CREATE TABLE public.contact_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  family public.tag_family NOT NULL DEFAULT 'special',
  icon text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

-- ============ PIPELINE_STAGES ============
CREATE TABLE public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ CONTACTS ============
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  last_name text,
  phone text NOT NULL,
  email text,
  company text,
  position text,
  status public.lead_status NOT NULL DEFAULT 'Nuevo',
  source public.lead_source NOT NULL DEFAULT 'Manual',
  tags text[] NOT NULL DEFAULT '{}',
  avatar_color text,
  last_activity_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_contacts_tenant ON public.contacts(tenant_id);
CREATE INDEX idx_contacts_owner ON public.contacts(owner_id);
CREATE INDEX idx_contacts_status ON public.contacts(status);

-- ============ DEALS ============
CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  stage_name text,
  probability int NOT NULL DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  expected_close_date date,
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_deals_tenant ON public.deals(tenant_id);
CREATE INDEX idx_deals_contact ON public.deals(contact_id);

-- ============ ACTIVITIES ============
CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type public.activity_type NOT NULL,
  description text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activities_tenant ON public.activities(tenant_id);
CREATE INDEX idx_activities_contact ON public.activities(contact_id);
CREATE INDEX idx_activities_occurred ON public.activities(occurred_at DESC);

-- ============ CONVERSATIONS ============
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  preview text,
  unread_count int NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_conversations_tenant ON public.conversations(tenant_id);
CREATE INDEX idx_conversations_contact ON public.conversations(contact_id);

-- ============ MESSAGES ============
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  direction public.message_direction NOT NULL,
  body text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);

-- ============ TASKS ============
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  due_at timestamptz,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_tenant ON public.tasks(tenant_id);
CREATE INDEX idx_tasks_contact ON public.tasks(contact_id);

-- ============ AI_SUGGESTIONS ============
CREATE TABLE public.ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  text text NOT NULL,
  cta text,
  kind text,
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_suggestions_tenant ON public.ai_suggestions(tenant_id);

-- ============ updated_at triggers ============
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_deals_updated BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Enable RLS ============
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;

-- ============ Generic tenant-scoped policies ============
-- contact_tags
CREATE POLICY "tenant select contact_tags" ON public.contact_tags FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "tenant insert contact_tags" ON public.contact_tags FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "tenant update contact_tags" ON public.contact_tags FOR UPDATE
  USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "tenant delete contact_tags" ON public.contact_tags FOR DELETE
  USING (tenant_id = public.get_user_tenant(auth.uid()));

-- pipeline_stages
CREATE POLICY "tenant select pipeline_stages" ON public.pipeline_stages FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "tenant insert pipeline_stages" ON public.pipeline_stages FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "tenant update pipeline_stages" ON public.pipeline_stages FOR UPDATE
  USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "tenant delete pipeline_stages" ON public.pipeline_stages FOR DELETE
  USING (tenant_id = public.get_user_tenant(auth.uid()));

-- contacts
CREATE POLICY "tenant select contacts" ON public.contacts FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "tenant insert contacts" ON public.contacts FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "tenant update contacts" ON public.contacts FOR UPDATE
  USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "tenant delete contacts" ON public.contacts FOR DELETE
  USING (tenant_id = public.get_user_tenant(auth.uid()));

-- deals
CREATE POLICY "tenant select deals" ON public.deals FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "tenant insert deals" ON public.deals FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "tenant update deals" ON public.deals FOR UPDATE
  USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "tenant delete deals" ON public.deals FOR DELETE
  USING (tenant_id = public.get_user_tenant(auth.uid()));

-- activities
CREATE POLICY "tenant select activities" ON public.activities FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "tenant insert activities" ON public.activities FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "tenant update activities" ON public.activities FOR UPDATE
  USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "tenant delete activities" ON public.activities FOR DELETE
  USING (tenant_id = public.get_user_tenant(auth.uid()));

-- conversations
CREATE POLICY "tenant select conversations" ON public.conversations FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "tenant insert conversations" ON public.conversations FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "tenant update conversations" ON public.conversations FOR UPDATE
  USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "tenant delete conversations" ON public.conversations FOR DELETE
  USING (tenant_id = public.get_user_tenant(auth.uid()));

-- messages
CREATE POLICY "tenant select messages" ON public.messages FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "tenant insert messages" ON public.messages FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "tenant update messages" ON public.messages FOR UPDATE
  USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "tenant delete messages" ON public.messages FOR DELETE
  USING (tenant_id = public.get_user_tenant(auth.uid()));

-- tasks
CREATE POLICY "tenant select tasks" ON public.tasks FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "tenant insert tasks" ON public.tasks FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "tenant update tasks" ON public.tasks FOR UPDATE
  USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "tenant delete tasks" ON public.tasks FOR DELETE
  USING (tenant_id = public.get_user_tenant(auth.uid()));

-- ai_suggestions
CREATE POLICY "tenant select ai_suggestions" ON public.ai_suggestions FOR SELECT
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "tenant insert ai_suggestions" ON public.ai_suggestions FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "tenant update ai_suggestions" ON public.ai_suggestions FOR UPDATE
  USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "tenant delete ai_suggestions" ON public.ai_suggestions FOR DELETE
  USING (tenant_id = public.get_user_tenant(auth.uid()));
