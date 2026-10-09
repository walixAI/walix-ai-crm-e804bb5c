# AGENTS

- Sales agent behavior (profiling, format, handoff, knowledge selection) lives in supabase/functions/_shared/sales-agent.ts and is shared by WhatsApp, web chat and test; why: one brain for all channels.
- WhatsApp, contact and deal advisor panels share the contact-keyed lead brief; deal probabilities come from persisted deals and profiling completeness stays separate, because different screens must not invent competing prospect assessments.
- WhatsApp campaign enrollment runs in the webhook for new contacts plus a periodic scan in wa-campaign-worker (both via supabase/functions/_shared/wa-enroll.ts), and lead silence is measured from real inbound messages through contact_last_inbound instead of contacts.last_activity_at; why: Click-to-WhatsApp leads never pass through form intake and that column stays empty for contacts created by WhatsApp.
