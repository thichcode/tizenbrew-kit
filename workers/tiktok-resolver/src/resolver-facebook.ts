export interface ResolvedItem {
  videoUrl: string;
  title: string;
  thumbnailUrl: string | null;
  author: string;
  videoId: string;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Facebook embeds the serving edge (IATA airport code, optionally prefixed
// with "f") in fbcdn hostnames, e.g. video.fhan14-5.fna.fbcdn.net (Hanoi)
// vs video-den2-1.xx.fbcdn.net (Denver, US). Verified against og:video tags
// fetched from a Vietnam IP.
const ASIA_EDGE_CODES = [
  'han', 'sgn', // Vietnam: Hanoi, Ho Chi Minh City
  'sin', 'sgp', // Singapore
  'kul', // Kuala Lumpur
  'cgk', // Jakarta
  'bkk', // Bangkok
  'hkg', // Hong Kong
  'tpe', // Taipei
  'icn', 'gmp', // Seoul
  'nrt', 'kix', // Tokyo, Osaka
  'mnl', // Manila
];
const US_EDGE_CODES = [
  'den', // Denver
  'lax', // Los Angeles
  'sfo', 'sjc', // San Francisco / San Jose
  'sea', // Seattle
  'dfw', // Dallas
  'ord', // Chicago
  'atl', // Atlanta
  'iad', 'dca', // Washington DC
  'jfk', 'ewr', // New York
  'bos', // Boston
  'mia', // Miami
  'phx', // Phoenix
  'ash', // Ashburn
  'prn', // Prineville
  'ftw', // Fort Worth
];

const ASIA_EDGE_RE = new RegExp(`(?:^|[-.])f?(?:${ASIA_EDGE_CODES.join('|')})(?=\\d|[-.]|$)`, 'i');
const US_EDGE_RE = new RegExp(`(?:^|[-.])(?:${US_EDGE_CODES.join('|')})(?=\\d|[-.]|$)`, 'i');

export function regionScore(url: string): number {
  try {
    const host = new URL(url).hostname;
    if (ASIA_EDGE_RE.test(host)) return 100;
    if (US_EDGE_RE.test(host)) return -50;
  } catch {}
  return 0;
}

export function pickBestVideoUrl(candidates: (string | null | undefined)[]): string | null {
  const urls = candidates.filter((u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u));
  if (!urls.length) return null;
  let best = urls[0];
  let bestScore = regionScore(urls[0]);
  for (let i = 1; i < urls.length; i++) {
    const s = regionScore(urls[i]);
    if (s > bestScore) {
      best = urls[i];
      bestScore = s;
    }
  }
  return best;
}

function extractOgMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property="${property}"[^>]+content="([^"]+)"`, 'i'),
    new RegExp(`<meta[^>]+content="([^"]+)"[^>]+property="${property}"`, 'i'),
    new RegExp(`<meta[^>]+name="${property}"[^>]+content="([^"]+)"`, 'i'),
    new RegExp(`<meta[^>]+content="([^"]+)"[^>]+name="${property}"`, 'i'),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return decodeHtmlEntities(m[1]);
  }
  return null;
}

function extractJsonString(html: string, key: string): string | null {
  const p = new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, 'i');
  const m = html.match(p);
  if (m) {
    return decodeHtmlEntities(m[1].replace(/\\u0025/g, '%').replace(/\\u0026/g, '&').replace(/\\u002F/g, '/').replace(/\\/g, ''));
  }
  return null;
}

function extractDirectFbcdnMp4s(html: string): string[] {
  const matches = html.match(/https?:[^\s"'<>]+\.fbcdn\.net[^\s"'<>]+\.mp4[^\s"'<>]*/gi);
  if (!matches || matches.length === 0) return [];
  return matches.map((u) =>
    decodeHtmlEntities(u.replace(/\\u0025/g, '%').replace(/\\u0026/g, '&').replace(/\\u002F/g, '/').replace(/\\/g, '')),
  );
}

export function parseFacebookHtml(html: string, url: string): ResolvedItem | null {
  const videoUrl = pickBestVideoUrl([
    ...extractDirectFbcdnMp4s(html),
    extractOgMeta(html, 'og:video:secure_url'),
    extractOgMeta(html, 'og:video:url'),
    extractOgMeta(html, 'og:video'),
    extractJsonString(html, 'browser_native_hd_url'),
    extractJsonString(html, 'browser_native_sd_url'),
    extractJsonString(html, 'playable_url_quality_hd'),
    extractJsonString(html, 'playable_url'),
  ]);

  if (!videoUrl) return null;

  const canonicalUrl = extractOgMeta(html, 'og:url') || url;
  const title = extractOgMeta(html, 'og:title') || 'Facebook Video';
  const thumbnail = extractOgMeta(html, 'og:image');
  const videoId =
    canonicalUrl.match(/\/reel\/(\d+)/)?.[1] ||
    canonicalUrl.match(/\/v\/(\w+)/)?.[1] ||
    canonicalUrl.match(/\/r\/(\w+)/)?.[1] ||
    canonicalUrl.match(/\/videos\/(\d+)/)?.[1] ||
    url.match(/\/reel\/(\d+)/)?.[1] ||
    url.match(/\/v\/(\w+)/)?.[1] ||
    url.match(/\/r\/(\w+)/)?.[1] ||
    '';

  return {
    videoUrl,
    title,
    thumbnailUrl: thumbnail || null,
    author: extractOgMeta(html, 'og:site_name') || 'Facebook',
    videoId,
  };
}

export async function resolveFacebookUrl(url: string): Promise<ResolvedItem | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const html = await res.text();
    return parseFacebookHtml(html, url);
  } catch {
    return null;
  }
}
