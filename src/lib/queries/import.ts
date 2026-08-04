import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantId } from "@/lib/queries/tenant";

export type ImportKind = "contacts" | "products" | "deals" | "activities";

export interface ImportBatch {
  id: string;
  tenantId: string;
  kind: ImportKind;
  fileName: string | null;
  fileSize: number | null;
  totalRows: number;
  importedRows: number;
  errorRows: number;
  skippedRows: number;
  status: "pending" | "preview" | "importing" | "done" | "reverted";
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  revertedAt: string | null;
  revertedBy: string | null;
}

export interface ImportRow {
  id: string;
  batchId: string;
  rowIndex: number;
  rawData: Record<string, any>;
  mappedData: Record<string, any>;
  status: "pending" | "imported" | "error" | "skipped";
  errorMessage: string | null;
  targetTable: string | null;
  targetId: string | null;
}

function mapBatch(r: any): ImportBatch {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    kind: r.kind,
    fileName: r.file_name,
    fileSize: r.file_size,
    totalRows: r.total_rows ?? 0,
    importedRows: r.imported_rows ?? 0,
    errorRows: r.error_rows ?? 0,
    skippedRows: r.skipped_rows ?? 0,
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    revertedAt: r.reverted_at,
    revertedBy: r.reverted_by,
  };
}

function mapRow(r: any): ImportRow {
  return {
    id: r.id,
    batchId: r.batch_id,
    rowIndex: r.row_index,
    rawData: r.raw_data ?? {},
    mappedData: r.mapped_data ?? {},
    status: r.status,
    errorMessage: r.error_message,
    targetTable: r.target_table,
    targetId: r.target_id,
  };
}

export function useImportBatches() {
  const { data: tenantId } = useTenantId();
  return useQuery({
    queryKey: ["import-batches", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<ImportBatch[]> => {
      const { data, error } = await supabase
        .from("import_batches")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map(mapBatch);
    },
  });
}

export function useImportRows(batchId: string | undefined) {
  return useQuery({
    queryKey: ["import-rows", batchId],
    enabled: !!batchId,
    queryFn: async (): Promise<ImportRow[]> => {
      const { data, error } = await supabase
        .from("import_rows")
        .select("*")
        .eq("batch_id", batchId!)
        .order("row_index", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
  });
}

export interface CreateBatchInput {
  kind: ImportKind;
  fileName: string;
  fileSize: number;
  rows: Record<string, any>[];
}

export function useCreateImportBatch() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: CreateBatchInput): Promise<ImportBatch> => {
      if (!tenantId) throw new Error("No hay tenant activo");
      const { data, error } = await supabase
        .from("import_batches")
        .insert({
          tenant_id: tenantId,
          kind: input.kind,
          file_name: input.fileName,
          file_size: input.fileSize,
          total_rows: input.rows.length,
          status: "preview",
          created_by: user?.id ?? null,
        } as any)
        .select("*")
        .single();
      if (error) throw error;

      const batchId = data.id;
      const rowInserts = input.rows.map((row, idx) => ({
        batch_id: batchId,
        row_index: idx,
        raw_data: row,
        mapped_data: {},
        status: "pending",
      }));

      if (rowInserts.length > 0) {
        const { error: rowsError } = await supabase.from("import_rows").insert(rowInserts as any);
        if (rowsError) throw rowsError;
      }

      return mapBatch(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["import-batches"] }),
  });
}

export interface ConfirmImportInput {
  batchId: string;
  mappings: Record<string, string>;
}

export function useConfirmImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ConfirmImportInput) => {
      const { data, error } = await supabase.functions.invoke("import-runner", {
        body: input,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["import-batches"] });
      qc.invalidateQueries({ queryKey: ["import-rows"] });
    },
  });
}

export function useRevertImportBatch() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (batchId: string) => {
      const { data, error } = await supabase.functions.invoke("import-revert", {
        body: { batchId, revertedBy: user?.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["import-batches"] });
      qc.invalidateQueries({ queryKey: ["import-rows"] });
    },
  });
}
