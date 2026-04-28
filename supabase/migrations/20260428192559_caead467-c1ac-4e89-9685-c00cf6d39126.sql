-- 1. Enums
DO $$ BEGIN
  CREATE TYPE public.conversation_status AS ENUM ('Nuevo', 'En atención', 'Esperando', 'Resuelto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.message_type AS ENUM ('text', 'image', 'document', 'audio', 'location');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Extender conversations
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS status public.conversation_status NOT NULL DEFAULT 'Nuevo',
  ADD COLUMN IF NOT EXISTS assignee_id uuid,
  ADD COLUMN IF NOT EXISTS deal_id uuid,
  ADD COLUMN IF NOT EXISTS internal_notes text;

-- 3. Extender messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS type public.message_type NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS is_internal_note boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- 4. Plantillas
CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  content text NOT NULL,
  category text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant select message_templates" ON public.message_templates
  FOR SELECT USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "tenant insert message_templates" ON public.message_templates
  FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "tenant update message_templates" ON public.message_templates
  FOR UPDATE USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "tenant delete message_templates" ON public.message_templates
  FOR DELETE USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE TRIGGER message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Seed plantillas para tenants existentes
INSERT INTO public.message_templates (tenant_id, name, content, category)
SELECT t.id, x.name, x.content, x.category
FROM public.tenants t
CROSS JOIN (VALUES
  ('Bienvenida', 'Hola {nombre}, soy {vendedor} de {empresa}. ¿En qué puedo ayudarte?', 'saludo'),
  ('Seguimiento', 'Hola {nombre}, ¿cómo avanzó lo que platicamos sobre {monto}?', 'seguimiento'),
  ('Propuesta lista', 'Hola {nombre}, aquí está tu propuesta personalizada: [link]', 'propuesta'),
  ('Cierre', '{nombre}, solo quería confirmar si tienes preguntas antes de proceder.', 'cierre')
) AS x(name, content, category)
WHERE NOT EXISTS (
  SELECT 1 FROM public.message_templates mt WHERE mt.tenant_id = t.id AND mt.name = x.name
);

-- 6. Realtime
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7. Índices
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_last_msg ON public.conversations(tenant_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_sent ON public.messages(conversation_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_conversations_assignee ON public.conversations(tenant_id, assignee_id);