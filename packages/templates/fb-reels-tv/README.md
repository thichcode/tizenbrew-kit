# ShortVideo TV

A lightweight video feed player for Samsung Tizen 3 TVs via [TizenBrew](https://github.com/nicehash/tizenbrew-kit). Plays TikTok and Facebook Reels without loading their websites.

## What It Does

Tizen 3 TVs run an old WebKit browser that can't handle modern TikTok/Facebook/Instagram pages. Instead of embedding those sites, this app:

1. Loads a curated feed of video URLs from a [Cloudflare Worker backend](#backend)
2. Plays each video using the TV's native `<video>` player (H.264 MP4 only)
3. Resolves TikTok videos directly from the TV's own network — no server proxy needed for short clips

## Remote Controls

| Button | Action |
|--------|--------|
| ← → ↑ ↓ | Navigate feed |
| OK / Enter | Play / Pause |
| ◁ Back | Close player, return to feed |
| 🔴 Red button | Clear entire feed |

## Backend

The companion [Cloudflare Worker](../../workers/tiktok-resolver/) provides:

- `POST /submit` — add a TikTok or Facebook Reels URL to a code's feed
- `GET /feed?code=XXX` — fetch the feed as JSON
- `GET /resolve?url=...` — resolve a URL to a playable CDN link
- `DELETE /feed?code=XXX` — clear all items from a feed

A [FastAPI server](../../backend/yt-dlp-resolver/) handles yt-dlp resolution for Facebook Reels and proxies CDN URLs when direct playback fails.

## Feed JSON Schema

```json
{
  "items": [
    {
      "id": "unique-id",
      "title": "Video title",
      "source": "TikTok | Facebook",
      "sourceUrl": "https://www.tiktok.com/... or https://facebook.com/reel/...",
      "videoUrl": "https://cdn.example.com/video.mp4",
      "thumbnailUrl": "https://cdn.example.com/thumb.jpg",
      "duration": 0
    }
  ]
}
```

## Supported Sources

| Source | Resolution Method | Notes |
|--------|-------------------|-------|
| TikTok | TV resolves from `__UNIVERSAL_DATA` HTML page | Uses TV's residential IP — no Cloudflare Worker proxy needed |
| Facebook Reels | Server yt-dlp resolves `sd/hd` H.264 progressive format | Falls back to server proxy if direct CDN fails |

## Technical Constraints

- **Tizen 3 codec**: H.264/AVC only. No AV1, no VP9.
- **TikTok CDN**: URLs are IP-bound. Cloudflare Worker egress IPs don't match — so the TV resolves TikTok itself.
- **Facebook CDN**: Server-side yt-dlp selects `sd/hd/b` (H.264 progressive) for codec compatibility.
- **No login**: Only public/no-login videos.

## Build

```bash
npx esbuild src/inject.ts --bundle --minify --target=es2015 --outfile=dist/inject.js
```

## License

MIT
