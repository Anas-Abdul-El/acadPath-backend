import { ResourcePlatform } from "../../generated/prisma/client.js";

const platformHosts: Record<ResourcePlatform, string[]> = {
  YOUTUBE: ["youtube.com", "youtu.be"],
  UDEMY: ["udemy.com"],
  COURSERA: ["coursera.org"],
};

// The platform comes from the URL's host, not from what the AI claims.
export const platformOf = (url: string) => {
  const host = new URL(url).hostname;
  const match = Object.entries(platformHosts).find(([, hosts]) =>
    hosts.some((h) => host === h || host.endsWith(`.${h}`)),
  );
  return match ? (match[0] as ResourcePlatform) : null;
};

// YouTube's oEmbed returns an error for videos and playlists that don't exist.
// Udemy and Coursera often block bots, so only a 404 or 410 counts as broken there.
export const linkWorks = async (url: string, platform: ResourcePlatform) => {
  const target =
    platform === ResourcePlatform.YOUTUBE
      ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`
      : url;
  try {
    const res = await fetch(target, { signal: AbortSignal.timeout(8000) });
    return platform === ResourcePlatform.YOUTUBE
      ? res.ok
      : res.status !== 404 && res.status !== 410;
  } catch {
    return false;
  }
};
