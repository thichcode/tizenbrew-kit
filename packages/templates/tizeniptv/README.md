# tizeniptv

Tizen IPTV channel player for TizenBrew with full remote control support.

## Features

- Fetches channels from the bundled playlist source
- Parses Vietnamese IPTV channels (VTV, HTV, THVL, etc.)
- Full TV remote support (arrows, enter, back, play/pause, number keys)
- 10-foot UI with large fonts and high contrast focus indicators
- Channel list with group navigation

## Usage

Install the published application module from TizenBrew:

```text
@kv8n2oryk/tizeniptv
```

To build it locally:

```bash
tizenbrew-kit create my-iptv -t tizeniptv
cd my-iptv
tizenbrew-kit dev
tizenbrew-kit build
```

Publish a new version after building:

```bash
npm publish --access public
```

## TV Remote Keys

| Key | Action |
|-----|--------|
| ArrowUp/Down | Previous/next channel |
| Enter | Play selected channel |
| ArrowLeft/Right | Seek ±10s |
| PlayPause | Toggle play/pause |
| Back | Focus channel list |
| 0-9 | Direct channel number input |
| VolumeUp/Down | Adjust volume |

## Requirements

- Network access to playlist source (GitHub)
