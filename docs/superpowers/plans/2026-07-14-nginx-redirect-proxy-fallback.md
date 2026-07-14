# Nginx Redirect-First Proxy Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let up to ten TVs use direct Facebook CDN playback, refresh expired URLs through HTTP redirect, and use an asynchronous Morocco proxy only as the final fallback.

**Architecture:** FastAPI exposes explicit redirect and proxy modes while retaining legacy proxy behavior. A shared `httpx.AsyncClient` streams Range responses asynchronously, Nginx listens publicly on port 8000 and fronts Uvicorn on localhost port 8001, and the TV advances through direct, redirect, and proxy playback stages.

**Tech Stack:** Python 3.10, FastAPI, httpx, yt-dlp, Nginx, systemd, TypeScript/ES2015, Vitest, esbuild.

---

## File Structure

- Modify `backend/yt-dlp-resolver/app.py`: add redirect mode, async pooled proxy, platform headers, and Range forwarding.
- Modify `backend/yt-dlp-resolver/test_app.py`: test route modes and streaming without external network.
- Modify `backend/yt-dlp-resolver/requirements.txt`: add httpx.
- Create `backend/yt-dlp-resolver/nginx.conf`: public Nginx reverse-proxy configuration.
- Modify `backend/yt-dlp-resolver/deploy.sh`: install/copy/validate Nginx and bind Uvicorn locally.
- Modify `backend/yt-dlp-resolver/yt-dlp-resolver.service`: bind Uvicorn to localhost.
- Modify `packages/templates/fb-reels-tv/src/inject.ts`: implement direct -> redirect -> proxy playback stages.
- Modify `packages/templates/fb-reels-tv/test/package-format.test.ts`: verify staged fallback behavior.
- Regenerate `packages/templates/fb-reels-tv/dist/inject.js`.

## Task 1: FastAPI Redirect And Async Proxy Modes

**Files:**
- Modify: `backend/yt-dlp-resolver/app.py`
- Modify: `backend/yt-dlp-resolver/test_app.py`
- Modify: `backend/yt-dlp-resolver/requirements.txt`

- [ ] **Step 1: Add the httpx dependency**

Append to `backend/yt-dlp-resolver/requirements.txt`:

```text
httpx>=0.28.0
```

- [ ] **Step 2: Write failing redirect-mode tests**

Extend imports in `backend/yt-dlp-resolver/test_app.py`:

```python
import asyncio
from types import SimpleNamespace

import httpx
from fastapi import HTTPException
```

Add these tests to `FacebookFormatTests`:

```python
    def test_play_redirect_mode_returns_fresh_cdn_location(self):
        request = SimpleNamespace(headers={}, app=SimpleNamespace(state=SimpleNamespace()))

        with patch.object(app, "resolve_and_get_cdn", return_value=CDN_URL) as resolve:
            response = asyncio.run(app.play(
                request,
                FACEBOOK_URL,
                mode="redirect",
                direct=None,
                x_api_key=app.API_KEY or None,
                api_key=None,
            ))

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["location"], CDN_URL)
        resolve.assert_called_once_with(FACEBOOK_URL)

    def test_play_rejects_unknown_mode(self):
        request = SimpleNamespace(headers={}, app=SimpleNamespace(state=SimpleNamespace()))

        with self.assertRaises(HTTPException) as raised:
            asyncio.run(app.play(
                request,
                FACEBOOK_URL,
                mode="invalid",
                direct=None,
                x_api_key=app.API_KEY or None,
                api_key=None,
            ))

        self.assertEqual(raised.exception.status_code, 400)
```

- [ ] **Step 3: Write the failing async Range proxy test**

Add to `FacebookFormatTests`:

```python
    def test_proxy_forwards_range_and_upstream_206_headers(self):
        observed = {}

        async def handler(request):
            observed["range"] = request.headers.get("range")
            observed["referer"] = request.headers.get("referer")
            return httpx.Response(
                206,
                headers={
                    "content-type": "video/mp4",
                    "content-length": "4",
                    "content-range": "bytes 0-3/100",
                    "accept-ranges": "bytes",
                },
                content=b"data",
            )

        async def run_test():
            client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
            request = SimpleNamespace(
                headers={"range": "bytes=0-3"},
                app=SimpleNamespace(state=SimpleNamespace(http_client=client)),
            )
            response = await app.proxy_cdn(request, CDN_URL, FACEBOOK_URL)
            body = b"".join([chunk async for chunk in response.body_iterator])
            if response.background:
                await response.background()
            await client.aclose()
            return response, body

        response, body = asyncio.run(run_test())

        self.assertEqual(response.status_code, 206)
        self.assertEqual(response.headers["content-range"], "bytes 0-3/100")
        self.assertEqual(response.headers["content-length"], "4")
        self.assertEqual(body, b"data")
        self.assertEqual(observed["range"], "bytes=0-3")
        self.assertEqual(observed["referer"], "https://www.facebook.com/")
```

- [ ] **Step 4: Run backend tests and verify RED**

Run: `python -m unittest -v test_app.py`

Working directory: `backend/yt-dlp-resolver`

Expected: FAIL because `mode` is not accepted, redirect mode is absent, and `proxy_cdn` is synchronous.

- [ ] **Step 5: Add pooled HTTP client lifespan**

Update `backend/yt-dlp-resolver/app.py` imports:

```python
from contextlib import asynccontextmanager

import httpx
from fastapi.responses import RedirectResponse, StreamingResponse
from starlette.background import BackgroundTask
```

Replace FastAPI construction with:

```python
@asynccontextmanager
async def lifespan(application: FastAPI):
    limits = httpx.Limits(max_connections=20, max_keepalive_connections=10)
    timeout = httpx.Timeout(connect=10.0, read=120.0, write=30.0, pool=10.0)
    async with httpx.AsyncClient(
        limits=limits,
        timeout=timeout,
        follow_redirects=True,
    ) as client:
        application.state.http_client = client
        yield


app = FastAPI(title="yt-dlp Resolver", version="0.3.0", lifespan=lifespan)
```

- [ ] **Step 6: Replace blocking proxy with platform-aware async streaming**

Replace `proxy_cdn` in `backend/yt-dlp-resolver/app.py` with:

```python
def proxy_headers(source_url: str, range_header: str | None) -> dict[str, str]:
    headers = {"User-Agent": UA, "Accept": "*/*"}
    if is_facebook_url(source_url) or "fbcdn.net" in source_url:
        headers["Referer"] = "https://www.facebook.com/"
        headers["Origin"] = "https://www.facebook.com"
    elif is_tiktok_url(source_url) or "tiktokcdn" in source_url:
        headers["Referer"] = "https://www.tiktok.com/"
        headers["Origin"] = "https://www.tiktok.com"
    if range_header:
        headers["Range"] = range_header
    return headers


async def proxy_cdn(request: Request, cdn_url: str, source_url: str) -> StreamingResponse:
    client: httpx.AsyncClient = request.app.state.http_client
    upstream_request = client.build_request(
        "GET",
        cdn_url,
        headers=proxy_headers(source_url, request.headers.get("range")),
    )
    try:
        upstream = await client.send(upstream_request, stream=True)
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail=f"CDN timeout: {exc}")
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"CDN fetch failed: {exc}")

    if upstream.status_code >= 400:
        await upstream.aclose()
        raise HTTPException(status_code=502, detail=f"CDN returned HTTP {upstream.status_code}")

    response_headers = {"Accept-Ranges": upstream.headers.get("accept-ranges", "bytes")}
    for name in ("content-type", "content-length", "content-range"):
        value = upstream.headers.get(name)
        if value:
            response_headers[name.title()] = value

    return StreamingResponse(
        upstream.aiter_bytes(chunk_size=256 * 1024),
        status_code=upstream.status_code,
        headers=response_headers,
        background=BackgroundTask(upstream.aclose),
    )
```

- [ ] **Step 7: Implement redirect/proxy route modes**

Replace `/play` in `backend/yt-dlp-resolver/app.py` with:

```python
@app.get("/play")
async def play(request: Request, url: str, mode: str = Query("proxy"),
               direct: str | None = Query(None),
               x_api_key: str | None = Header(None), api_key: str | None = Query(None)):
    check_api_key(x_api_key or api_key)
    if not url or not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(status_code=400, detail="Invalid or missing url parameter")
    if mode not in ("redirect", "proxy"):
        raise HTTPException(status_code=400, detail="Invalid mode")

    cdn_url = url if direct == "1" else resolve_and_get_cdn(url)
    if mode == "redirect":
        return RedirectResponse(cdn_url, status_code=302)
    return await proxy_cdn(request, cdn_url, url)
```

- [ ] **Step 8: Run backend verification**

Run: `python -m unittest -v test_app.py`

Working directory: `backend/yt-dlp-resolver`

Expected: all tests pass.

Run: `python -m py_compile app.py test_app.py`

Expected: exits successfully with no output.

## Task 2: TV Three-Stage Playback Fallback

**Files:**
- Modify: `packages/templates/fb-reels-tv/src/inject.ts`
- Modify: `packages/templates/fb-reels-tv/test/package-format.test.ts`
- Regenerate: `packages/templates/fb-reels-tv/dist/inject.js`

- [ ] **Step 1: Update behavioral tests for direct -> redirect -> proxy**

In `packages/templates/fb-reels-tv/test/package-format.test.ts`, change Facebook fallback expectations to:

```ts
var redirectUrl = 'http://84.8.220.24:8000/play?mode=redirect&url=https%3A%2F%2Fwww.facebook.com%2Freel%2F123&api_key=299145bbcefca5e3dd0f193dc6d187b0';
var proxyUrl = 'http://84.8.220.24:8000/play?mode=proxy&url=https%3A%2F%2Fwww.facebook.com%2Freel%2F123&api_key=299145bbcefca5e3dd0f193dc6d187b0';
```

Add a focused test:

```ts
  it('falls back from direct CDN to redirect and then proxy', async () => {
    var harness = createInjectHarness([undefined, undefined, undefined]);

    await loadHarnessFeed(harness);
    harness.elements.feed.children[0].events.click();
    harness.elements.video.events.error();
    harness.elements.video.events.error();

    expect(harness.assignedSources).toEqual([
      'https://video.xx.fbcdn.net/v/t42.1790-2/video.mp4',
      'http://84.8.220.24:8000/play?mode=redirect&url=https%3A%2F%2Fwww.facebook.com%2Freel%2F123&api_key=299145bbcefca5e3dd0f193dc6d187b0',
      'http://84.8.220.24:8000/play?mode=proxy&url=https%3A%2F%2Fwww.facebook.com%2Freel%2F123&api_key=299145bbcefca5e3dd0f193dc6d187b0',
    ]);
  });
```

Add a final-error assertion by firing `error` a third time and checking `#error` is visible with `Playback error` text.

- [ ] **Step 2: Build the current bundle and run tests to verify RED**

Run: `npx esbuild src/inject.ts --bundle --minify --target=es2015 --outfile=dist/inject.js`

Run: `npm test`

Working directory: `packages/templates/fb-reels-tv`

Expected: fallback-order test fails because the app currently goes directly from CDN to proxy.

- [ ] **Step 3: Replace the single proxy URL builder**

In `packages/templates/fb-reels-tv/src/inject.ts`, replace `buildFacebookProxyUrl` with:

```ts
  function buildFacebookPlayUrl(sourceUrl, mode) {
    return FALLBACK_RESOLVER_URL + '/play?mode=' + mode + '&url=' + encodeURIComponent(sourceUrl) + '&api_key=' + encodeURIComponent(FALLBACK_API_KEY);
  }

  function setFacebookFallbacks(item) {
    item._redirectUrl = buildFacebookPlayUrl(item.sourceUrl, 'redirect');
    item._proxyUrl = buildFacebookPlayUrl(item.sourceUrl, 'proxy');
  }
```

Call `setFacebookFallbacks(item)` for every Facebook item before direct or resolved playback.

- [ ] **Step 4: Replace boolean fallback state with three stages**

Replace:

```ts
  var fallbackAttempted = false;
```

with:

```ts
  var facebookFallbackStage = 0;
```

Reset it to zero in `playItem`.

Add:

```ts
  function tryNextFacebookFallback(item, requestId) {
    if (!video || !item || item.source !== 'Facebook') return false;
    var nextUrl = '';
    if (facebookFallbackStage === 0 && item._redirectUrl) {
      facebookFallbackStage = 1;
      nextUrl = item._redirectUrl;
    } else if (facebookFallbackStage === 1 && item._proxyUrl) {
      facebookFallbackStage = 2;
      nextUrl = item._proxyUrl;
    }
    if (!nextUrl) return false;

    if (playerLoadingEl) {
      playerLoadingEl.style.display = 'block';
      playerLoadingEl.textContent = facebookFallbackStage === 1
        ? 'Refreshing video URL...'
        : 'Retrying via proxy...';
    }
    video.src = nextUrl;
    video.load();
    var retry = video.play();
    if (retry && retry.catch) {
      retry.catch(function (err) {
        if (!isPlayerOpen || requestId !== playRequestId) return;
        if (!tryNextFacebookFallback(item, requestId)) {
          clearTimeout(loadTimeout);
          showError('Cannot play: ' + (err && err.message ? err.message : 'unknown'));
          if (playerLoadingEl) playerLoadingEl.style.display = 'none';
        }
      });
    }
    return true;
  }
```

Use this helper in both the `video.play().catch` path and video `error` event before displaying the final error.

- [ ] **Step 5: Run TV verification and rebuild**

Run: `npx esbuild src/inject.ts --bundle --minify --target=es2015 --outfile=dist/inject.js`

Run: `npm test`

Working directory: `packages/templates/fb-reels-tv`

Expected: all tests pass.

## Task 3: Nginx And Server Deployment

**Files:**
- Create: `backend/yt-dlp-resolver/nginx.conf`
- Modify: `backend/yt-dlp-resolver/deploy.sh`
- Modify: `backend/yt-dlp-resolver/yt-dlp-resolver.service`

- [ ] **Step 1: Create Nginx configuration**

Create `backend/yt-dlp-resolver/nginx.conf`:

```nginx
server {
    listen 8000 default_server;
    listen [::]:8000 default_server;
    server_name _;

    client_max_body_size 1m;

    location /play {
        access_log off;
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Connection "";
        proxy_read_timeout 60s;
    }
}
```

- [ ] **Step 2: Bind Uvicorn to localhost**

In both `backend/yt-dlp-resolver/yt-dlp-resolver.service` and the generated service block in `deploy.sh`, change:

```text
--host 0.0.0.0 --port 8000
```

to:

```text
--host 127.0.0.1 --port 8001
```

- [ ] **Step 3: Update deployment dependencies and Nginx installation**

In `deploy.sh`:

- Install `nginx` with system packages.
- Install Python dependencies from `requirements.txt` plus yt-dlp.
- Copy `requirements.txt` and `nginx.conf` into `/opt/yt-dlp-resolver`.
- Copy Nginx config to `/etc/nginx/sites-available/yt-dlp-resolver`.
- Remove `/etc/nginx/sites-enabled/default`.
- Symlink the resolver site into `/etc/nginx/sites-enabled/`.
- Run `nginx -t` before restarting services.
- Restart Uvicorn, then reload Nginx.

Use these deployment commands in the script:

```bash
apt install -y -qq python3 python3-pip nginx
pip3 install -q yt-dlp -r "$(dirname "$0")/requirements.txt"
cp "$(dirname "$0")/nginx.conf" /etc/nginx/sites-available/yt-dlp-resolver
rm -f /etc/nginx/sites-enabled/default
ln -sfn /etc/nginx/sites-available/yt-dlp-resolver /etc/nginx/sites-enabled/yt-dlp-resolver
nginx -t
systemctl restart "$SERVICE_NAME"
systemctl enable nginx
systemctl reload nginx
```

- [ ] **Step 4: Run local static verification**

Run: `python -m unittest -v test_app.py`

Run: `python -m py_compile app.py test_app.py`

Working directory: `backend/yt-dlp-resolver`

Expected: tests and compilation pass.

Run: `rg -- '--host 127.0.0.1 --port 8001|listen 8000|proxy_buffering off|access_log off' deploy.sh yt-dlp-resolver.service nginx.conf`

Expected: localhost port 8001 appears in both service definitions; public port 8000 and streaming/logging directives appear in Nginx config.

## Task 4: End-To-End Verification And Release Preparation

**Files:**
- Verify: `backend/yt-dlp-resolver/app.py`
- Verify: `backend/yt-dlp-resolver/nginx.conf`
- Verify: `packages/templates/fb-reels-tv/src/inject.ts`
- Verify: `packages/templates/fb-reels-tv/dist/inject.js`

- [ ] **Step 1: Run all local verification**

Run from `backend/yt-dlp-resolver`:

```bash
python -m unittest -v test_app.py
python -m py_compile app.py test_app.py
```

Run from `packages/templates/fb-reels-tv`:

```bash
npm test
npx esbuild src/inject.ts --bundle --minify --target=es2015 --outfile=dist/inject.js
```

Expected: all tests pass and both compilation/build commands succeed.

- [ ] **Step 2: Deploy Morocco server**

Copy `app.py`, `requirements.txt`, `nginx.conf`, and the updated deployment/service files to the server. Run as root from the uploaded backend directory:

```bash
bash deploy.sh "$API_KEY"
```

Expected: `nginx -t` succeeds, Uvicorn runs on localhost:8001, and Nginx listens on port 8000.

- [ ] **Step 3: Run server smoke tests**

```bash
curl http://localhost:8000/health
curl -sS -D - -o /dev/null -H "X-API-Key: $API_KEY" \
  "http://localhost:8000/play?mode=redirect&url=$FACEBOOK_URL"
curl -H "Range: bytes=0-65535" -H "X-API-Key: $API_KEY" \
  -D - -o /dev/null \
  "http://localhost:8000/play?mode=proxy&url=$FACEBOOK_URL"
```

Expected:

- Health returns HTTP 200.
- Redirect returns HTTP 302 with a Facebook CDN `Location`.
- Proxy returns HTTP 206 when the CDN honors Range, with `Content-Range` and `Accept-Ranges`.

- [ ] **Step 4: Test two concurrent clients**

```bash
curl -H "Range: bytes=0-1048575" -H "X-API-Key: $API_KEY" \
  -o /dev/null "http://localhost:8000/play?mode=proxy&url=$FACEBOOK_URL" &
curl -H "Range: bytes=1048576-2097151" -H "X-API-Key: $API_KEY" \
  -o /dev/null "http://localhost:8000/play?mode=proxy&url=$FACEBOOK_URL" &
wait
```

Expected: both commands complete without HTTP 5xx responses and service logs show no timeout or connection-pool errors.

- [ ] **Step 5: Prepare TV release only after server smoke tests pass**

Increment the package patch version once, rebuild, rerun tests, and publish only after the user provides a fresh npm OTP. Do not deploy or publish automatically before server validation.

- [ ] **Step 6: Checkpoint without commit unless requested**

Inspect only scoped files. Do not commit, push, or create a PR unless explicitly requested.

## Self-Review

- Spec coverage: redirect, async proxy, Range/206, connection pool, Facebook headers, Nginx, localhost Uvicorn, TV three-stage fallback, and under-ten-TV verification are covered.
- Placeholder scan: no implementation placeholders remain. Shell variables are runtime inputs, not missing design decisions.
- Type consistency: route modes are exactly `redirect` and `proxy`; TV fields are `_redirectUrl` and `_proxyUrl`; the shared format remains `FACEBOOK_FORMAT`.
