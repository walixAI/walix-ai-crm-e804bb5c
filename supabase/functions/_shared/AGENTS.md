# Telephony rules

- Inbound phone forwarding defaults off per tenant/user and is changed through telephony-api after active membership and destination validation; why: receiving choices must not create unauthorized spending or forwarding loops.
- Real inbound advisors accept with a provider-signed digit before bridging; missed calls use persisted provider results, and database triggers deliver scoped, deduplicated alerts; why: voicemail, greetings, popup clicks and retries must not fabricate attended calls.