# ShortVideo Feed & iOS Shortcut Worker

Cloudflare Worker backend for ShortVideo TV, providing real-time feed synchronization, iOS Shortcut dynamic generation, and Vietnam-optimized Facebook Reel CDN resolution.

## Features

- **Live TV Feed Sync**: KV-backed real-time feed polling (`/feed?code=...`) for Samsung Tizen TVs.
- **Dynamic iOS Shortcut Generator**: Generates and serves native `.shortcut` files (`/download-shortcut?code=...`) pre-configured with the TV device code.
- **Vietnam CDN Resolution**: Endpoint `/submit-html` accepts HTML fetched directly by iPhone on local VN networks, extracting direct fbcdn MP4 streams (`video-sin...`, `video-hkg...`) with ~190 Mbps intake speed.
- **Auto-Fallback Resolver**: Seamless fallback to secondary resolver (yt-dlp) if HTML lacks direct streams.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/setup?code=XXX` | Web setup page with QR code and one-click iOS Shortcut download button |
| `GET` | `/download-shortcut?code=XXX` | Generates & serves binary Apple iOS `.shortcut` file pre-filled with TV code `XXX` |
| `POST` | `/submit-html` | Receives `{ code, url, html }` from iOS Shortcut, extracts direct CDN MP4 links, pushes to feed |
| `POST` | `/submit` | Receives `{ code, url }` or `{ code, videoUrl }` from web setup form |
| `GET` | `/feed?code=XXX` | Fetches JSON video feed for TV app |
| `DELETE` | `/feed?code=XXX` | Clears all video items for code `XXX` |
| `GET` | `/suggestions?code=XXX` | Fetches suggested next videos based on recent Reels |

## Deployment

```bash
npm run deploy
```

Deployed live at: `https://shortvideo-feed.dvt-kisu.workers.dev`
