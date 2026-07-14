# Public ShortVideo TV Design

## Goal

Build a TizenBrew app that works on Samsung Tizen 3 by avoiding modern TikTok, Facebook, and Instagram web apps entirely. The app will use a local, lightweight TV UI and play public, no-login videos only when a direct video URL is available.

## Non-Goals

- Do not load `tiktok.com`, `facebook.com`, `instagram.com`, or YouTube pages inside the TV app.
- Do not bypass login, DRM, region restrictions, or platform access controls.
- Do not scrape private content or use private user data.
- Do not include YouTube Shorts because TizenTube already handles YouTube well.
- Do not promise an automatic TikTok/Reels For You feed in the first version.

## Recommended Approach

Use a curated public feed first.

The TV app fetches a JSON file from a public HTTPS URL. The JSON contains a list of videos with direct playable media URLs. The Tizen app renders the feed locally and plays videos through the browser's native `<video>` element.

This matches the part of TizenTube that matters for Tizen 3: the TV only runs a simple UI and a video player. It does not run the source platform's heavy website.

## Feed Format

The initial feed format is intentionally small:

```json
{
  "version": 1,
  "updatedAt": "2026-07-11T00:00:00Z",
  "items": [
    {
      "id": "example-1",
      "title": "Example video",
      "source": "tiktok",
      "sourceUrl": "https://www.tiktok.com/@public/video/123",
      "videoUrl": "https://example.com/video.mp4",
      "thumbnailUrl": "https://example.com/thumb.jpg",
      "duration": 30
    }
  ]
}
```

Required fields: `id`, `title`, `source`, `videoUrl`.

Optional fields: `sourceUrl`, `thumbnailUrl`, `duration`.

Only direct video files that Tizen 3 can play should be added. Prefer MP4/H.264/AAC. Avoid HLS unless tested on the target TV.

## App Behavior

On launch:

- Show a local loading screen.
- Fetch the configured public JSON feed.
- If the feed loads, show a simple vertical list/grid of videos.
- If the feed fails, show a clear error and a retry option.

Navigation:

- Up/Down moves selection.
- Enter/OK plays the selected video.
- Play/Pause toggles playback.
- Back returns from player to feed.
- Back on the feed exits or returns to TizenBrew, depending on TizenBrew behavior.

Playback:

- Use a single `<video>` element.
- Use native controls only if custom remote controls fail on Tizen 3.
- Auto-play the selected video after a user action.
- On video error, show `This video cannot play on this TV` and return to the feed.

## Components

`index.html`:

- Static shell loaded by TizenBrew via `packageType: "app"` and `appPath: "index.html"`.
- Includes minimal CSS and `./dist/inject.js`.

`src/inject.ts`:

- Fetches feed JSON.
- Renders feed UI.
- Manages remote navigation.
- Manages video playback.
- Handles loading and error states.

Feed URL configuration:

- First version uses a compile-time `FEED_URL` constant in `src/inject.ts`.
- Before publishing a useful release, `FEED_URL` must point to a real public HTTPS JSON feed with CORS enabled.
- If `FEED_URL` is empty or invalid, the app shows `No feed configured` and stays on the local UI.
- Later version can add a settings screen for custom feed URLs.

## Backend Worker (shortvideo-feed)

Deployed as a Cloudflare Worker at `https://shortvideo-feed.dvt-kisu.workers.dev`.

### Endpoints

- `POST /submit` - Submit a video to the feed
  - Accepts `{ "videoUrl": "...", "title": "...", "source": "...", "thumbnailUrl": "...", "duration": N }` for direct URLs
  - Accepts `{ "url": "https://www.tiktok.com/..." }` for TikTok URLs (tries to resolve, may fail due to WAF)
  - Returns `{ "ok": true, "item": { ... } }`
- `GET /feed` - Returns the stored feed
  - Returns `{ "items": [ ... ] }`
- `GET /resolve?url=...` - Debug endpoint to resolve a single URL
  - Returns resolved video info or error

### KV Storage

- Key `feed` stores JSON array of feed items
- TTL: 48 hours
- Max items: 50, with deduplication by `sourceUrl`

### TikTok Resolution Limitation

TikTok's WAF (Slardar) blocks server-side requests from datacenter IPs. The resolver attempts to:
1. Call TikTok's internal item detail API
2. Scrape the HTML page for `__UNIVERSAL_DATA_FOR_REHYDRATION__`
Both approaches fail because the WAF challenge page is returned instead of real content.

**Workaround:** Submit direct MP4 URLs found manually (via browser dev tools or downloader extensions).

## Data Flow

```text
Phone/PC:
  POST https://shortvideo-feed.dvt-kisu.workers.dev/submit
  { "videoUrl": "https://example.com/video.mp4", ... }

Cloudflare Worker (KV-backed):
  -> validates input
  -> stores in KV feed list
  -> returns ok

Samsung Tizen 3 TV (TizenBrew app):
  -> opens local index.html
  -> inject.js runs
  -> validate FEED_URL (= Worker /feed)
  -> fetch GET /feed from Worker
  -> render selectable feed items
  -> user selects item
  -> set video.src = item.videoUrl
  -> play video with remote controls
```

## Error Handling

Feed fetch fails:

- Show `Could not load feed`.
- Provide retry with Enter/OK.

Feed URL is not configured:

- Show `No feed configured`.
- Do not attempt network requests.

Feed has invalid items:

- Skip items missing required fields.
- If no valid items remain, show `No playable videos in feed`.

Video fails to play:

- Show `This video cannot play on this TV`.
- Keep app alive and allow Back to return to the feed.

Unsupported platform links:

- Do not navigate to platform websites.
- Show source URL as metadata only.

## Testing

Automated tests should verify:

- Package format remains `packageType: "app"` with `appPath: "index.html"`.
- `index.html` references an existing `dist/inject.js` bundle.
- Source code does not use `window.location.href` for platform navigation.
- Feed parsing skips invalid items.
- Remote key handlers include Up, Down, Enter, Back, and Play/Pause.
- UI includes feed, player, loading, and error states.

Manual Tizen 3 test checklist:

- App opens to local UI.
- Feed loads over HTTPS.
- Up/Down selection works.
- Enter starts playback after user action.
- Play/Pause works.
- Back returns to feed.
- Bad video URL shows an error without exiting TizenBrew.

## Release Scope

First release after this design should be `@kv8n2oryk/fb-reels-tv@0.1.18` or later, depending on whether the currently prepared iframe build is published. The release should replace the launcher-to-web approach with the curated feed player approach.

## Risks

- Public direct video URLs may expire or block hotlinking.
- Some MP4 files may use codecs unsupported by Tizen 3.
- Feed Worker KV storage has 48h TTL; items are automatically pruned.
- TikTok WAF blocks server-side resolution; manual URL submission required.
- Worker URL must match CORS headers (currently allow `*`).

## Future Work

- Add a settings screen for custom feed URLs on the TV app.
- Add simple caching in local storage for the last successful feed.
- Add per-source badges and basic filtering.
- Explore TikTok resolution via Cloudflare Browser Rendering (paid add-on).
- Build a browser extension or local CLI tool that resolves TikTok URLs and submits to the Worker.
- Add a simple web frontend for URL submission (instead of curl/API calls).
- Support Facebook/Instagram Reels when/if their WAF allows.
