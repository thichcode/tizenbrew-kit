/**
 * video-proxy — Cloudflare Worker proxy stream video.
 *
 * Mục đích: TV ở VN kéo thẳng từ CDN Mỹ (vd video-den2-x.fbcdn.net) bị lag vì
 * đường đi xuyên quốc tế qua ISP. Worker đặt ở PoP gần TV (Hà Nội/Sài Gòn),
 * Cloudflare backbone chở đoạn Denver → PoP.
 *
 * Lưu ý: KHÔNG đổi được edge mà Facebook chọn — Facebook gán CDN theo IP của
 * request (Render datacenter → Denver). Cái này chỉ rút ngắn chặng của TV.
 *
 * Yêu cầu bắt buộc để stream không vỡ:
 *  - forward header `Range` (không có thì TV không seek được, MP4 có thể không phát)
 *  - giữ status 206 + Content-Range/Content-Length/Accept-Ranges từ upstream
 *
 * Bảo mật: chỉ proxy trong allowlist host CDN video. Nếu không, đây là open proxy
 * và Worker sẽ bị Cloudflare khoá (hoặc bị dùng để tấn công mạng khác).
 */

/** Host CDN video được phép proxy. */
const ALLOWED_HOSTS = [
  // Facebook
  'fbcdn.net',
  'fbcdn.com',
  'fbsbx.com',
  // TikTok
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'tiktokcdn-us.tiktokv.com',
  'tiktokv.com',
  'byteoversea.com',
  'muscdn.com',
  'ibytedtos.com',
  // YouTube
  'googlevideo.com',
  'youtube.com',
  // VN stream CDN
  'niues.live',
  'scstream.net',
  'inplyr.com',
  'vnres.co',
] as const;

/**
 * Chỉ host trong allowlist mới được proxy.
 * KHÔNG nới lỏng theo đuôi file: `evil.com/x.m3u8` hay `fbcdn.net.evil.com/x.m3u8`
 * đều lọt nếu check đuôi -> đó là open proxy. Thêm CDN mới vào ALLOWED_HOSTS.
 */

/** Không forward cookie/auth của client lên CDN. */
const DROP_REQ_HEADERS = new Set(['cookie', 'authorization', 'host', 'x-api-key']);

export interface Env {
  /** Tắt bỏ giới hạn host (chỉ khi debug local — KHÔNG bật trên production). */
  ALLOW_ANY_HOST?: string;
}

function corsHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, HEAD, OPTIONS',
    'access-control-allow-headers': 'Range, Content-Type',
    'access-control-expose-headers':
      'Content-Length, Content-Range, Content-Type, Accept-Ranges',
    'access-control-max-age': '86400',
    ...(extra || {}),
  };
}

function jsonError(msg: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status,
    headers: corsHeaders({ 'content-type': 'application/json; charset=utf-8' }),
  });
}

/** Host có nằm trong allowlist không (không match subdomain giả dạng). */
export function isAllowedUrl(raw: string, allowAny: boolean): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  if (allowAny) return true;
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  // Chỉ so sánh hậu tố ở ranh giới nhãn: "fbcdn.net.evil.com" không được coi là fbcdn.
  return ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return jsonError('Method not allowed', 405);
    }

    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: corsHeaders({ 'content-type': 'application/json' }),
      });
    }

    const target = url.searchParams.get('url');
    if (!target) return jsonError('Thieu tham so ?url=', 400);

    const allowAny = env.ALLOW_ANY_HOST === 'true';
    if (!isAllowedUrl(target, allowAny)) {
      return jsonError('Host khong duoc cho phep', 403);
    }

    // Chỉ forward header an toàn, giữ lại Range (quan trọng cho seek).
    const headers = new Headers();
    request.headers.forEach((value, key) => {
      if (!DROP_REQ_HEADERS.has(key.toLowerCase())) headers.set(key, value);
    });

    // CDN nhiều khi cần Referer/Origin để không chặn hotlink.
    let t: URL;
    try {
      t = new URL(target);
    } catch {
      return jsonError('URL khong hop le', 400);
    }
    if (/(^|\.)fbcdn\.net$/.test(t.hostname)) {
      headers.set('Referer', 'https://www.facebook.com/');
      headers.set('Origin', 'https://www.facebook.com');
    } else if (/(^|\.)tiktok/.test(t.hostname) || /(^|\.)byteoversea\.com$/.test(t.hostname)) {
      headers.set('Referer', 'https://www.tiktok.com/');
    }
    headers.set('Accept-Encoding', 'identity');

    let upstream: Response;
    try {
      upstream = await fetch(target, {
        method: request.method,
        headers,
        redirect: 'follow',
      });
    } catch (e) {
      return jsonError(`Khong fetch duoc upstream: ${(e as Error).message}`, 502);
    }

    // Giữ status (200/206/302) và các header cần cho player.
    const passthrough: Record<string, string> = {};
    for (const name of [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'etag',
      'last-modified',
    ]) {
      const v = upstream.headers.get(name);
      if (v) passthrough[name] = v;
    }
    if (!passthrough['accept-ranges']) passthrough['accept-ranges'] = 'bytes';

    const body =
      request.method === 'HEAD' || !upstream.body ? null : upstream.body;

    return new Response(body, {
      status: upstream.status,
      headers: corsHeaders(passthrough),
    });
  },
};
