
-- ============ ai_entity_context ============
CREATE TABLE public.ai_entity_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contact','deal','conversation','team')),
  entity_id UUID NOT NULL,
  context_summary TEXT NOT NULL DEFAULT '',
  key_facts JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_interaction TIMESTAMPTZ,
  sentiment TEXT NOT NULL DEFAULT 'unknown' CHECK (sentiment IN ('positive','neutral','negative','unknown')),
  urgency_score INTEGER NOT NULL DEFAULT 0 CHECK (urgency_score BETWEEN 0 AND 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_type, entity_id)
);

ALTER TABLE public.ai_entity_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant select ai_entity_context" ON public.ai_entity_context
  FOR SELECT USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));
CREATE POLICY "tenant insert ai_entity_context" ON public.ai_entity_context
  FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "tenant update ai_entity_context" ON public.ai_entity_context
  FOR UPDATE USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "tenant delete ai_entity_context" ON public.ai_entity_context
  FOR DELETE USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE TRIGGER trg_ai_entity_context_updated_at
  BEFORE UPDATE ON public.ai_entity_context
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_ai_context_entity ON public.ai_entity_context(tenant_id, entity_type, entity_id);

-- ============ ai_memory_events ============
CREATE TABLE public.ai_memory_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_memory_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant select ai_memory_events" ON public.ai_memory_events
  FOR SELECT USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));
CREATE POLICY "tenant insert ai_memory_events" ON public.ai_memory_events
  FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE INDEX idx_ai_events_entity ON public.ai_memory_events(tenant_id, entity_id, created_at DESC);

-- Trigger: update last_interaction on context table
CREATE OR REPLACE FUNCTION public.update_ai_context_from_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_entity_context (tenant_id, entity_type, entity_id, last_interaction)
  VALUES (NEW.tenant_id, NEW.entity_type, NEW.entity_id, NEW.created_at)
  ON CONFLICT (tenant_id, entity_type, entity_id)
  DO UPDATE SET last_interaction = EXCLUDED.last_interaction,
                updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ai_memory_events_update_context
  AFTER INSERT ON public.ai_memory_events
  FOR EACH ROW EXECUTE FUNCTION public.update_ai_context_from_event();

-- ============ ai_proactive_suggestions ============
CREATE TABLE public.ai_proactive_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT,
  entity_id UUID,
  suggestion_text TEXT NOT NULL,
  action_type TEXT,
  action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  shown_at TIMESTAMPTZ,
  acted_on BOOLEAN NOT NULL DEFAULT FALSE,
  dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_proactive_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant select ai_proactive_suggestions" ON public.ai_proactive_suggestions
  FOR SELECT USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.is_platform(auth.uid()));
CREATE POLICY "tenant insert ai_proactive_suggestions" ON public.ai_proactive_suggestions
  FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "recipient or admin updates ai_proactive_suggestions" ON public.ai_proactive_suggestions
  FOR UPDATE USING (
    tenant_id = public.get_user_tenant(auth.uid())
    AND (target_user_id IS NULL OR target_user_id = auth.uid()
         OR public.has_role(auth.uid(), 'tenant_admin'::app_role)
         OR public.has_role(auth.uid(), 'tenant_owner'::app_role))
  );
CREATE POLICY "admin deletes ai_proactive_suggestions" ON public.ai_proactive_suggestions
  FOR DELETE USING (
    tenant_id = public.get_user_tenant(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin'::app_role)
         OR public.has_role(auth.uid(), 'tenant_owner'::app_role))
  );

CREATE INDEX idx_ai_suggestions_user ON public.ai_proactive_suggestions(target_user_id, dismissed, expires_at);

-- ============ ai_conversation_history ============
CREATE TABLE public.ai_conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','tool')),
  content TEXT NOT NULL,
  tool_calls JSONB NOT NULL DEFAULT '[]'::jsonb,
  context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_conversation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner or admin select ai_conversation_history" ON public.ai_conversation_history
  FOR SELECT USING (
    public.is_platform(auth.uid())
    OR (tenant_id = public.get_user_tenant(auth.uid())
        AND (user_id = auth.uid()
             OR public.has_role(auth.uid(), 'tenant_admin'::app_role)
             OR public.has_role(auth.uid(), 'tenant_owner'::app_role)))
  );
CREATE POLICY "owner inserts ai_conversation_history" ON public.ai_conversation_history
  FOR INSERT WITH CHECK (
    tenant_id = public.get_user_tenant(auth.uid()) AND user_id = auth.uid()
  );
CREATE POLICY "owner deletes ai_conversation_history" ON public.ai_conversation_history
  FOR DELETE USING (
    tenant_id = public.get_user_tenant(auth.uid()) AND user_id = auth.uid()
  );

CREATE INDEX idx_ai_history_session ON public.ai_conversation_history(session_id, created_at);
