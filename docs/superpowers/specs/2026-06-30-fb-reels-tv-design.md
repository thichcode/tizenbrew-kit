# Facebook Reels TV Module Design

## Goal

Create a new publishable TizenBrew app module named `@kv8n2oryk/fb-reels-tv` for watching Facebook Reels on Samsung TV Tizen 3 through TizenBrew.

The module should provide TV remote navigation, fullscreen-friendly viewing, and lightweight DOM/performance cleanup while staying within a safe client-side UX scope.

## Non-Goals

- Do not bypass Facebook login or authentication.
- Do not scrape private data.
- Do not use unofficial/private Facebook APIs.
- Do not claim ad blocking, DRM bypass, or content download behavior.
- Do not replace or break the existing `facebook-reels-lite` template.

## Selected Approach

Create a new package directory at `packages/templates/fb-reels-tv`.

The package will be published as `@kv8n2oryk/fb-reels-tv` and will use the app package format already used by `@kv8n2oryk/iptv-player`:

- `packageType: "app"`
- `appName: "Facebook Reels TV"`
- `appPath: "index.html"`
- `files: ["index.html", "dist"]`
- `publishConfig.access: "public"`

This avoids disrupting the existing private `facebook-reels-lite` template while producing a package that matches the requested npm name.

## Architecture

The module has two layers:

1. App package shell: an `index.html` entry that lets the npm package follow the TizenBrew app package format.
2. Inject helper: `src/inject.ts` runs on Facebook Reels and adapts the page for TV use.

`tizenbrew.config.ts` will target Facebook Reels with `targetUrl: "https://www.facebook.com/reel"` and bundle the inject script plus optional CSS.

## User Experience

The MVP supports:

- `ArrowUp` and `ArrowDown` for previous/next reel navigation.
- `Enter` for primary action fallback, such as clicking the focused control or toggling playback.
- `Space`, `MediaPlayPause`, `10190`, and `10252` for video play/pause.
- `Escape`, `Backspace`, and Samsung back key `10009` for back/fullscreen exit behavior.
- Fullscreen-friendly TV mode that hides heavy side panels, comments, complements, and nonessential overlays when possible.
- Reduced animation and transitions for lower memory/CPU pressure on Tizen 3.

The module should work as a helper over the real Facebook page. If the user is not logged in, it should leave the login page alone.

## DOM Strategy

The inject script will avoid Facebook private APIs and rely on generic browser behavior:

- Find visible `video` elements and control playback directly.
- Use scroll/page movement for reel navigation instead of fragile internal APIs.
- Hide heavy panels using conservative selectors such as complementary regions, comments, stories, and fixed sidebars.
- Reapply cleanup through a debounced `MutationObserver` because Facebook frequently rerenders DOM nodes.

If a selector or video cannot be found, the script should fail quietly and fall back to normal page behavior.

## Error Handling

- All optional browser APIs, including fullscreen and media playback promises, should be guarded.
- Failures should not throw uncaught errors into the Facebook page.
- Diagnostic logs should use the `[fb-reels-tv]` prefix.
- The module should avoid tight loops and should debounce DOM cleanup to reduce lag on Tizen 3.

## Testing

Add tests under `packages/templates/fb-reels-tv/test` to verify:

- The package is public and named `@kv8n2oryk/fb-reels-tv`.
- The package uses the TizenBrew app package format: `packageType`, `appName`, `appPath`, `files`, and public publish config.
- The inject source includes key support for Tizen/Samsung remote codes such as `10009`, `10190`, and `10252` plus `ArrowUp` and `ArrowDown`.

Run the repo test/build workflow after implementation.

## Publishing

After implementation and verification, publish from the new package directory with public npm access, assuming npm authentication has permission for `@kv8n2oryk/fb-reels-tv`.

If npm authentication fails, stop and report the exact error instead of retrying blindly.
