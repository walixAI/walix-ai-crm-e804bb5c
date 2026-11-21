export function inboundBrowserIdentity(tenantId: string, userId: string): string {
  return `walix_${tenantId.replace(/-/g, "")}_${userId.replace(/-/g, "")}`;
}

export function inboundBrowserRecipients(ids: string[], open: boolean, target: string, phoneCount = 0): string[] {
  // Reserve destinations for optional phones when both modes ring together.
  const limit = 10 - Math.min(phoneCount, 5);
  return open && target !== "voicemail" ? [...new Set(ids)].slice(0, limit) : [];
}

export function matchesInboundBrowser(tenantId: string, userId: string, to: string, recipients: string[]): boolean {
  return recipients.includes(userId) && to === `client:${inboundBrowserIdentity(tenantId, userId)}`;
}