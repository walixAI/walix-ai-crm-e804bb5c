# Incoming browser calls

- Register receiving-only Twilio Devices through useIncomingBrowserCall for the active tenant, and destroy them and calls when identity or tenant changes; why: reception must work across pages without keeping another company's audio session.
- Inbound browser identities include tenant and user, and signed Client acceptance validates recipient, current membership and active tenant before the atomic answer claim; why: accepting a browser notification cannot authorize or fabricate a connection.