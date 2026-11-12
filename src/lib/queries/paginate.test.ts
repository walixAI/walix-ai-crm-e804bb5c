import { expect, it } from "vitest";
import { readAllPages } from "./paginate";

it("reads all 2169 opportunities instead of truncating at 1000", async () => {
  const source = Array.from({ length: 2169 }, (_, id) => ({ id }));
  const result = await readAllPages((from, to) => Promise.resolve({ data: source.slice(from, to + 1), error: null }));
  expect(result).toHaveLength(2169);
  expect(result[2168].id).toBe(2168);
});
it("rejects partial results when a later page fails", async () => {
  await expect(readAllPages((from) => Promise.resolve({ data: from === 0 ? [{ id: 1 }] : null, error: from > 0 ? new Error("failed") : null }), 1)).rejects.toThrow("failed");
});