# ShortVideo TV

A lightweight video feed player for Samsung Tizen 3 TVs via [TizenBrew](https://github.com/reisxd/TizenBrew). Plays Facebook Reels without loading Facebook's website.

## What It Does

Tizen 3 TVs run an old WebKit browser that can't handle modern Facebook pages. Instead of embedding the site, this app:

1. Loads a feed of Reel URLs from a Cloudflare Worker backend
2. Plays each video through the TV's **native AVPlay API** when available, falling back to the web `<video>` element
3. Resolves Reel URLs to CDN links through a backend yt-dlp service, then streams directly from the CDN

## Remote Controls

| Button | Action |
|--------|--------|
| ↑ ↓ | Navigate feed |
| ← → | Navigate feed (in feed) / seek ∓10s (in player) |
| OK / Enter | Play (in feed) / Pause-Resume (in player) |
| ◁ Back | Close player, return to feed |
| 🔴 Red button | Clear entire feed |

The overlay poll is opt-in and off by default. Flip `NETSTATS_ENABLED` to `true` and rebuild while diagnosing; do not ship it enabled on Tizen 3 hardware.

## Playback Engines

The player picks an engine per item and falls back automatically.

| Engine | When | Notes |
|---|---|---|
| AVPlay API | TV exposes `window.webapis.avplay` | Native Samsung decoder, larger default buffer, no seek penalty |
| `<video>` | Any failure above | `prepareAsync` error or 15s timeout drops back here |

Android TV builds short-circuit to `window.AndroidBridge.openVideo` before either web engine runs.

### Net-stats overlay (disabled by default)

`NETSTATS_ENABLED` in `src/inject.ts` is `false`. When enabled, a bottom-left overlay reports which engine is live, buffer depth and load rate:

- `AVPLAY | T 12.3s/38.9s | stall 0` — native engine
- `BUF FULL | IN -- | 360x640 | stall 0` — web engine, file fully buffered
- `BUF 6.2s | IN 1.30x | 720x960 | stall 0` — seconds buffered and load rate vs playback speed

It polls `video.buffered` once per second, which can stall old Tizen WebKit mid-decode, so leave it off unless you are diagnosing playback.

## Playback Fallback Chain

Each item is attempted in order until one starts without a media error:

1. **Direct CDN** — resolved fbcdn URL, lowest latency
2. **Redirect** — `GET /play?mode=redirect`, refreshes the signed URL
3. **Proxy** — `GET /play?mode=proxy`, streams through the resolver

Bilibili requires Android TV and never enters the web chain.

## Backend

The companion [Cloudflare Worker](../../workers/tiktok-resolver/) provides:

- `POST /submit` — add a Facebook Reels URL to a code's feed
- `GET /feed?code=XXX` — fetch the feed as JSON
- `GET /suggestions?code=XXX` — optional feed suggestions
- `DELETE /feed?code=XXX` — clear all items from a feed

A [FastAPI server](../../backend/yt-dlp-resolver/) handles yt-dlp resolution and CDN proxying:

| Endpoint | Purpose |
|---|---|
| `GET /resolve?url=...` | Resolve a Reel URL to a playable CDN link plus title |
| `GET /play?mode=redirect` | 302 to the current CDN URL |
| `GET /play?mode=proxy` | Stream the CDN bytes through the resolver |
| `GET /play?mode=merge` | Mux best AVC1 video-only (720p+) with audio into mp4, no re-encode |

## Feed JSON Schema

```json
{
  "items": [
    {
      "id": "unique-id",
      "title": "Video title",
      "source": "Facebook",
      "sourceUrl": "https://www.facebook.com/reel/...",
      "videoUrl": "https://cdn.example.com/video.mp4",
      "thumbnailUrl": "https://cdn.example.com/thumb.jpg",
      "duration": 0,
      "resolvedAt": "2026-07-13T00:00:00.000Z"
    }
  ]
}
```

Items with `source: "TikTok"` are filtered out by the player.

## Supported Sources

| Source | Resolution Method | Notes |
|--------|-------------------|-------|
| Facebook Reels | Backend yt-dlp resolves progressive H.264 (`best[vcodec^=avc1][ext=mp4]`, falling back to `sd`) | Falls back to redirect, then proxy if the CDN stream errors |

## Technical Constraints

- **Tizen 3 codec**: H.264/AVC only. No AV1, no VP9. Facebook's `hd` format is usually AV1 and fails with a decode error, so it must never be selected.
- **Signed CDN URLs**: fbcdn links expire, so a stalled or failed stream needs a fresh resolve rather than a retry on the same URL.
- **No login**: Only public/no-login videos.
- **File duration metadata**: Reel MP4s often declare a wildly wrong duration. The seek bar and buffer readouts can show nonsense values for that reason.

## Build

```bash
npm run build
```

Emits both bundles — the minified `dist/inject.js` loaded by `index.html`, and `dist/inject.global.js` used by TizenBrew. **Both must be rebuilt on every source change**; a stale `inject.global.js` silently ships old code to the TV.

## License

MIT