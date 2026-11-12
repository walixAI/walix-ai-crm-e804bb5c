export async function readAllPages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size = 500): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const result = await fetchPage(from, from + size - 1);
    if (result.error) throw result.error;
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < size) return rows;
  }
}