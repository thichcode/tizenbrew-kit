# ShortVideo TV

A lightweight video feed player for Samsung Tizen 3 TVs via [TizenBrew](https://github.com/reisxd/TizenBrew). Plays Facebook Reels without loading Facebook's website.

## What It Does

Tizen 3 TVs run an old WebKit browser that can't handle modern Facebook pages. Instead of embedding the site, this app:

1. Loads a feed of Reel URLs from a Cloudflare Worker backend
2. Plays each video through the TV's **native AVPlay API** when available, falling back to the web `<video>` element
3. Resolves Reel URLs to CDN links through a backend yt-dlp service, then streams directly from the CDN

## Remote Controls

| Button | Action (Feed) | Action (Player) |
|--------|---------------|-----------------|
| ↑ ↓ | Navigate items | **Toggle HUD / Net-stats overlay** |
| ← → | Navigate items | Seek ∓10s |
| OK / Enter | Play selected video | Pause / Resume |
| ◁ Back / Escape | Exit | Close player, return to feed |
| ℹ️ Info / 🟢 Green | - | **Toggle HUD / Net-stats overlay** |
| 🔴 Red button | Clear entire feed | - |

## HUD & Net-Stats Overlay (v1.2.21+)

The player includes an active HUD board enabled by default:
- **Bottom-left diagnostic HUD (`#net-stats`)**:
  - `v1.2.21 AVPLAY-OK | T 12.3s/38.9s | stall 0` — Native Samsung AVPlay engine with active playback time, total duration, and hardware stall counter.
  - `v1.2.21 WebPlayer | BUF 6.2s | IN 1.30x | 720x960 | stall 0` — Web engine fallback showing buffered seconds, download intake rate vs playback speed, real video resolution, and stall counter.
- **Bottom player overlay (`#player-overlay`)**:
  - Video title with contrast shadow.
  - Formatted numerical time readout: `0:15 / 1:30` (or `--:--` if duration is not known).
  - Seek bar fill (`#seek-bar-fill`).
  - Remote shortcut guide and engine badge `[AVPlay • 2m] ▲/▼: HUD   ← →: Seek   OK: pause   Back: feed`.
- **Hardware Layering & Stacking Context**:
  - On Samsung Tizen 3, AVPlay renders via a hardware video plane `<object type="application/avplayer">`.
  - In v1.2.21+, the `<object>` element is prepended at the bottom of the DOM tree (`zIndex: 0`), and overlay elements have explicit high `z-index` (HUD: `35`, seek bar: `25`, overlay: `20`) so video playback never covers the HUD or controls.
- **Toggle anytime**: Press **↑ (Up)**, **↓ (Down)**, **Info**, or **Green** on your TV remote to hide or show the HUD overlay.

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