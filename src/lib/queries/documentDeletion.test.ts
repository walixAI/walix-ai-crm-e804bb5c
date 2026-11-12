import { expect, it, vi } from "vitest";
import { recoverableDelete } from "./documentDeletion";

it("does not delete the record when removing its file fails", async () => {
  const deleteRecord = vi.fn();
  const restore = vi.fn().mockResolvedValue(undefined);
  await expect(recoverableDelete(["file"], { backup: async () => "contents", remove: async () => { throw new Error("storage failure"); }, deleteRecord, restore })).rejects.toThrow("storage failure");
  expect(deleteRecord).not.toHaveBeenCalled();
  expect(restore).toHaveBeenCalledWith("file", "contents");
});
it("restores files when record deletion fails", async () => {
  const restore = vi.fn().mockResolvedValue(undefined);
  await expect(recoverableDelete(["file"], { backup: async () => "contents", remove: async () => {}, deleteRecord: async () => { throw new Error("record failure"); }, restore })).rejects.toThrow("record failure");
  expect(restore).toHaveBeenCalledWith("file", "contents");
});