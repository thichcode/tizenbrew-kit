# TizenBrew IPTV Clone With QR Setup Design

## Goal

Replace the current `tizenbrew-iptv` implementation with a close clone of `@kv8n2oryk/iptv-player@0.5.7`, changing only the playlist source setup. The original package hardcodes an M3U URL in `dist/inject.js`; this package must instead collect the M3U URL through a QR setup flow backed by the deployed Cloudflare Worker.

## Package Shape

The package should match the original package structure as closely as possible:

- Root `index.html` loads `./dist/inject.js`.
- `dist/inject.js` contains the injected IPTV app logic.
- `dist/manifest.json` follows the original manifest shape, updated only where package identity/version requires it.
- `dist/README.md` may document the QR setup behavior.
- `package.json` uses `appPath: "index.html"` and `files: ["index.html", "dist"]`.

The current `app/` based implementation and `service.js` are not part of the final published package.

## Behavior To Preserve From Original

Keep the original `@kv8n2oryk/iptv-player@0.5.7` TV-player behavior:

- Same injected full-screen UI layout and styling.
- Same channel list, grouping, sorting, and focus behavior.
- Same video player controls.
- Same remote behavior for arrow navigation, enter, play/pause, channel up/down, seek left/right, volume up/down, escape/back, and numeric channel entry.
- Same auto fullscreen/hide-ui behavior after playback starts.
- Same M3U parsing behavior, including `group-title`, `tvg-logo`, and fallback group detection.

## QR Setup Change

Replace only the hardcoded playlist URL with a dynamic playlist source:

- Use Cloudflare Worker base URL `https://tizenbrew-iptv-setup.dvt-kisu.workers.dev`.
- Generate a short device code on TV startup when no saved playlist exists.
- Render a QR setup URL locally on the TV, without using an external QR image service.
- The QR URL points to `/setup?code=<code>` on the Worker.
- The TV polls `/api/config?code=<code>` until the phone submits a playlist URL.
- When received, store the playlist URL in `localStorage` and then call the original playlist loading flow.
- On later launches, use the stored playlist URL immediately.
- Provide a reset/change path, preferably through an existing remote key that does not break original behavior. Yellow key may be added for reset if available.

## Compatibility

Target Tizen 3 compatibility:

- Use ES5-compatible JavaScript in `dist/inject.js`.
- Do not use `async/await`, `fetch`, optional chaining, modules, `let`, `const`, or arrow functions.
- Use `XMLHttpRequest` for Worker polling and playlist loading.
- Use a local QR renderer bundled in `dist/inject.js` or loaded from `dist/` so QR display does not depend on external image services.

## Error Handling

- If Worker polling returns 404, keep waiting without showing an error.
- If Worker polling fails, show a short status message but keep the setup screen usable.
- If playlist loading fails, show the same style of status error as the original player.
- If no playlist is saved, never attempt to load the original hardcoded URL.

## Verification

Before publishing:

- Verify package contents with `npm pack --dry-run`.
- Verify JavaScript syntax for generated files.
- Verify package metadata uses root `index.html` and `dist` files only.
- Verify the published npm version is newer than the current latest.
