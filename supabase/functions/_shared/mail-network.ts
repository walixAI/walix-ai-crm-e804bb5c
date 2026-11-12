import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const blocked = new BlockList();
const blockedV6 = new BlockList();
for (const [ip, prefix] of [["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],["169.254.0.0",16],["172.16.0.0",12],["192.168.0.0",16],["192.0.0.0",24],["192.0.2.0",24],["198.18.0.0",15],["198.51.100.0",24],["203.0.113.0",24],["224.0.0.0",4],["240.0.0.0",4]] as const) blocked.addSubnet(ip, prefix, "ipv4");
for (const [ip, prefix] of [["::",128],["::1",128],["::ffff:0:0",96],["64:ff9b::",96],["64:ff9b:1::",48],["100::",64],["2001::",32],["2001:db8::",32],["2002::",16],["fc00::",7],["fe80::",10],["ff00::",8]] as const) blockedV6.addSubnet(ip,prefix,"ipv6");

export function isPublicMailIp(ip: string): boolean {
  const family = isIP(ip);
  return family === 4 ? !blocked.check(ip, "ipv4") : family === 6 && !blockedV6.check(ip, "ipv6");
}

export async function publicMailTarget(host: string | null, port: number, kind: "smtp" | "imap") {
  if (!host || host.length > 253 || !/^[a-z0-9.-]+$/i.test(host) ||
    !(kind === "smtp" ? [25,465,587,2525] : [143,993]).includes(port)) throw new Error("Servidor de correo no permitido");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addresses.length || addresses.some(a => !isPublicMailIp(a.address))) throw new Error("Servidor de correo no permitido");
  // Pin the validated address, retaining the hostname only for TLS certificate verification.
  return { host: addresses[0].address, servername: isIP(host) ? undefined : host };
}