export function matchesServiceCredential(auth: string | null, secret: string | undefined): boolean {
  return !!secret && auth === `Bearer ${secret}`;
}

export function safeConversation(value: unknown, limit = 20): { role: "user" | "assistant"; content: string }[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) throw new Error("Conversación inválida");
  return value.slice(-limit).map((message) => {
    if (!message || !["user", "assistant"].includes(message.role) ||
      typeof message.content !== "string" || message.content.length > 20000) throw new Error("Conversación inválida");
    return { role: message.role, content: message.content };
  });
}