# yt-dlp Resolver

FastAPI service that resolves TikTok and Facebook Reel URLs and can redirect to
or proxy the resulting video stream.

## Production Architecture

Nginx is the only public listener at `http://SERVER_IP:8000`. It forwards
requests to Uvicorn on the private loopback address `127.0.0.1:8001`; Uvicorn
must not be exposed directly.

## Deploy

The optional argument is a path to a protected file containing a 32-128
character hexadecimal API key. The file must have `0600`-style permissions
with no group or other access.

```bash
sudo bash deploy.sh /path/to/protected-api-key-file
```

When the argument is omitted, deployment preserves the key in
`/etc/yt-dlp-resolver.env` or generates a new key if none exists. The deploy
script does not print the key.

Manually allow inbound TCP 8000 in the host and provider firewall. The deploy
script does not alter firewall rules.

## Production Usage

Replace `SERVER_IP` and the example key and URL values.

```bash
# Public health check through Nginx
curl http://SERVER_IP:8000/health

# Resolve a source URL
curl -H "X-API-Key: your-secret-key" \
  "http://SERVER_IP:8000/resolve?url=https://www.facebook.com/reel/123456"

# Resolve and redirect the client to the current CDN URL
curl -I -H "X-API-Key: your-secret-key" \
  "http://SERVER_IP:8000/play?url=https://www.facebook.com/reel/123456&mode=redirect"

# Resolve and proxy the video stream through the service
curl -H "X-API-Key: your-secret-key" \
  "http://SERVER_IP:8000/play?url=https://www.facebook.com/reel/123456&mode=proxy" \
  --output video.mp4
```

## Local Development

This loopback-only command bypasses Nginx and is for local development only.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt yt-dlp
API_KEY="0123456789abcdef0123456789abcdef" \
  .venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8001
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `API_KEY` | `""` (disabled) | API key accepted through the `X-API-Key` header or supported query parameter |
| `YT_DLP_PATH` | `yt-dlp` | Path to the yt-dlp binary |
