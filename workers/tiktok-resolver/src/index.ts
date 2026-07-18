import { resolveTikTokUrl, debugResolveTikTok } from './resolver';
import { resolveFacebookUrl } from './resolver-facebook';
import { renderSetupPage } from './setup-page';

interface FeedItem {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  resolvedAt?: string;
}

export interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Env {
  FEED_ITEMS: KVNamespaceLike;
  FALLBACK_RESOLVER_URL?: string;
  FALLBACK_API_KEY?: string;
}

const FEED_TTL = 48 * 60 * 60;
const CACHE_TTL = 60 * 60;
const MAX_ITEMS = 50;
const WORKER_URL = 'https://shortvideo-feed.dvt-kisu.workers.dev';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
  });
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function isValidCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z0-9]{4,12}$/.test(value);
}

function isValidUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidTikTokUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return /^https?:\/\/(?:www\.|vm\.|m\.|vt\.)?tiktok\.com\//i.test(value.trim());
}

function isValidFacebookUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return /^https?:\/\/(?:www\.|m\.|fb\.)?facebook\.com\/(?:reel\/|share\/)/i.test(value.trim()) ||
    /^https?:\/\/fb\.watch\//i.test(value.trim());
}

function isValidBilibiliUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return /^https?:\/\/(?:www\.)?bilibili\.tv\/(?:[a-z]{2}\/)?video\//i.test(value.trim());
}

function feedKey(code: string): string {
  return `feed:${code}`;
}

function cacheKey(url: string): string {
  return `cache:${url.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 100)}`;
}

function generateId(sourceUrl: string): string {
  const m = sourceUrl.match(/\/reel\/(\d+)/);
  if (m) return `fb_${m[1]}`;
  const s = sourceUrl.match(/\/share\/[a-z]\/([^/?]+)/);
  if (s) return `fb_${s[1]}`;
  const t = sourceUrl.match(/\/video\/(\d{9,19})/);
  if (t) return `tk_${t[1]}`;
  const b = sourceUrl.match(/\/(?:[a-z]{2}\/)?video\/(\d{1,20})/);
  if (b) return `bl_${b[1]}`;
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function readFeed(env: Env, code: string): Promise<FeedItem[]> {
  const raw = await env.FEED_ITEMS.get(feedKey(code));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as FeedItem[];
  } catch {
    return [];
  }
}

async function writeFeed(env: Env, code: string, items: FeedItem[]): Promise<void> {
  await env.FEED_ITEMS.put(feedKey(code), JSON.stringify(items), { expirationTtl: FEED_TTL });
}

function deduplicate(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.sourceUrl)) return false;
    seen.add(item.sourceUrl);
    return true;
  });
}

async function callFallbackResolver(env: Env, url: string): Promise<{ videoUrl: string; title: string; thumbnailUrl: string | null } | null> {
  const baseUrl = env.FALLBACK_RESOLVER_URL;
  if (!baseUrl) return null;

  const cache = cacheKey(url);
  const cached = await env.FEED_ITEMS.get(cache);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as { videoUrl?: unknown; title?: unknown; thumbnailUrl?: unknown };
      if (isValidUrl(parsed.videoUrl)) {
        return {
          videoUrl: parsed.videoUrl,
          title: typeof parsed.title === 'string' ? parsed.title : 'Video',
          thumbnailUrl: typeof parsed.thumbnailUrl === 'string' ? parsed.thumbnailUrl : null,
        };
      }
    } catch { /* ignore */ }
  }

  const headers: Record<string, string> = {};
  if (env.FALLBACK_API_KEY) {
    headers['X-API-Key'] = env.FALLBACK_API_KEY;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(`${baseUrl}/resolve?url=${encodeURIComponent(url)}`, { headers, signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json() as { ok: boolean; resolved?: { videoUrl: string; title: string; thumbnailUrl?: string | null } };
    if (!data.ok || !isValidUrl(data.resolved?.videoUrl)) return null;

    const result = { videoUrl: data.resolved.videoUrl, title: data.resolved.title || 'Video', thumbnailUrl: data.resolved.thumbnailUrl || null };
    await env.FEED_ITEMS.put(cache, JSON.stringify(result), { expirationTtl: CACHE_TTL });
    return result;
  } catch (e) {
    console.error('[fallback] error:', e instanceof Error ? e.message : String(e));
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function handleSetup(url: URL): Promise<Response> {
  const code = url.searchParams.get('code');
  if (!isValidCode(code)) return json({ error: 'Missing or invalid code' }, 400);
  return html(renderSetupPage(code, WORKER_URL));
}

async function handleSubmit(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
  if (!isValidCode(code)) {
    return json({ error: 'Missing or invalid code' }, 400);
  }

  const directVideoUrl = typeof body.videoUrl === 'string' ? body.videoUrl.trim() : '';
  const platformUrl = typeof body.url === 'string' ? body.url.trim() : '';

  if (!directVideoUrl && !platformUrl) {
    return json({ error: 'Provide "videoUrl" (direct) or "url" (platform)' }, 400);
  }

  let feedItem: FeedItem;

  if (directVideoUrl) {
    if (!isValidUrl(directVideoUrl)) {
      return json({ error: 'Invalid videoUrl' }, 400);
    }
    feedItem = {
      id: generateId(directVideoUrl),
      title: typeof body.title === 'string' ? body.title.slice(0, 200) : 'Direct video',
      source: typeof body.source === 'string' ? body.source : 'direct',
      sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : directVideoUrl,
      videoUrl: directVideoUrl,
      thumbnailUrl: typeof body.thumbnailUrl === 'string' && isValidUrl(body.thumbnailUrl) ? body.thumbnailUrl : '',
      duration: typeof body.duration === 'number' ? body.duration : 0,
    };
  } else if (isValidTikTokUrl(platformUrl)) {
    const resolved = await resolveTikTokUrl(platformUrl);
    if (!resolved) {
      return json({ error: 'Could not resolve this TikTok URL' }, 422);
    }
    feedItem = {
      id: generateId(platformUrl),
      title: resolved.title,
      source: 'TikTok',
      sourceUrl: platformUrl,
      videoUrl: resolved.videoUrl,
      thumbnailUrl: resolved.thumbnailUrl || '',
      duration: 0,
    };
  } else if (isValidFacebookUrl(platformUrl)) {
    const hasFallbackResolver = !!env.FALLBACK_RESOLVER_URL;
    const fallbackResolved = hasFallbackResolver ? await callFallbackResolver(env, platformUrl) : null;
    let fbTitle = 'Facebook Reel';
    let fbVideoUrl: string = platformUrl;
    let fbThumbnailUrl = '';
    let resolvedAt: string | undefined;

    if (fallbackResolved) {
      fbVideoUrl = fallbackResolved.videoUrl;
      fbTitle = fallbackResolved.title || 'Facebook Reel';
      fbThumbnailUrl = fallbackResolved.thumbnailUrl || '';
      resolvedAt = new Date().toISOString();
    }

    try {
      const resolved = await resolveFacebookUrl(platformUrl);
      if (resolved && resolved.title) fbTitle = resolved.title;
      if (resolved && resolved.thumbnailUrl) fbThumbnailUrl = resolved.thumbnailUrl;
    } catch {}

    feedItem = {
      id: generateId(platformUrl),
      title: fbTitle,
      source: 'Facebook',
      sourceUrl: platformUrl,
      videoUrl: fbVideoUrl,
      thumbnailUrl: fbThumbnailUrl,
      duration: 0,
      ...(resolvedAt ? { resolvedAt } : {}),
    };
  } else if (isValidBilibiliUrl(platformUrl)) {
    const hasFallbackResolver = !!env.FALLBACK_RESOLVER_URL;
    const fallbackResolved = hasFallbackResolver ? await callFallbackResolver(env, platformUrl) : null;
    let blTitle = 'Bilibili Video';
    let blVideoUrl: string = platformUrl;
    let blThumbnailUrl = '';
    let resolvedAt: string | undefined;

    if (fallbackResolved) {
      blVideoUrl = fallbackResolved.videoUrl;
      blTitle = fallbackResolved.title || 'Bilibili Video';
      blThumbnailUrl = fallbackResolved.thumbnailUrl || '';
      resolvedAt = new Date().toISOString();
    }

    feedItem = {
      id: generateId(platformUrl),
      title: blTitle,
      source: 'Bilibili',
      sourceUrl: platformUrl,
      videoUrl: blVideoUrl,
      thumbnailUrl: blThumbnailUrl,
      duration: 0,
      ...(resolvedAt ? { resolvedAt } : {}),
    };
  } else {
    return json({ error: 'Invalid or unsupported URL' }, 400);
  }

  const items = await readFeed(env, code);
  items.unshift(feedItem);
  await writeFeed(env, code, deduplicate(items).slice(0, MAX_ITEMS));

  return json({ ok: true, item: feedItem });
}

async function handleFeed(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!isValidCode(code)) return json({ error: 'Missing or invalid code' }, 400);

  const items = await readFeed(env, code);
  return json({ items });
}

async function handleDeleteFeed(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!isValidCode(code)) return json({ error: 'Missing or invalid code' }, 400);

  await env.FEED_ITEMS.delete(feedKey(code));
  return json({ ok: true });
}

async function handleResolve(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const rawUrl = url.searchParams.get('url');
  if (!rawUrl || !isValidUrl(rawUrl)) {
    return json({ error: 'Missing or invalid ?url parameter' }, 400);
  }

  const trimmed = rawUrl.trim();
  if (isValidTikTokUrl(trimmed)) {
    const resolved = await resolveTikTokUrl(trimmed);
    if (!resolved) return json({ error: 'Could not resolve TikTok URL' }, 422);
    return json({ ok: true, resolved });
  }

  if (isValidFacebookUrl(trimmed) || isValidBilibiliUrl(trimmed)) {
    return json({ ok: true, resolved: { url: trimmed, needsExternal: true, hint: 'Resolve via yt-dlp server directly' } });
  }

  return json({ ok: true, resolved: { videoUrl: trimmed, title: 'Direct URL', thumbnailUrl: null, author: '', videoId: '' } });
}

async function handleResolveDebug(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rawUrl = url.searchParams.get('url');
  if (!rawUrl || !isValidUrl(rawUrl)) {
    return json({ error: 'Missing or invalid ?url parameter' }, 400);
  }
  const result = await debugResolveTikTok(rawUrl.trim());
  return json({ ok: true, debug: result });
}

async function handleProxy(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  if (!targetUrl || !isValidUrl(targetUrl)) {
    return json({ error: 'Missing or invalid ?url parameter' }, 400);
  }

  try {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    let cookies = '';
    if (/tiktok\.com/.test(targetUrl)) {
      headers['Referer'] = 'https://www.tiktok.com/';
      headers['Origin'] = 'https://www.tiktok.com';
      // Get cookies from TikTok main page first
      try {
        const pageRes = await fetch('https://www.tiktok.com/', {
          headers: { 'User-Agent': headers['User-Agent'] },
        });
        const setCookie = pageRes.headers.get('set-cookie');
        if (setCookie) cookies = setCookie.split(';')[0];
      } catch { /* ignore */ }
    }

    if (/bilibili\.tv/.test(targetUrl)) {
      headers['Referer'] = 'https://www.bilibili.tv/';
      headers['Origin'] = 'https://www.bilibili.tv';
    }

    if (cookies) headers['Cookie'] = cookies;

    const res = await fetch(targetUrl, { headers });
    if (!res.ok) return json({ error: 'Proxy fetch failed', status: res.status }, 502);

    const proxyHeaders = new Headers(res.headers);
    proxyHeaders.set('access-control-allow-origin', '*');
    proxyHeaders.set('access-control-allow-methods', 'GET,OPTIONS');
    proxyHeaders.set('access-control-allow-headers', '*');

    return new Response(res.body, {
      status: res.status,
      headers: proxyHeaders,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 502);
  }
}

async function handleStream(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rawUrl = url.searchParams.get('url');
  if (!rawUrl || !isValidUrl(rawUrl)) {
    return json({ error: 'Missing or invalid ?url parameter' }, 400);
  }

  const resolved = await resolveTikTokUrl(rawUrl.trim());
  if (!resolved || !resolved.videoUrl) {
    return json({ error: 'Could not resolve TikTok URL' }, 422);
  }

  try {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Referer': 'https://www.tiktok.com/',
      'Origin': 'https://www.tiktok.com',
      'Accept': '*/*',
    };

    const res = await fetch(resolved.videoUrl, { headers });
    if (!res.ok) {
      return json({ error: 'CDN fetch failed', status: res.status }, 502);
    }

    const proxyHeaders = new Headers();
    const ct = res.headers.get('Content-Type');
    if (ct) proxyHeaders.set('Content-Type', ct);
    const cl = res.headers.get('Content-Length');
    if (cl) proxyHeaders.set('Content-Length', cl);
    const cr = res.headers.get('Content-Range');
    if (cr) proxyHeaders.set('Content-Range', cr);
    proxyHeaders.set('Accept-Ranges', 'bytes');
    proxyHeaders.set('access-control-allow-origin', '*');

    return new Response(res.body, {
      status: res.status,
      headers: proxyHeaders,
    });
  } catch (e) {
    return json({ error: 'Stream failed: ' + String(e) }, 502);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (request.method === 'OPTIONS') return json({ ok: true });

      const url = new URL(request.url);

      if (request.method === 'GET' && url.pathname === '/setup') return handleSetup(url);
      if (request.method === 'POST' && url.pathname === '/submit') return handleSubmit(request, env);
      if (request.method === 'GET' && url.pathname === '/feed') return handleFeed(request, env);
      if (request.method === 'DELETE' && url.pathname === '/feed') return handleDeleteFeed(request, env);
      if (request.method === 'GET' && url.pathname === '/resolve') return handleResolve(request, env);
      if (request.method === 'GET' && url.pathname === '/resolve-debug') return handleResolveDebug(request);
      if (request.method === 'GET' && url.pathname === '/proxy') return handleProxy(request);
      if (request.method === 'GET' && url.pathname === '/stream') return handleStream(request);

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return json({ error: msg }, 500);
    }
  },
};
