# IPTV Auto Fullscreen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 10 second inactivity auto-fullscreen viewing mode to the IPTV player.

**Architecture:** Keep the feature inside the existing legacy app bundle, `packages/templates/iptv-player/src/inject.ts`, because that file owns UI construction, playback, and remote handling for the published app. Use a CSS class on `#app` to hide chrome and expand the video, plus a small timer reset on user input.

**Tech Stack:** TypeScript source bundled by Vite through `tizenbrew-kit`; Vitest for package/template checks.

---

### Task 1: Auto Fullscreen Timer

**Files:**
- Modify: `packages/templates/iptv-player/src/inject.ts`
- Modify: `packages/templates/iptv-player/test/package-format.test.ts`

- [ ] **Step 1: Add a package test marker for auto fullscreen source**

Add assertions to `packages/templates/iptv-player/test/package-format.test.ts` that read `src/inject.ts` and require these source markers:

```ts
const injectSource = readFileSync(resolve(root, 'src/inject.ts'), 'utf8');
expect(injectSource).toContain('AUTO_FULLSCREEN_DELAY = 10000');
expect(injectSource).toContain('fullscreen-mode');
expect(injectSource).toContain('resetFullscreenTimer');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run "packages/templates/iptv-player/test/package-format.test.ts"`

Expected: FAIL because `AUTO_FULLSCREEN_DELAY`, `fullscreen-mode`, and `resetFullscreenTimer` are not implemented yet.

- [ ] **Step 3: Add minimal implementation**

In `packages/templates/iptv-player/src/inject.ts`:

```js
var AUTO_FULLSCREEN_DELAY = 10000;
var fullscreenTimer = null;
var hasStartedPlayback = false;

function enterFullscreenMode() {
  var app = document.getElementById('app');
  if (app) app.className = 'fullscreen-mode';
}

function exitFullscreenMode() {
  var app = document.getElementById('app');
  if (app) app.className = '';
}

function resetFullscreenTimer() {
  if (fullscreenTimer) clearTimeout(fullscreenTimer);
  exitFullscreenMode();
  if (!hasStartedPlayback) return;
  fullscreenTimer = setTimeout(enterFullscreenMode, AUTO_FULLSCREEN_DELAY);
}
```

Update CSS injected by `injectStyle()` with rules equivalent to:

```css
#app.fullscreen-mode header,
#app.fullscreen-mode #list,
#app.fullscreen-mode #bar { display: none; }
#app.fullscreen-mode #main { display: block; height: 100vh; }
#app.fullscreen-mode #player-wrap { width: 100vw; height: 100vh; }
#app.fullscreen-mode #player { width: 100vw; height: 100vh; max-height: none; }
```

In `playChannel(index)`, set `hasStartedPlayback = true` and call `resetFullscreenTimer()` after starting playback.

In `handleKey(event)`, call `resetFullscreenTimer()` once at the top so remote input shows UI and restarts the timer.

In `start()`, add `click` and `mousemove` listeners that call `resetFullscreenTimer`.

- [ ] **Step 4: Run focused tests**

Run: `pnpm exec vitest run "packages/templates/iptv-player/test/package-format.test.ts" "packages/templates/iptv-player/test/playlist.test.ts"`

Expected: PASS.

- [ ] **Step 5: Build and inspect package**

Run: `node "D:\pupeteer\tizenbrew-kit\packages\cli\dist\bin.js" build 2>&1`

Expected: build completes and writes `dist/inject.js`.

Run: `node -e "var fs=require('fs'); var code=fs.readFileSync('dist/inject.js','utf8'); new Function(code); console.log('JS OK');" 2>&1`

Expected: `JS OK`.

Run: `npm pack --dry-run 2>&1`

Expected: tarball contains `index.html`, `dist/inject.js`, and `package.json`.

- [ ] **Step 6: Publish if requested**

Only publish after bumping to an unpublished version and after npm OTP is available.
