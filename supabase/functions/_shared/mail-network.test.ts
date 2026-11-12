import { it, expect } from "vitest";
import { isPublicMailIp, publicMailTarget } from "./mail-network";
it("blocks private, mapped, local and metadata network destinations", async () => {
  for (const ip of ["127.0.0.1","10.0.0.1","172.16.0.1","192.168.0.1","169.254.169.254","100.64.0.1","::1","::ffff:127.0.0.1","fc00::1","fe80::1"]) expect(isPublicMailIp(ip), ip).toBe(false);
  expect(isPublicMailIp("8.8.8.8")).toBe(true);
  expect(isPublicMailIp("2606:4700:4700::1111")).toBe(true);
  await expect(publicMailTarget("127.0.0.1",465,"smtp")).rejects.toThrow();
  await expect(publicMailTarget("2130706433",465,"smtp")).rejects.toThrow();
  await expect(publicMailTarget("example.com",80,"smtp")).rejects.toThrow();
});