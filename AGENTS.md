# AGENTS

- Platform demo sends use a deployment-controlled gate before credentials or network access, never a caller-provided enable flag; why: disabling demos must block direct endpoint calls without affecting normal messaging.

- Scheduled HTTP workers validate managed cron authentication or an exact server credential; schedules use the managed scheduling tools; why: unauthenticated requests and decoded role claims cannot authorize global work.
- Meta inbound events verify HMAC-SHA256 over the untouched body before processing; why: forged provider events must not create records or send replies.
- Mail sockets resolve and reject non-public addresses, pin the selected address and preserve TLS servername; why: configurable SMTP/IMAP must not reach private networks or follow DNS rebinding.
- Client AI history accepts bounded user/assistant text only and strips extra fields; why: server instructions and tool roles cannot come from caller-supplied messages.
- Identity RPCs return only the caller's active tenant, and coworker forecasts require active-tenant ownership/admin or platform permission; why: SECURITY DEFINER reads need explicit caller scope.
- Invitation signup accepts only pending invitations; why: revoked links must never assign roles.

- QA account administration is retired and always returns 410; why: production must never expose test password resets or caller-selected roles.
- Query caches are cancelled and cleared on identity, active-tenant or role changes; private reports use scoped in-memory queries, not shared browser storage; why: shared devices must never reuse another user's commercial data.
- Sensitive channel/account columns have no authenticated SELECT grant; callers select safe metadata and a generated configuration flag; why: RLS alone does not hide secrets inside an authorized row.
- Public chat never links a claimed phone/email to an existing contact or reads private cross-channel history; only session-created isolated contacts may be updated; why: visitor identity claims are not proof of ownership.
- Import execution/reversal requires active-tenant management authorization, fixed target tables and tenant-scoped deletion; result columns are server-managed; why: import identifiers and row metadata cannot authorize privileged operations.
- Losses use stable lost_at maintained by a trigger; unknown historical dates stay null, never updated_at; why: later edits must not move historical losses between periods.
- Aggregate queries use readAllPages with stable ordering and propagate page failures; document deletion backs up files and restores on failure; why: truncation and partial deletion must not masquerade as complete success.
- Reports refresh on a stable tenant/filter query key and resolve relative dates inside each fetch; why: periodic refresh must retain visible data without sharing data across tenants or filters.

- Team role changes use the authenticated change_tenant_member_role RPC, restricted to the active tenant owner/platform and audited with auth.uid(); why: atomic tenant-scoped changes must not expose direct role writes or accept caller-supplied actor identities.

- DB triggers synchronize opportunity stage/product labels; views share latestActiveOpportunity and invalidate contact/history queries; why: screens must agree. Explicit new programs override old contact profiles; existing name/amount edits share EditDealQuickDialog; why: no inherited names or duplicate editors.
- Profile-derived opportunity names and confirmed numeric amounts/catalog prices are synchronized by contact/deal triggers to the latest open deal, tracking last auto-filled values to preserve advisor overrides; why: bot and advisor profiling must behave identically without guessing prices or changing historical opportunities.

- Shell uses overflow-x-clip (no duplicate scrollbars); documents use a private bucket with signed links.

- Sales agent behavior lives in supabase/functions/_shared/sales-agent.ts, shared by WhatsApp, web chat and test; why: one brain for all channels.
- WhatsApp, contact and deal advisor panels share the contact-keyed lead brief; deal probabilities come from persisted deals and profiling completeness stays separate, because different screens must not invent competing prospect assessments.
- WhatsApp campaign enrollment runs in the webhook for new contacts plus a periodic scan in wa-campaign-worker (both via supabase/functions/_shared/wa-enroll.ts), and lead silence is measured from real inbound messages through contact_last_inbound instead of contacts.last_activity_at; why: Click-to-WhatsApp leads never pass through form intake and that column stays empty for contacts created by WhatsApp.
- Email credentials are AES-GCM encrypted (EMAIL_CRED_SECRET), handled only in email-api/email-worker; thread visibility by RLS (owner/contact owner, supervisors via email_is_supervisor); why: advisors see only their leads' mail and secrets never reach the browser.
- Bulk email only via tenant providers (Brevo, SendGrid, Mandrill, SES, Mailgun, SMTP) with signed unsubscribe and per-tenant suppression; why: personal Gmail/Outlook get blocked by volume and built-in email forbids marketing.
- Built-in stage milestones: DB triggers on messages, email_messages and activities advance open deals forward-only to stages matched by name (Intento de contacto, Contactado, Calificado, Agendado/Entrevista/Reunión, Propuesta/Inscripción) from replies and outcome text, independent of pipeline_stage_rules; payment→won uses pipeline_stage_rules; why: reliable funnel movement without per-tenant configuration.
- WhatsApp messages and emails are mirrored into activities by DB triggers; why: the lead's activity timeline must show bot and advisor follow-ups without each sender logging them.
- After a handoff the sales agent keeps answering until a human advisor sends a message in that conversation; why: leads must not be left in silence while waiting for the advisor.
- WhatsApp no-reply alerts use the tenant-scoped agent-no-reply helper and deduplicate by recipient, reason and conversation for 24 hours; why: supervisors must receive daily-limit notices even if an advisor already received another alert.

- Human-attention views share pending_human_attention, authorized server-side by tenant and owner/supervisor role; pending ends only with a real human response or completed contact task, never a bot reply or opening the alert, so all work views agree.
- Pending human attention shows once in the sticky TopBar; why: no duplicates.
- Sales reps (sales_rep without admin/manager role in that tenant) only see/update their own leads, enforced by restrictive RLS via is_rep_only/rep_owns_contact; frontend roles are filtered to the active tenant; why: users can hold different roles in different tenants.

- Contact reassignment uses authenticated reassign_contact_atomic, checking tenant/ownership and moving open deals, conversations and pending tasks; why: transfers must be secure and consistent.
- WhatsApp readiness uses credential-free RPCs; send resolves tenant/channel credentials server-side after caller-RLS authorization; why: reps must send without accessing secrets.
- Screen layouts resolve catalog → group:advisor|supervisor (or tenant_default) → user:<id>; users never reveal group-hidden or hide locked sections; why: tenants control each user level.
- Typifications live in outcome_typifications, stored on activities.metadata.typification_*; why: drill-down needs structured data.
- WhatsApp number protection (opt-out, consent, pause, failure brake, ramp, platform caps) lives in wa_template_policy_check for all outbound paths; why: one guard so no tenant risks a number.
- Lead briefs regenerate only on real messages/activities (3-min burst debounce) or manual refresh; screens read the stored brief; why: no AI spend on page views.
- AI edge functions log usage via recordAiUsage or _shared/ai-track.ts (surface = function key); why: metrics cover every feature.
- Call start failures remain visible and device dialing is explicit; manual outcomes reuse LogFollowUpDialog, while provider outcomes require a returned call ID; why: a tel: handoff does not confirm a call or justify a fabricated result.
- Tenant-specific opportunity naming is configured via tenants.deal_name_template (NULL = default) and applied in sync_opportunity_labels through deal_auto_name, recalculating only while the name equals profile_auto_name; why: per-tenant behavior lives in data, never hardcoded tenant checks, and advisor edits win.
- Pipeline "active" lens counts open deals from creation until closed, regardless of period start; why: stage filters must never hide live opportunities created in earlier months.
