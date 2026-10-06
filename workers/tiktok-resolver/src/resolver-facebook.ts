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

export function parseFacebookHtml(html: string, url: string): ResolvedItem | null {
  const videoUrl =
    extractOgMeta(html, 'og:video:secure_url') ||
    extractOgMeta(html, 'og:video:url') ||
    extractOgMeta(html, 'og:video') ||
    extractJsonString(html, 'browser_native_hd_url') ||
    extractJsonString(html, 'browser_native_sd_url') ||
    extractJsonString(html, 'playable_url_quality_hd') ||
    extractJsonString(html, 'playable_url');

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
