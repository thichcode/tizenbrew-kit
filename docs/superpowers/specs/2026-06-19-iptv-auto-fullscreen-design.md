# IPTV Auto Fullscreen Design

## Goal

After the viewer starts watching a channel, the IPTV app should automatically switch to a fullscreen viewing layout after 10 seconds without input.

## Behavior

- Use CSS layout fullscreen, not the browser fullscreen API.
- After a channel starts playing, start a 10 second inactivity timer.
- When the timer fires, add a fullscreen mode class to the app shell.
- Fullscreen mode hides the header, channel list, and footer, and makes the video fill the app viewport.
- Any key press, click, or mouse movement exits fullscreen mode and restarts the inactivity timer.
- Remote controls continue to work while fullscreen mode is active.
- The timer should not auto-hide the UI before a channel has been selected.

## Implementation Shape

The existing legacy bundle in `packages/templates/iptv-player/src/inject.ts` owns the UI, playback, and remote handling. Add the feature there with small helper functions:

- Track whether playback has started.
- Track the inactivity timer handle.
- Add `enterFullscreenMode`, `exitFullscreenMode`, and `resetFullscreenTimer` helpers.
- Call `resetFullscreenTimer` after selecting a channel and after user input.
- Extend the injected CSS with `#app.fullscreen-mode` rules.

## Verification

- Unit-style package tests should continue to pass.
- Build should produce `dist/inject.js` without syntax errors.
- The app package metadata should remain app-format with root `index.html`.
