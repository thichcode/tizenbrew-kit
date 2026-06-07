# iptv-player

TV-friendly IPTV channel player for TizenBrew with full remote control support.

## Features

- Fetches M3U playlist from GitHub
- Parses Vietnamese IPTV channels (VTV, HTV, THVL, etc.)
- Full TV remote support (arrows, enter, back, play/pause, number keys)
- 10-foot UI with large fonts and high contrast focus indicators
- Channel list with group navigation

## Usage

```bash
tizenbrew-kit create my-iptv -t iptv-player
cd my-iptv
tizenbrew-kit dev
tizenbrew-kit build
```

## TV Remote Keys

| Key | Action |
|-----|--------|
| ArrowUp/Down | Navigate channel list |
| Enter | Play selected channel |
| ArrowLeft/Right | Seek ±10s |
| PlayPause | Toggle play/pause |
| Back | Focus channel list |
| 0-9 | Direct channel number input |
| VolumeUp/Down | Adjust volume |

## Requirements

- Local UDP-to-HTTP proxy (e.g., tvheadend, udpxy) at 192.168.1.7:1234
- Network access to playlist source (GitHub)
