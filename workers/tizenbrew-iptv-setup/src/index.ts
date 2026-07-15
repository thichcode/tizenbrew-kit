export interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Env {
  PLAYLIST_CONFIGS: KVNamespaceLike;
}

const CONFIG_TTL_SECONDS = 24 * 60 * 60;

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
  });
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'access-control-allow-origin': '*',
    },
  });
}

function isValidCode(code: string | null): code is string {
  return !!code && /^[A-Z0-9]{4,12}$/.test(code);
}

function isValidPlaylistUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function keyFor(code: string): string {
  return `device:${code}`;
}

function setupPage(code: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TizenBrew IPTV Setup</title>
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#101418;color:#f3f6fa;font-family:Arial,sans-serif}
    main{width:min(92vw,520px);background:#182028;border:1px solid #2a3642;border-radius:16px;padding:24px;box-shadow:0 18px 60px rgba(0,0,0,.35)}
    h1{margin:0 0 8px;font-size:28px}.code{font-size:22px;color:#4fc3f7;margin-bottom:18px}label{display:block;margin:16px 0 8px;color:#a7b1bc}
    input,button{width:100%;height:46px;border-radius:10px;border:1px solid #314252;background:#0f151b;color:#f3f6fa;padding:0 12px;font-size:16px;box-sizing:border-box}
    button{margin-top:14px;background:#1f6feb;border-color:#2f81f7;cursor:pointer;font-weight:700}.msg{margin-top:14px;color:#a7b1bc;min-height:22px}
  </style>
</head>
<body>
  <main>
    <h1>TizenBrew IPTV Setup</h1>
    <div class="code">Device code: ${escapeHtml(code)}</div>
    <form id="form">
      <label for="playlistUrl">M3U playlist URL</label>
      <input id="playlistUrl" name="playlistUrl" type="url" placeholder="https://example.com/playlist.m3u" required autofocus>
      <button type="submit">Send to TV</button>
      <div id="msg" class="msg"></div>
    </form>
  </main>
  <script>
    const form = document.getElementById('form');
    const msg = document.getElementById('msg');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      msg.textContent = 'Sending...';
      const playlistUrl = document.getElementById('playlistUrl').value.trim();
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: '${escapeJs(code)}', playlistUrl })
      });
      msg.textContent = response.ok ? 'Sent. You can return to the TV.' : 'Failed. Check the URL and try again.';
    });
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char);
}

function escapeJs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function readPostBody(request: Request): Promise<{ code?: unknown; playlistUrl?: unknown }> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await request.json()) as { code?: unknown; playlistUrl?: unknown };
  }
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = new URLSearchParams(await request.text());
    return { code: form.get('code'), playlistUrl: form.get('playlistUrl') };
  }
  return {};
}

async function handleSetup(url: URL): Promise<Response> {
  const code = url.searchParams.get('code');
  if (!isValidCode(code)) return json({ error: 'Missing or invalid code' }, 400);
  return html(setupPage(code));
}

async function handleGetConfig(url: URL, env: Env): Promise<Response> {
  const code = url.searchParams.get('code');
  if (!isValidCode(code)) return json({ error: 'Missing or invalid code' }, 400);

  const playlistUrl = await env.PLAYLIST_CONFIGS.get(keyFor(code));
  if (!playlistUrl) return json({ pending: true }, 404);
  return json({ playlistUrl });
}

async function handlePostConfig(request: Request, env: Env): Promise<Response> {
  const body = await readPostBody(request);
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
  if (!isValidCode(code)) return json({ error: 'Missing or invalid code' }, 400);
  if (!isValidPlaylistUrl(body.playlistUrl)) return json({ error: 'Invalid playlistUrl' }, 400);

  const playlistUrl = body.playlistUrl.trim();
  await env.PLAYLIST_CONFIGS.put(keyFor(code), playlistUrl, { expirationTtl: CONFIG_TTL_SECONDS });
  return json({ ok: true });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return json({ ok: true });

    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/setup') return handleSetup(url);
    if (request.method === 'GET' && url.pathname === '/api/config') return handleGetConfig(url, env);
    if (request.method === 'POST' && url.pathname === '/api/config') return handlePostConfig(request, env);

    return json({ error: 'Not found' }, 404);
  },
};
