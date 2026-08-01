CREATE OR REPLACE TRIGGER trg_deals_stage_log
  AFTER INSERT OR UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.log_deal_stage_change();

DROP TRIGGER IF EXISTS trg_messages_stage_rules ON public.messages;
CREATE TRIGGER trg_messages_stage_rules
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_apply_stage_rules_on_message();

DROP TRIGGER IF EXISTS trg_activities_stage_rules ON public.activities;
CREATE TRIGGER trg_activities_stage_rules
  AFTER INSERT ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_apply_stage_rules_on_activity();

DROP TRIGGER IF EXISTS trg_tasks_stage_rules ON public.tasks;
CREATE TRIGGER trg_tasks_stage_rules
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_apply_stage_rules_on_task();

DROP TRIGGER IF EXISTS trg_deals_payment_stage_rules ON public.deals;
CREATE TRIGGER trg_deals_payment_stage_rules
  AFTER UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_apply_stage_rules_on_payment();

COMMENT ON TABLE public.pipeline_stage_rules IS 'Reglas de avance automático entre etapas de un pipeline.';