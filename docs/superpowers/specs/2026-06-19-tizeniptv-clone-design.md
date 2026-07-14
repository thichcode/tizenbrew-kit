# TizenIPTV Clone Design

## Goal

Create a separate npm package, `@kv8n2oryk/tizeniptv@1.2.4`, based on the working IPTV player `0.5.6` code, but loading channels from the VMT TV playlist URL.

## Package Shape

- Keep the existing `packages/templates/iptv-player` package intact.
- Create a separate template/package directory for `tizeniptv`.
- Use app package format with root `index.html`, `packageType: "app"`, and `appPath: "index.html"`.
- Set npm package name to `@kv8n2oryk/tizeniptv`.
- Set version to `1.2.4`, because the target package currently has `latest: 1.2.3`.

## Playlist

The clone must use this playlist URL in the runtime bundle:

`https://raw.githubusercontent.com/vuminhthanh12/vuminhthanh12/refs/heads/main/vmttv`

## Verification

- Add/adjust tests for the new package metadata and playlist URL.
- Build the new package.
- Validate built JavaScript syntax.
- Inspect `npm pack --dry-run` output for `index.html`, `dist/inject.js`, and app-format metadata.
- Publish `@kv8n2oryk/tizeniptv@1.2.4` after npm OTP is available if required.
