# Nginx Redirect-First Proxy Fallback Design

## Goal

Support fewer than ten concurrent TVs while minimizing Morocco bandwidth and latency. TVs should normally stream directly from Facebook CDN, refresh expired links through an HTTP redirect, and use Morocco streaming proxy only as the final fallback.

## Constraints

- The server has a public IP but no custom domain.
- Traffic remains HTTP for now.
- Facebook playback must prefer `hd/sd/b`.
- Tizen 3 uses the existing HTML `<video>` player.
- No transcoding or video-content cache on Morocco.

## Architecture

```text
TV
 |- 1. Direct signed Facebook CDN URL
 |- 2. Error -> Nginx -> FastAPI /play?mode=redirect -> 302 fresh CDN URL
 `- 3. Error -> Nginx -> FastAPI /play?mode=proxy -> async Morocco stream
```

Nginx listens publicly on port 8000. Uvicorn listens only on `127.0.0.1:8001`. Nginx forwards API and streaming requests to Uvicorn with response buffering disabled.

## FastAPI Routes

### `/resolve`

- Preserve current response shape.
- Facebook uses the shared `FACEBOOK_FORMAT = "hd/sd/b"` selector.
- Returns a signed direct CDN URL for normal playback.

### `/play?mode=redirect`

- Authenticate using the existing header or query API key.
- Resolve the original Facebook URL again with `hd/sd/b`.
- Return HTTP 302 with the fresh CDN URL in `Location`.
- Do not stream video bytes through Morocco.

### `/play?mode=proxy`

- Authenticate using the existing header or query API key.
- Resolve the original URL with `hd/sd/b`.
- Stream the CDN response asynchronously with a shared `httpx.AsyncClient`.
- Forward incoming `Range` and return upstream status, including HTTP 206.
- Preserve `Content-Type`, `Content-Length`, `Content-Range`, and `Accept-Ranges`.
- Use 256 KiB chunks.
- Use Facebook headers for Facebook URLs and TikTok headers for TikTok URLs.

For compatibility, omitted `mode` behaves as `proxy`, matching the current `/play` behavior.

## Connection Management

- Use one application-lifetime `httpx.AsyncClient` to reuse upstream connections.
- Set finite connect timeout and a longer read timeout suitable for video streaming.
- Close the upstream response after streaming completes or the client disconnects.
- Limit the HTTP client connection pool above the expected TV count, for example 20 total connections and 10 keep-alive connections.

## Nginx

Nginx will:

- Listen on port 8000.
- Forward to `http://127.0.0.1:8001` using HTTP/1.1.
- Disable proxy buffering and request buffering for streaming.
- Use long read/send timeouts for video playback.
- Preserve client IP and host headers.
- Disable access logging for `/play` because the API key is currently passed in the query string.

Nginx will not cache signed CDN video URLs or video content.

## TV Playback State

Each Facebook playback has three explicit stages:

1. `direct`: feed CDN URL.
2. `redirect`: `/play?mode=redirect&url=<sourceUrl>&api_key=...`.
3. `proxy`: `/play?mode=proxy&url=<sourceUrl>&api_key=...`.

On a video `error` event, advance one stage. After the proxy stage fails, show the existing playback error. Reset the stage whenever a different item starts. Existing stale-play-request guards remain in place.

## Deployment

- Add `httpx` to `requirements.txt` and install Nginx.
- Copy an Nginx site configuration to `/etc/nginx/sites-available/yt-dlp-resolver` and enable it.
- Bind Uvicorn to `127.0.0.1:8001` instead of `0.0.0.0:8000`.
- Validate Nginx with `nginx -t` before restart.
- Restart Uvicorn and reload Nginx only after validation succeeds.

## Error Handling

- Invalid `mode` returns HTTP 400.
- Resolve timeout returns HTTP 504.
- CDN connection errors return HTTP 502.
- Redirect failure is surfaced as an HTTP error so the TV advances to proxy.
- Proxy failure after headers are sent closes the stream; the TV displays the existing error after its final retry.

## Authentication Decision

- All TVs use the existing shared API key embedded in the public TV package.
- Per-device pairing and token issuance are not implemented.
- The operator explicitly accepts that the shared key is public and can be extracted from npm.
- Nginx `/play` access logging and Uvicorn access logging remain disabled to avoid additional query-string disclosure.
- The deployed server key must match the key compiled into the TV package.

## Testing

- Backend unit tests verify redirect status and `Location` without real network calls.
- Backend unit tests verify proxy Range/header/status forwarding with a mocked async HTTP client.
- Existing tests verify both routes use `hd/sd/b`.
- TV runtime tests verify direct -> redirect -> proxy order and final error behavior.
- Python syntax tests and TV bundle tests remain required.
- Server smoke tests cover `/health`, redirect response headers, Range/206 proxy response, Nginx validation, and concurrent playback from at least two clients.

## Out Of Scope

- HTTPS without a domain.
- Cloudflare Tunnel.
- More than ten concurrent TVs.
- Nginx video caching.
- Transcoding.
- Samsung AVPlay migration.
