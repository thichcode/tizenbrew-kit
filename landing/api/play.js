export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.query.url;
  if (!url || !url.startsWith('http')) {
    return res.status(400).json({ error: 'Missing or invalid url' });
  }

  const backend = process.env.BACKEND_URL || 'http://84.8.220.24:8000';
  const apiKey = process.env.BACKEND_API_KEY || '299145bbcefca5e3dd0f193dc6d187b0';

  const playUrl = `${backend}/play?mode=proxy&url=${encodeURIComponent(url)}&api_key=${encodeURIComponent(apiKey)}`;

  try {
    const upstream = await fetch(playUrl, {
      signal: AbortSignal.timeout(120000),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return res.status(upstream.status).json({
        error: 'Upstream error',
        status: upstream.status,
        detail: text.substring(0, 500),
      });
    }

    const contentType = upstream.headers.get('content-type') || 'video/mp4';
    const contentLength = upstream.headers.get('content-length');
    const contentRange = upstream.headers.get('content-range');

    res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange) res.setHeader('Content-Range', contentRange);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-store');

    const reader = upstream.body.getReader();
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { res.end(); return; }
          res.write(value);
        }
      } catch (e) {
        if (!res.writableEnded) res.end();
      }
    };
    pump();
  } catch (e) {
    if (!res.writableEnded) {
      res.status(502).json({ error: 'Backend unreachable', detail: String(e), backend });
    }
  }
}
