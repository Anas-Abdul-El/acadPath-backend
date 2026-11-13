import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import type { BrowserContext } from "playwright";
import { portalConfig } from "../../config/portal.js";

/**
 * The remote browser runs on our server, and the student drives it. Without limits a
 * student could point it at our own network (localhost, the database, cloud metadata
 * at 169.254.169.254…) and read the result on screen: that's SSRF.
 *
 * So every request the browser makes goes through guardContext():
 *   - page navigations (any frame) may only go to the allowed portal domains
 *   - no request at all may reach a private, loopback or link-local address,
 *     checked after DNS resolution so "evil.example → 127.0.0.1" is blocked too
 *   - only http(s)
 */

// Address ranges that must never be reached from the remote browser.
const privateRanges = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  privateRanges.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const)
  privateRanges.addSubnet(network, prefix, "ipv6");

export const isPrivateAddress = (address: string): boolean => {
  // "::ffff:127.0.0.1" is an IPv4 address written as IPv6.
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const ip = mapped ?? address;
  const family = isIP(ip);
  if (family === 0) return true; // not an IP: treat as unsafe
  return privateRanges.check(ip, family === 4 ? "ipv4" : "ipv6");
};

/** Is the hostname one of the portal domains (or a subdomain of one)? */
export const isAllowedPortalHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return portalConfig.allowedHosts.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
};

// DNS answers are cached for a minute so pages with many resources stay fast.
const DNS_TTL_MS = 60_000;
const dnsCache = new Map<string, { safe: boolean; expires: number }>();

/** Does the hostname resolve only to public addresses? */
export const isPublicHost = async (hostname: string): Promise<boolean> => {
  const host = hostname.replace(/^\[|\]$/g, ""); // IPv6 literals come in brackets
  if (isIP(host)) return !isPrivateAddress(host);
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local"))
    return false;

  const cached = dnsCache.get(host);
  if (cached && cached.expires > Date.now()) return cached.safe;

  let safe = false;
  try {
    const addresses = await lookup(host, { all: true });
    safe = addresses.length > 0 && addresses.every(({ address }) => !isPrivateAddress(address));
  } catch {
    safe = false; // can't resolve: the browser couldn't load it either
  }
  if (dnsCache.size > 2_000) dnsCache.clear();
  dnsCache.set(host, { safe, expires: Date.now() + DNS_TTL_MS });
  return safe;
};

const parseHttpUrl = (raw: string): URL | null => {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
};

/** Installs the request rules on a browser context. Call before opening any page. */
export const guardContext = async (context: BrowserContext): Promise<void> => {
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = parseHttpUrl(request.url());
    if (!url) return route.abort("blockedbyclient");
    if (request.isNavigationRequest() && !isAllowedPortalHost(url.hostname))
      return route.abort("blockedbyclient");
    if (!(await isPublicHost(url.hostname))) return route.abort("blockedbyclient");
    return route.continue();
  });

  // WebSockets opened by pages: only to the portal itself.
  await context.routeWebSocket(/.*/, async (ws) => {
    const url = parseHttpUrl(ws.url().replace(/^ws/, "http"));
    if (url && isAllowedPortalHost(url.hostname) && (await isPublicHost(url.hostname)))
      ws.connectToServer();
    else await ws.close();
  });
};
