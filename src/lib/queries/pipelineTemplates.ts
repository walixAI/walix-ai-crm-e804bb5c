import { useMemo } from "react";
import { useTenantFeatures, useIsRefrigerationIndustry } from "./tenantFeatures";

export interface PipelineTemplateOption {
  value: string;
  label: string;
}

export function usePipelineTemplateOptions(): PipelineTemplateOption[] {
  const { data: features, isLoading } = useTenantFeatures();
  const isRefrigeration = useIsRefrigerationIndustry();
  const showAll = isLoading || features?.feature_deal_types || isRefrigeration;

  return useMemo(() => {
    const base: PipelineTemplateOption[] = [{ value: "ventas", label: "Ventas genéricas" }];
    if (showAll) {
      base.push(
        { value: "mantenimiento", label: "Mantenimiento" },
        { value: "refacciones", label: "Refacciones" },
        { value: "renovaciones", label: "Renovaciones" },
      );
    }
    return base;
  }, [showAll]);
}
