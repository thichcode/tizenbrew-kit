import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker, { isAllowedUrl } from '../src/index';

const ORIGIN = 'https://video-proxy.example.workers.dev';

function req(path: string, init?: RequestInit) {
  return new Request(ORIGIN + path, init);
}

describe('isAllowedUrl', () => {
  it('cho phep host CDN video', () => {
    expect(isAllowedUrl('https://video-den2-1.xx.fbcdn.net/x.mp4', false)).toBe(true);
    expect(isAllowedUrl('https://pull.niues.live/live/a.m3u8', false)).toBe(true);
    expect(isAllowedUrl('https://r2---sn-x.googlevideo.com/videoplayback', false)).toBe(true);
    expect(isAllowedUrl('https://live.inplyr.com/room/1.m3u8', false)).toBe(true);
  });

  it('cho phep host la neu duoi la file stream', () => {
    expect(isAllowedUrl('https://new-cdn.example.xyz/a/stream.m3u8', false)).toBe(false);
  });

  it('chan host khong phai CDN (open proxy / SSRF)', () => {
    expect(isAllowedUrl('https://evil.com/steal', false)).toBe(false);
    // Dù có đuôi stream vẫn phải chặn — nếu không thì thành open proxy.
    expect(isAllowedUrl('https://evil.com/x.m3u8', false)).toBe(false);
    expect(isAllowedUrl('https://new-cdn.example.xyz/a/stream.m3u8', false)).toBe(false);
    expect(isAllowedUrl('https://new-cdn.example.xyz/admin', false)).toBe(false);
    // host gia lap khai bao
    expect(isAllowedUrl('https://fbcdn.net.evil.com/x.m3u8', false)).toBe(false);
    // đuôi stream nằm trong query/fragment không được tính
    expect(isAllowedUrl('https://evil.com/?x=.m3u8', false)).toBe(false);
    expect(isAllowedUrl('https://evil.com/x#a.m3u8', false)).toBe(false);
  });

  it('chan scheme khong http(s)', () => {
    expect(isAllowedUrl('file:///etc/passwd', false)).toBe(false);
    expect(isAllowedUrl('ftp://x/y.mp4', false)).toBe(false);
  });

  it('ALLOW_ANY_HOST bat khi debug', () => {
    expect(isAllowedUrl('https://evil.com/steal', true)).toBe(true);
  });
});

describe('fetch handler', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('OPTIONS tra 204 + CORS', async () => {
    const res = await worker.fetch(req('/?url=x', { method: 'OPTIONS' }), {});
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('thieu ?url tra 400', async () => {
    const res = await worker.fetch(req('/'), {});
    expect(res.status).toBe(400);
  });

  it('host khong allowlist tra 403', async () => {
    const res = await worker.fetch(req('/?url=' + encodeURIComponent('https://evil.com/x')), {});
    expect(res.status).toBe(403);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('forward Range va giu 206 + Content-Range', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('partial-body', {
        status: 206,
        headers: {
          'content-type': 'video/mp4',
          'content-length': '12',
          'content-range': 'bytes 0-11/1000',
        },
      }),
    );
    const res = await worker.fetch(
      req('/?url=' + encodeURIComponent('https://video-den2-1.xx.fbcdn.net/v.mp4'), {
        headers: { Range: 'bytes=0-11' },
      }),
      {},
    );
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 0-11/1000');
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    expect(res.headers.get('access-control-expose-headers')).toContain('Content-Range');

    const upstreamCall = vi.mocked(fetch).mock.calls[0];
    expect(upstreamCall[0]).toBe('https://video-den2-1.xx.fbcdn.net/v.mp4');
    const hdrs = (upstreamCall[1] as RequestInit).headers as Headers;
    expect(hdrs.get('Range')).toBe('bytes=0-11');
    // Referer cho fbcdn + Accept-Encoding identity
    expect(hdrs.get('Referer')).toBe('https://www.facebook.com/');
    expect(hdrs.get('Accept-Encoding')).toBe('identity');
  });

  it('khong forward cookie len CDN', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('x', { headers: { 'content-type': 'video/mp4' } }),
    );
    await worker.fetch(
      req('/?url=' + encodeURIComponent('https://pull.niues.live/a.m3u8'), {
        headers: { Cookie: 'session=secret', Authorization: 'Bearer x' },
      }),
      {},
    );
    const hdrs = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).headers as Headers;
    expect(hdrs.get('Cookie')).toBeNull();
    expect(hdrs.get('Authorization')).toBeNull();
  });

  it('upstream loi tra 502', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('boom'));
    const res = await worker.fetch(
      req('/?url=' + encodeURIComponent('https://pull.niues.live/a.m3u8')),
      {},
    );
    expect(res.status).toBe(502);
  });

  it('/health tra ok', async () => {
    const res = await worker.fetch(req('/health'), {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
