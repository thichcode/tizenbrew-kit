# Facebook HD-First Format Design

## Goal

Prioritize Tizen 3-compatible Facebook HD playback while retaining SD and generic fallback formats.

## Scope

- Add one shared Facebook format selector in `backend/yt-dlp-resolver/app.py`.
- Use `hd/sd/b` for both `/resolve` and `/play` Facebook resolution.
- Keep direct Facebook CDN playback as the default TV path.
- Keep the Morocco `/play` endpoint as proxy fallback.
- Do not add a domain, Cloudflare Tunnel, Redis, or WebSocket.

## Behavior

For Facebook URLs, yt-dlp tries formats in this order:

1. `hd`
2. `sd`
3. `b`

The `/resolve` endpoint must apply the same selector as `/play`, preventing the pre-resolved path from returning an arbitrary AV1/VP9 format that Tizen 3 may not decode.

## Implementation

Define:

```python
FACEBOOK_FORMAT = "hd/sd/b"
```

Pass `-f FACEBOOK_FORMAT` to Facebook resolution in both `resolve()` and `resolve_and_get_cdn()`.

## Verification

- Unit-test or command-test that Facebook `/resolve` invokes yt-dlp with `-f hd/sd/b`.
- Verify `/play` uses the same shared constant.
- Run Python syntax validation.
- Test a real Facebook Reel through `/resolve` and confirm the selected format is playable H.264 HD when available.

## Out Of Scope

- Guaranteeing 1080p.
- Adaptive bitrate streaming.
- Changing TV playback from `<video>` to Samsung AVPlay.
- Making Cloudflare Worker reach the Morocco server through a hostname.
