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

    const videoUrl =
      extractOgMeta(html, 'og:video:secure_url') ||
      extractOgMeta(html, 'og:video:url') ||
      extractOgMeta(html, 'og:video');

    if (!videoUrl) return null;

    const title = extractOgMeta(html, 'og:title') || 'Facebook Reel';
    const thumbnail = extractOgMeta(html, 'og:image');
    const videoId = url.match(/\/reel\/(\d+)/)?.[1] || '';

    return {
      videoUrl,
      title,
      thumbnailUrl: thumbnail || null,
      author: extractOgMeta(html, 'og:site_name') || 'Facebook',
      videoId,
    };
  } catch {
    return null;
  }
}
