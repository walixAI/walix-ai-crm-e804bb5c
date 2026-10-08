# AGENTS

- Sales agent behavior (profiling, format, handoff, knowledge selection) lives in supabase/functions/_shared/sales-agent.ts and is shared by WhatsApp, web chat and test; why: one brain for all channels.
- WhatsApp, contact and deal advisor panels share the contact-keyed lead brief; deal probabilities come from persisted deals and profiling completeness stays separate, because different screens must not invent competing prospect assessments.
