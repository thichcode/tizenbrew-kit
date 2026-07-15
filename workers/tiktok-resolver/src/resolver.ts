export interface ResolvedItem {
  videoUrl: string;
  title: string;
  thumbnailUrl: string | null;
  author: string;
  videoId: string;
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /\/video\/(\d{17,19})/i,
    /\/video\/(\d{9,16})\b/i,
    /\/v\/(\d{17,19})/i,
    /\/v\/(\d{9,16})\b/i,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function tryApi(itemId: string, aid: string): Promise<Record<string, unknown> | null> {
  const url = `https://www.tiktok.com/api/item/detail/?itemId=${itemId}&aid=${aid}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.tiktok.com/',
      },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim().length === 0) return null;
    const data = JSON.parse(text) as Record<string, unknown>;
    return data;
  } catch {
    return null;
  }
}

function parseApiResponse(data: Record<string, unknown>): ResolvedItem | null {
  const item = (data as any)?.itemInfo?.itemStruct;
  if (!item?.video?.playAddr) return null;
  return {
    videoUrl: item.video.playAddr,
    title: item.desc || `Video by @${item.author?.uniqueId || 'unknown'}`,
    thumbnailUrl: item.video.cover || null,
    author: item.author?.uniqueId || 'unknown',
    videoId: String(item.id || ''),
  };
}

async function tryHtmlPage(url: string): Promise<ResolvedItem | null> {
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

    const universal = extractUniversalData(html);
    if (universal) {
      const parsed = parseFromUniversalData(universal);
      if (parsed) return parsed;
    }

    const fromVideo = extractFromVideoTag(html);
    if (fromVideo) return fromVideo;

    const fromAddr = extractFromPlayAddr(html);
    if (fromAddr) return fromAddr;

    return null;
  } catch {
    return null;
  }
}

function extractUniversalData(html: string): Record<string, unknown> | null {
  const m = html.match(/<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseFromUniversalData(data: Record<string, unknown>): ResolvedItem | null {
  const scope = data.__DEFAULT_SCOPE__ as Record<string, unknown> | undefined;
  if (!scope) return null;
  const detail = scope['webapp.video-detail'] as Record<string, unknown> | undefined;
  if (!detail) return null;
  const info = detail.itemInfo as Record<string, unknown> | undefined;
  if (!info) return null;
  const item = info.itemStruct as Record<string, unknown> | undefined;
  if (!item) return null;
  const video = item.video as Record<string, unknown> | undefined;
  if (!video) return null;

  const playAddr = video.playAddr as string | undefined;
  if (!playAddr) return null;

  const author = item.author as Record<string, unknown> | undefined;
  const username = (typeof author?.uniqueId === 'string' ? author.uniqueId : '') ||
    (typeof author?.nickname === 'string' ? author.nickname : 'unknown');

  return {
    videoUrl: playAddr,
    title: typeof item.desc === 'string' ? item.desc.slice(0, 200) : `Video by @${username}`,
    thumbnailUrl: typeof video.cover === 'string' ? video.cover : null,
    author: username,
    videoId: typeof item.id === 'string' ? item.id : String(item.id ?? ''),
  };
}

function extractFromVideoTag(html: string): ResolvedItem | null {
  const m = html.match(/<video[^>]+src="([^"]+)"/i);
  if (!m) return null;

  const authorM = html.match(/@(\w+)/);
  const descM = html.match(/<title[^>]*>([^<]+)<\/title>/i);

  return {
    videoUrl: m[1],
    title: descM ? descM[1].trim().slice(0, 200) : 'TikTok Video',
    thumbnailUrl: null,
    author: authorM ? authorM[1] : 'unknown',
    videoId: '',
  };
}

function extractFromPlayAddr(html: string): ResolvedItem | null {
  const patterns = [
    /"playAddr"\s*:\s*"([^"]+)"/,
    /"play_url"\s*:\s*"([^"]+)"/,
    /"downloadAddr"\s*:\s*"([^"]+)"/,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) {
      const authorM = html.match(/@(\w+)/);
      return {
        videoUrl: m[1].replace(/\\u002F/g, '/').replace(/\\\//g, '/'),
        title: 'TikTok Video',
        thumbnailUrl: null,
        author: authorM ? authorM[1] : 'unknown',
        videoId: '',
      };
    }
  }
  return null;
}

export async function resolveTikTokUrl(url: string): Promise<ResolvedItem | null> {
  const videoId = extractVideoId(url);

  // Try multiple API endpoints with different aid values
  if (videoId) {
    for (const aid of ['1988', '1233', '80054', '1180', '1340']) {
      const data = await tryApi(videoId, aid);
      if (data) {
        const parsed = parseApiResponse(data);
        if (parsed) return parsed;
      }
    }
  }

  // Fall back to HTML page scraping
  const result = await tryHtmlPage(url);
  if (result) return result;

  return null;
}

export async function debugResolveTikTok(url: string): Promise<{
  videoId: string | null;
  apiResults: { aid: string; status: number; body: string }[];
}> {
  const videoId = extractVideoId(url);
  const apiResults: { aid: string; status: number; body: string }[] = [];

  if (videoId) {
    for (const aid of ['1988', '1233', '80054', '1180', '1340']) {
      const apiUrl = `https://www.tiktok.com/api/item/detail/?itemId=${videoId}&aid=${aid}`;
      try {
        const res = await fetch(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://www.tiktok.com/',
          },
        });
        const body = await res.text();
        apiResults.push({ aid, status: res.status, body: body.slice(0, 2000) });
      } catch (e) {
        apiResults.push({ aid, status: 0, body: String(e) });
      }
    }
  }

  return { videoId, apiResults };
}
