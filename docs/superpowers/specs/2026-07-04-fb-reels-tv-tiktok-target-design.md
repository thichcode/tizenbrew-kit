# fb-reels-tv TikTok Target Design

## Goal

Keep the existing npm package `@kv8n2oryk/fb-reels-tv`, but change the loaded website from Facebook Reels to TikTok so TizenBrew on Tizen 3 can test whether TikTok loads more reliably than Facebook.

## Selected Approach

Use TizenBrew website mod format, not app format:

- `packageType: "mods"`
- `websiteURL: "https://www.tiktok.com/"`
- `main: "dist/userScript.js"`
- `serviceFile: "dist/service.js"`

Do not build a custom player. Do not fetch feeds. Do not inject CSS. The first goal is page load reliability.

## Behavior

The user script stays minimal:

- Arrow down / channel up scrolls down.
- Arrow up / channel down scrolls up.
- Enter / space / media play-pause toggles the visible video when one exists.
- `f` toggles fullscreen where supported.

The script must not hide TikTok DOM, force black backgrounds, disable animations globally, or redirect after load.

## Package Updates

- Keep package name `@kv8n2oryk/fb-reels-tv`.
- Bump version to `0.1.14`.
- Update package description, README, config, tests, and npm metadata to indicate TikTok target while preserving package name for continuity.

## Verification

- Unit test confirms `packageType: "mods"`, TikTok `websiteURL`, `main`, and `serviceFile`.
- Unit test confirms remote key strings remain in `src/userScript.ts`.
- Build produces `dist/userScript.js` and `dist/service.js`.
- Publish `@kv8n2oryk/fb-reels-tv@0.1.14` to npm.

## Risk

If TikTok still shows a black screen, the likely remaining root cause is Tizen 3 WebView incompatibility with TikTok's current web app, not module injection.
