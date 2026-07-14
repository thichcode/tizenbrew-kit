# ShortVideo TV Pre-Resolved Facebook Feed Design

## Goal

Make Facebook Reels feel faster on Samsung Tizen 3 TVs by resolving playable CDN URLs before the TV starts playback. The phone/setup flow should do the slow yt-dlp work once, while the TV receives an already-playable feed item and starts playback directly from Facebook CDN.

## Current Problem

The current TV app resolves Facebook at playback time:

```text
TV -> Morocco /resolve -> yt-dlp -> CDN URL -> TV play
```

Short clips work well, but long clips can feel slow because the TV waits for yt-dlp before playback. If playback falls back to proxy, video data may also travel through the Morocco server, which adds latency and can become a bandwidth bottleneck.

## Recommended Architecture

Keep the existing polling model. Do not add Redis or WebSocket yet.

```text
Phone/setup page -> Worker /submit -> Morocco /resolve -> KV feed -> TV poll -> direct CDN play
```

The Worker resolves Facebook URLs during `/submit` by calling the existing fallback resolver server. The feed item stored in KV includes the original Facebook URL and the resolved CDN URL. The TV continues polling `/feed`, but when it sees a newly-added item, it can auto-play immediately without waiting for yt-dlp.

## Components

### Worker

- Accept Facebook URLs through `POST /submit` as today.
- For Facebook, call `callFallbackResolver(env, platformUrl)` before writing KV.
- If resolve succeeds, store `videoUrl` as the resolved CDN URL and store metadata such as `title`, `thumbnailUrl`, and `resolvedAt`.
- If resolve fails, still store the item with `videoUrl` equal to the original platform URL so the existing TV-side fallback path remains usable.
- Keep feed TTL and deduplication behavior unchanged.

### FastAPI Resolver

- Continue using yt-dlp with H.264-compatible `sd/hd/b` selection for Facebook.
- Continue exposing `/resolve` for metadata and direct CDN URL resolution.
- Continue exposing `/play` as fallback proxy only, not as the default long-video path.

### TV App

- Prefer `item.videoUrl` from the feed when it is already a direct CDN URL.
- Do not call `/resolve` again for Facebook if `item.videoUrl` is not the same as `item.sourceUrl`.
- Keep existing direct-play fallback: if direct CDN playback fails, retry through `/play?url=<sourceUrl>`.
- Add auto-play for newly received top feed item when the TV is idle. The app should not interrupt an already-open player.

## Data Model

Feed items remain backward compatible:

```json
{
  "id": "fb_123456",
  "title": "Facebook Reel title",
  "source": "Facebook",
  "sourceUrl": "https://www.facebook.com/reel/123456",
  "videoUrl": "https://video.xx.fbcdn.net/...mp4",
  "thumbnailUrl": "https://...jpg",
  "duration": 0,
  "resolvedAt": "2026-07-13T00:00:00.000Z"
}
```

Older items without `resolvedAt` or with `videoUrl === sourceUrl` still work through the TV's existing resolve-at-playback fallback.

## Playback Behavior

1. TV polls `/feed?code=<deviceCode>` every 5 seconds.
2. TV renders the list as today.
3. If the newest item is new and the player is closed, TV auto-plays it.
4. For Facebook items with a pre-resolved CDN URL, TV sets `<video src>` directly to that CDN URL.
5. If direct playback fires an error event, TV retries through the server proxy using `/play?url=<sourceUrl>`.
6. If proxy playback fails, show the existing video error message.

## Error Handling

- Worker resolve failure should not reject the submit unless the submitted URL is invalid.
- A failed pre-resolve stores a normal unresolved Facebook item so current behavior still works.
- Direct CDN playback failure should be retried once through proxy.
- Auto-play should be suppressed while the player is already open to avoid interrupting a video.

## Testing

- Submit a Facebook Reel and verify KV/feed contains a direct `fbcdn.net` or equivalent CDN `videoUrl`.
- Verify the TV does not call `/resolve` again when `videoUrl !== sourceUrl`.
- Verify a newly submitted item auto-plays when the TV is idle.
- Verify direct playback fallback still retries `/play` on video error.
- Verify older unresolved feed items still play through the old resolve path.

## Out Of Scope

- Redis command queue.
- WebSocket push.
- Login/private Facebook content.
- Proxying all long-video traffic through Morocco by default.
