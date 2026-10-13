# AGENTS

- Team role changes use the authenticated change_tenant_member_role RPC, restricted to the active tenant owner/platform and audited with auth.uid(); why: atomic tenant-scoped changes must not expose direct role writes or accept caller-supplied actor identities.

- DB triggers synchronize opportunity stage/product labels; views share latestActiveOpportunity and invalidate contact/history queries; why: screens must agree. Explicit new programs override old contact profiles; existing name/amount edits share EditDealQuickDialog; why: no inherited names or duplicate editors.
- Profile-derived opportunity names and confirmed numeric amounts/catalog prices are synchronized by contact/deal triggers to the latest open deal, tracking last auto-filled values to preserve advisor overrides; why: bot and advisor profiling must behave identically without guessing prices or changing historical opportunities.

- The authenticated shell uses overflow-x-clip, not overflow-x-hidden, so the document owns vertical scrolling; nested desktop scrollbars are subtle and interactive, and Kanban totals wrap instead of creating a second horizontal scroller.

- Sales agent behavior (profiling, format, handoff, knowledge selection) lives in supabase/functions/_shared/sales-agent.ts and is shared by WhatsApp, web chat and test; why: one brain for all channels.
- WhatsApp, contact and deal advisor panels share the contact-keyed lead brief; deal probabilities come from persisted deals and profiling completeness stays separate, because different screens must not invent competing prospect assessments.
- WhatsApp campaign enrollment runs in the webhook for new contacts plus a periodic scan in wa-campaign-worker (both via supabase/functions/_shared/wa-enroll.ts), and lead silence is measured from real inbound messages through contact_last_inbound instead of contacts.last_activity_at; why: Click-to-WhatsApp leads never pass through form intake and that column stays empty for contacts created by WhatsApp.
- Email module: all mailbox/provider credentials are AES-GCM encrypted (EMAIL_CRED_SECRET) and only handled in email-api/email-worker; thread visibility is enforced by RLS (owner or contact owner, supervisors via email_is_supervisor); why: advisors must only see their leads' mail and secrets must never reach the browser.
- Bulk email goes only through tenant-configured providers (Brevo, SendGrid, Mandrill, SES, Mailgun, SMTP) with mandatory signed unsubscribe and per-tenant suppression; why: personal Gmail/Outlook accounts get blocked by volume and Lovable built-in email forbids marketing.
- Built-in stage milestones: DB triggers on messages, email_messages and activities advance open deals forward-only to stages matched by name (Intento de contacto, Contactado, Calificado, Agendado/Entrevista/Reunión, Propuesta/Inscripción) from replies and outcome text, independent of pipeline_stage_rules; payment→won uses pipeline_stage_rules; why: reliable funnel movement without per-tenant configuration.
- WhatsApp messages and emails are mirrored into activities by DB triggers (WhatsApp grouped per conversation in 30-minute blocks; agent handoff notes as notes); why: the lead's activity timeline must show bot and advisor follow-ups without each sender logging them.
- After a handoff the sales agent keeps answering until a human advisor sends a message in that conversation; why: leads must not be left in silence while waiting for the advisor.
- WhatsApp no-reply alerts use the tenant-scoped agent-no-reply helper and deduplicate by recipient, reason and conversation for 24 hours; why: supervisors must receive daily-limit notices even if an advisor already received another alert.

- Human-attention views share pending_human_attention, authorized server-side by tenant and owner/supervisor role; pending ends only with a real human response or completed contact task, never a bot reply or opening the alert, so all work views agree.
- Pending human attention is displayed once in the shared sticky TopBar below Copilot, not in page-local panels; why: pending leads remain reachable across all authenticated sections without duplicating content.
- Sales reps (sales_rep without admin/manager role in that tenant) only see/update their own leads, enforced by restrictive RLS via is_rep_only/rep_owns_contact; frontend roles are filtered to the active tenant; why: users can hold different roles in different tenants.

- Contact reassignment uses authenticated reassign_contact_atomic, checking tenant/ownership and moving open deals, conversations and pending tasks; why: transfers must be secure and consistent.
- WhatsApp readiness uses credential-free RPCs; send resolves exact tenant/channel credentials server-side after caller-RLS conversation authorization; why: reps must send without accessing secrets.
- Tenant documents: private bucket, category flags gate advisors/agent, non-reps manage, signed links; shared document-name normalizes upload/send titles; why: private access and bounded names across channels.
