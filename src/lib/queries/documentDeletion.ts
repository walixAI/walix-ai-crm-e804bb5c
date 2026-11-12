export async function recoverableDelete<T>(paths: string[], operations: {
  backup: (path: string) => Promise<T>;
  remove: (paths: string[]) => Promise<void>;
  deleteRecord: () => Promise<void>;
  restore: (path: string, backup: T) => Promise<void>;
}) {
  const backups = await Promise.all(paths.map(async (path) => ({ path, data: await operations.backup(path) })));
  try {
    if (paths.length) await operations.remove(paths);
    await operations.deleteRecord();
  } catch (error) {
    const restored = await Promise.allSettled(backups.map(({ path, data }) => operations.restore(path, data)));
    if (restored.some((r) => r.status === "rejected")) {
      throw new Error("No se completó la eliminación ni la recuperación de todos los archivos. Conservamos el registro; vuelve a intentar.");
    }
    throw error;
  }
}