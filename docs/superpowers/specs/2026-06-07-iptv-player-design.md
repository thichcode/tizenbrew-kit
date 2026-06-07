# IPTV Player Module - Design Spec

## Overview

A new TizenBrew template (`iptv-player`) that provides a TV-friendly IPTV channel player for Vietnamese TV channels. The player fetches an M3U playlist from GitHub, parses channels, and plays them via native HTML5 `<video>` with UDP-multicast HTTP-wrapped MPEG-TS streams.

## Goals

- Play IPTV channels from a local multicast proxy (192.168.1.7:1234)
- Full TV remote control support (arrow keys, enter, back, play/pause, number keys)
- TV-friendly 10-foot UI (large fonts, high contrast, clear focus indicators)
- Auto-fetch playlist from GitHub and parse M3U format

## Architecture

### Directory Structure

```
packages/templates/iptv-player/
├── package.json
├── tizenbrew.config.ts
├── src/
│   ├── index.html          # Player UI (target page)
│   ├── style.css            # TV-friendly styling
│   ├── inject.ts            # Entry point, initializes app
│   ├── playlist.ts          # M3U fetching & parsing
│   ├── player.ts            # Video player wrapper
│   ├── remote.ts            # TV remote key handling
│   └── ui.ts                # Channel list rendering, focus management
```

### Configuration

```ts
// tizenbrew.config.ts
export default {
  name: 'iptv-player',
  displayName: 'IPTV Player',
  version: '0.1.0',
  description: 'TV-friendly IPTV channel player with remote control support',
  targetUrl: 'index.html',
  inject: {
    scripts: ['src/inject.ts'],
    styles: ['src/style.css'],
  },
  tvKeys: {
    arrows: true,
    enter: true,
    back: true,
    playPause: true,
    numbers: true,
    volume: true,
  },
};
```

## UI Design

### Layout

```
+--------------------------------------------------------+
|  IPTV Player                    [Channel List ▼]       |
|                                                        |
|  +------------------------+  +----------------------+  |
|  |                        |  |  Channel List        |  |
|  |     VIDEO PLAYER       |  |  ┌─ VTV1 (HD)      ◄─ │  |  <- Focused
|  |     (16:9, full area)  |  |  ├─ VTV2 (HD)        |  |
|  |                        |  |  ├─ VTV3 (HD)        |  |
|  +------------------------+  |  ├─ HTV7 HD          |  |
|                            |  |  └─ ...              |  |
|  [Now Playing: VTV1]       |  +----------------------+  |
|  [Status: Playing]         |                            |
+--------------------------------------------------------+
```

### Key Elements

- `<video id="player" playsinline controls>` - Native video element
- `<aside id="channel-list">` - Focusable channel list (vertical)
- `<header>` - App title, channel group selector
- `<footer id="status-bar">` - Now playing, connection status, time
- Channel items: `<button class="channel-item" data-url="...">Name</button>`

## Core Modules

### playlist.ts - M3U Parser

- `fetchPlaylist(url: string): Promise<string>` - Fetch from GitHub raw URL
- `parseM3U(content: string): Channel[]` - Parse #EXTINF lines + URLs
- `Channel` interface: `{ name: string; url: string; group?: string; logo?: string; }`
- Group channels by `group-title` or auto-detect from name (VTV, HTV, THVL, etc.)
- Handle encoding issues in playlist (Vietnamese chars)

### player.ts - Video Player Wrapper

- `Player` class wrapping `<video>` element
- `load(url: string): Promise<void>` - Set src, wait for `canplay`
- `play()`, `pause()`, `togglePlay()`
- `on(event, callback)` - Events: play, pause, error, ended, timeupdate
- Error handling: retry on network error (max 3), show error in status bar
- Native MPEG-TS attempt first, detect failure via `error` event

### remote.ts - TV Remote Handling

- Key map: ArrowUp/Down → channel list navigation
- Enter → play selected channel
- ArrowLeft/Right → seek ±10s (when video focused)
- PlayPause → toggle play/pause
- Back → focus channel list (if video focused) or exit
- Number keys (0-9) → direct channel number input
- Volume keys → video.volume (if supported)

## Styling (style.css)

- Font: 28px base, 32px channel names, 20px status
- Colors: Dark bg (#1a1a1a), white text, yellow focus (#ffd600)
- Focus ring: 3px solid #ffd600, outline-offset: 2px
- Channel list: max-height 80vh, overflow-y auto, scrollbar styled
- Video: width 100%, height auto, max-height 70vh
- Status bar: fixed bottom, semi-transparent bg
- Animations: smooth focus transition (150ms), loading spinner
- @media (hover: none) for touch/TV optimization

## inject.ts - Entry Point

- Wait for DOM ready
- Initialize Playlist → fetch + parse
- Initialize UI → render channel list with groups
- Initialize Player → attach to video element
- Initialize Remote → bind key handlers
- Auto-select first channel on load
- Handle visibility change (pause on hidden)

## Build Integration

- Add `iptv-player` to CLI templates list in `packages/cli/src/templates.ts`
- Template follows existing patterns (youtube-tv-lite, facebook-reels-lite)
- `pnpm exec tizenbrew-kit create my-iptv -t iptv-player` should work

## Data Flow

1. On load: `inject.ts` → `fetchPlaylist()` → GitHub raw URL
2. `parseM3U()` → `Channel[]` array
3. `renderChannelList()` → DOM elements
4. User navigates with TV remote → `remote.ts` handles keys
5. User selects channel → `player.load(url)` → `<video>` plays stream
6. Status bar updates → now playing, connection state
7. Error handling → retry up to 3 times, show error message

## Notes

- **Stream format**: UDP multicast wrapped in HTTP (MPEG-TS container). Native `<video>` may work on some Tizen browsers. If not, fallback to HLS.js or transcoding proxy needed.
- **Playlist URL**: `https://raw.githubusercontent.com/thichcode/thichcode/main/filtered_playlist.m3u`
- **Local proxy**: Streams require a local UDP→HTTP proxy running at 192.168.1.7:1234 (e.g., tvheadend, udpxy, or custom Node.js proxy)
