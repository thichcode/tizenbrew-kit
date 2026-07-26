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

  try {
    const r = await fetch(`${backend}/resolve?url=${encodeURIComponent(url)}`, {
      headers: { 'X-API-Key': apiKey },
      signal: AbortSignal.timeout(30000),
    });
    const data = await r.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'Backend unreachable', detail: String(e), backend });
  }
}
