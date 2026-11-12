import { QueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { useCopilot } from "@/store/copilot";

export function privateScope(state: { user: { id: string } | null; activeTenantId: string | null; roles: string[] }) {
  return JSON.stringify([state.user?.id ?? null, state.activeTenantId, [...state.roles].sort()]);
}

export function clearPrivateCache(client: QueryClient) {
  void client.cancelQueries();
  client.clear();
  useCopilot.getState().resetSession();
  try {
    for (const storage of [localStorage, sessionStorage]) {
      for (const key of Object.keys(storage)) {
        if (key.startsWith("walix.weeklyReport.")) storage.removeItem(key);
      }
    }
  } catch { /* Browser storage may be unavailable. */ }
}

export function watchPrivateScope(client: QueryClient) {
  return useAuthStore.subscribe((state, previous) => {
    if (privateScope(state) !== privateScope(previous)) clearPrivateCache(client);
  });
}