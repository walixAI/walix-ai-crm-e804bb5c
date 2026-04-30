import { createContext, useContext, type ReactNode } from "react";
import type { ReportsData } from "@/lib/queries/reports";
import type { TenantUser } from "@/lib/queries/tenantUsers";

interface ReportsCtx {
  data: ReportsData | null;
  isLoading: boolean;
  users: TenantUser[];
}

const Ctx = createContext<ReportsCtx | null>(null);

export function ReportsProvider({ value, children }: { value: ReportsCtx; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useReportsContext(): ReportsCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useReportsContext must be used inside ReportsProvider");
  return v;
}