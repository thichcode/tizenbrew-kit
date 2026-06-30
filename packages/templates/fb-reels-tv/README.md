# Facebook Reels TV

Facebook Reels TV is a TizenBrew-compatible app package for watching Facebook Reels on Samsung TV Tizen 3 with remote-control helpers.

## Features

- Arrow up/down reel navigation fallback
- Enter and play/pause remote support
- Samsung back key handling
- Fullscreen-friendly TV mode
- Lightweight DOM cleanup for side panels, comments, and overlays
- Reduced animations for older Tizen devices

## Security and Legal Scope

- Does not bypass Facebook login
- Does not scrape private data
- Does not use private Facebook APIs
- Does not claim ad blocking, DRM bypass, or downloading

## Build

```bash
pnpm exec tizenbrew-kit build
```

## Package

```bash
pnpm exec tizenbrew-kit package
```

## Publish

```bash
npm publish --access public
```
