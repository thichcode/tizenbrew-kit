import { describe, expect, it, vi, beforeEach } from 'vitest';
import worker, { Env, KVNamespaceLike } from '../src/index';

class MemoryKV implements KVNamespaceLike {
  private store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string, _options?: { expirationTtl?: number }): Promise<void> {
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

function env(overrides?: Partial<Env>): Env {
  return { FEED_ITEMS: new MemoryKV(), ...overrides };
}

async function json(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  ));
}

function mockHtmlFetch(html: string) {
  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve(
      new Response(html, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    ),
  ));
}

function post(url: string, body: Record<string, unknown>, testEnv?: Env): Promise<Response> {
  return worker.fetch(
    new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    testEnv ?? env(),
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const CODE = 'TV123';

describe('shortvideo-feed worker', () => {
  describe('OPTIONS', () => {
    it('returns 200 with CORS headers', async () => {
      const res = await worker.fetch(new Request('https://feed.example.com/', { method: 'OPTIONS' }), env());
      expect(res.status).toBe(200);
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
    });
  });

  describe('GET /setup', () => {
    it('serves HTML for valid code', async () => {
      const res = await worker.fetch(new Request('https://feed.example.com/setup?code=TV123'), env());
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain('TV123');
      expect(body).toContain('formFacebook');
      expect(body).toContain('formDirect');
    });

    it('rejects missing code', async () => {
      const res = await worker.fetch(new Request('https://feed.example.com/setup'), env());
      expect(res.status).toBe(400);
    });
  });

  describe('POST /submit (direct)', () => {
    it('rejects missing code', async () => {
      const res = await post('https://feed.example.com/submit', { videoUrl: 'https://ex.com/v.mp4' });
      expect(res.status).toBe(400);
    });

    it('stores direct URL by code', async () => {
      const testEnv = env();
      const res = await post('https://feed.example.com/submit', { code: CODE, videoUrl: 'https://ex.com/v1.mp4' }, testEnv);
      expect(res.status).toBe(200);

      const feed = await worker.fetch(new Request(`https://feed.example.com/feed?code=${CODE}`), testEnv);
      expect(((await json(feed)).items as unknown[]).length).toBe(1);
    });
  });

  describe('POST /submit (Facebook Reel)', () => {
    it('stores pre-resolved Facebook CDN URL when fallback resolver succeeds', async () => {
      const testEnv = env({
        FALLBACK_RESOLVER_URL: 'https://resolver.example.com',
        FALLBACK_API_KEY: 'secret',
      });
      const rawUrl = 'https://www.facebook.com/reel/123456';
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({
          ok: true,
          resolved: {
            videoUrl: 'https://video.xx.fbcdn.net/v/t42.1790-2/video.mp4',
            title: 'Fallback Resolver Title',
            thumbnailUrl: 'https://scontent.xx.fbcdn.net/old-thumb.jpg',
          },
        }), { status: 200, headers: { 'content-type': 'application/json' } }))
        .mockResolvedValueOnce(new Response(
          '<html><head><meta property="og:video:secure_url" content="https://video.xx.fbcdn.net/v/t42.1790-2/video.mp4"><meta property="og:title" content="Clean Facebook Title"><meta property="og:image" content="https://scontent.xx.fbcdn.net/clean-thumb.jpg"></head></html>',
          { status: 200, headers: { 'content-type': 'text/html' } },
        )),
      );

      const res = await post('https://feed.example.com/submit', { code: CODE, url: rawUrl }, testEnv);
      expect(res.status).toBe(200);
      const item = (await json(res)).item as Record<string, unknown>;
      expect(item.source).toBe('Facebook');
      expect(item.sourceUrl).toBe(rawUrl);
      expect(item.videoUrl).toBe('https://video.xx.fbcdn.net/v/t42.1790-2/video.mp4');
      expect(item.title).toBe('Clean Facebook Title');
      expect(item.thumbnailUrl).toBe('https://scontent.xx.fbcdn.net/clean-thumb.jpg');
      expect(typeof item.resolvedAt).toBe('string');
      expect(vi.mocked(globalThis.fetch).mock.calls[0][0]).toEqual(
        'https://resolver.example.com/resolve?url=' + encodeURIComponent(rawUrl),
      );
      expect(vi.mocked(globalThis.fetch).mock.calls[0][1]).toEqual(
        expect.objectContaining({ headers: { 'X-API-Key': 'secret' } }),
      );
    });

    it('stores unresolved Facebook URL when fallback resolver fails', async () => {
      const testEnv = env({ FALLBACK_RESOLVER_URL: 'https://resolver.example.com' });
      const rawUrl = 'https://www.facebook.com/reel/123456';
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'resolver failed' }), {
          status: 502,
          headers: { 'content-type': 'application/json' },
        }),
      ));

      const res = await post('https://feed.example.com/submit', { code: CODE, url: rawUrl }, testEnv);
      expect(res.status).toBe(200);
      const item = (await json(res)).item as Record<string, unknown>;
      expect(item.source).toBe('Facebook');
      expect(item.sourceUrl).toBe(rawUrl);
      expect(item.videoUrl).toBe(rawUrl);
      expect(item.title).toBe('Facebook Reel');
      expect(item.resolvedAt).toBeUndefined();
      expect(vi.mocked(globalThis.fetch).mock.calls[0][0]).toEqual(
        expect.stringMatching(/^https:\/\/resolver\.example\.com\/resolve\?url=/),
      );
    });

    it('uses fallback resolver title and thumbnail when Facebook scraper fails', async () => {
      const testEnv = env({
        FALLBACK_RESOLVER_URL: 'https://resolver.example.com',
        FALLBACK_API_KEY: 'secret',
      });
      const rawUrl = 'https://www.facebook.com/reel/123456';
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({
          ok: true,
          resolved: {
            videoUrl: 'https://video.xx.fbcdn.net/v/t42.1790-2/video.mp4',
            title: 'Real Facebook Title from Resolver',
            thumbnailUrl: 'https://scontent.xx.fbcdn.net/real-thumb.jpg',
          },
        }), { status: 200, headers: { 'content-type': 'application/json' } }))
        .mockResolvedValueOnce(new Response('not found', { status: 404 })),
      );

      const res = await post('https://feed.example.com/submit', { code: CODE, url: rawUrl }, testEnv);
      expect(res.status).toBe(200);
      const item = (await json(res)).item as Record<string, unknown>;
      expect(item.videoUrl).toBe('https://video.xx.fbcdn.net/v/t42.1790-2/video.mp4');
      expect(item.title).toBe('Real Facebook Title from Resolver');
      expect(item.thumbnailUrl).toBe('https://scontent.xx.fbcdn.net/real-thumb.jpg');
      expect(typeof item.resolvedAt).toBe('string');
    });

    it('stores unresolved Facebook URL when fallback resolver returns invalid video URL', async () => {
      const testEnv = env({ FALLBACK_RESOLVER_URL: 'https://resolver.example.com' });
      const rawUrl = 'https://www.facebook.com/reel/123456';
      mockFetch(200, {
        ok: true,
        resolved: {
          videoUrl: '/relative-video.mp4',
          title: 'Invalid Resolver Title',
          thumbnailUrl: 'https://scontent.xx.fbcdn.net/thumb.jpg',
        },
      });

      const res = await post('https://feed.example.com/submit', { code: CODE, url: rawUrl }, testEnv);
      expect(res.status).toBe(200);
      const item = (await json(res)).item as Record<string, unknown>;
      expect(item.source).toBe('Facebook');
      expect(item.sourceUrl).toBe(rawUrl);
      expect(item.videoUrl).toBe(rawUrl);
      expect(item.title).toBe('Facebook Reel');
      expect(item.resolvedAt).toBeUndefined();
    });

    it('accepts Facebook share/v/ link format', async () => {
      const rawUrl = 'https://www.facebook.com/share/v/18a1vD3qpQ/?mibextid=wwXIfr';
      mockHtmlFetch('<html></html>');

      const res = await post('https://feed.example.com/submit', { code: CODE, url: rawUrl }, env());
      expect(res.status).toBe(200);
      const item = (await json(res)).item as Record<string, unknown>;
      expect(item.source).toBe('Facebook');
      expect(item.sourceUrl).toBe(rawUrl);
    });
  });

  describe('POST /submit (TikTok)', () => {
    it('resolves TikTok', async () => {
      mockFetch(200, { itemInfo: { itemStruct: { id: '123', desc: 'Tik', author: { uniqueId: 'u' }, video: { playAddr: 'https://tiktok.com/v.mp4' } } } });

      const res = await post('https://feed.example.com/submit', { code: CODE, url: 'https://www.tiktok.com/@u/video/1234567890123456789' });
      expect(res.status).toBe(200);
      expect(((await json(res)).item as Record<string, unknown>).source).toBe('TikTok');
    });

    it('accepts vt.tiktok.com short link format', async () => {
      mockFetch(200, { itemInfo: { itemStruct: { id: '456', desc: 'Short', author: { uniqueId: 'u' }, video: { playAddr: 'https://tiktok.com/v.mp4' } } } });

      const res = await post('https://feed.example.com/submit', { code: CODE, url: 'https://vt.tiktok.com/ZSXLydpyN/' });
      expect(res.status).toBe(200);
      expect(((await json(res)).item as Record<string, unknown>).source).toBe('TikTok');
    });
  });

  describe('POST /submit (unsupported URL)', () => {
    it('rejects unknown platform', async () => {
      const res = await post('https://feed.example.com/submit', { code: CODE, url: 'https://youtube.com/watch?v=abc' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /feed', () => {
    it('rejects missing code', async () => {
      const res = await worker.fetch(new Request('https://feed.example.com/feed'), env());
      expect(res.status).toBe(400);
    });

    it('returns empty for code with no items', async () => {
      const res = await worker.fetch(new Request('https://feed.example.com/feed?code=EMPTY'), env());
      expect(res.status).toBe(200);
      expect(((await json(res)).items as unknown[]).length).toBe(0);
    });
  });

  describe('GET /resolve', () => {
    it('resolves TikTok URL', async () => {
      mockFetch(200, { itemInfo: { itemStruct: { id: '1', desc: 'T', author: { uniqueId: 'u' }, video: { playAddr: 'https://tiktok.com/v.mp4' } } } });
      const res = await worker.fetch(new Request('https://feed.example.com/resolve?url=https://www.tiktok.com/@u/video/1'), env());
      expect(res.status).toBe(200);
    });

    it('returns raw Facebook URL with needsExternal flag', async () => {
      const res = await worker.fetch(
        new Request('https://feed.example.com/resolve?url=https://www.facebook.com/reel/123'),
        env(),
      );
      expect(res.status).toBe(200);
      const data = (await json(res)) as Record<string, unknown>;
      expect((data.resolved as Record<string, unknown>).needsExternal).toBe(true);
    });
  });
});
