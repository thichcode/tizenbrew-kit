# Public ShortVideo TV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current external-site launcher with a Tizen 3 friendly public feed video player that never loads TikTok, Facebook, Instagram, or YouTube websites.

**Architecture:** Keep `@kv8n2oryk/fb-reels-tv` as a TizenBrew `packageType: "app"`. The app loads local `index.html`, runs `dist/inject.js`, fetches a public JSON feed from a compile-time `FEED_URL`, renders a local feed UI, and plays direct MP4 video URLs through one `<video>` element.

**Tech Stack:** TizenBrew app package metadata, static HTML/CSS, TypeScript compiled by `tizenbrew-kit`, Vitest package/behavior tests, browser-native `fetch` and `<video>`.

---

## File Structure

- Modify `packages/templates/fb-reels-tv/package.json`: keep app package format, version `0.1.18`, remove irrelevant YouTube keywords.
- Modify `packages/templates/fb-reels-tv/tizenbrew.config.ts`: keep `src/inject.ts` as the only script and version `0.1.18`.
- Replace `packages/templates/fb-reels-tv/index.html`: local shell only, no platform links, no iframe, includes feed/player/error containers and `./dist/inject.js`.
- Replace `packages/templates/fb-reels-tv/src/inject.ts`: feed fetching, validation, rendering, remote navigation, video playback, and errors.
- Modify `packages/templates/fb-reels-tv/test/package-format.test.ts`: test package format, HTML shell, absence of platform navigation, feed-player behavior markers.
- Modify `packages/templates/fb-reels-tv/README.md`: document curated feed format and Tizen 3 limitations.

## Scope Notes

- First implementation uses `var FEED_URL = '';` so the app shows `No feed configured` until a real public CORS-enabled feed URL is supplied.
- Do not publish a “useful” release with an empty `FEED_URL` unless the goal is to test the shell on TV first.
- Do not use `window.location.href`, `window.open`, iframe navigation, or external platform pages.
- Do not implement a backend resolver in this plan.

---

### Task 1: Update Tests For Curated Feed Player

**Files:**
- Modify: `packages/templates/fb-reels-tv/test/package-format.test.ts`

- [ ] **Step 1: Replace the package/behavior test with feed-player expectations**

Replace `packages/templates/fb-reels-tv/test/package-format.test.ts` with:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

var root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('Public ShortVideo TV package format', () => {
  it('publishes as a TizenBrew app package', () => {
    var pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

    expect(pkg.name).toBe('@kv8n2oryk/fb-reels-tv');
    expect(pkg.version).toBe('0.1.18');
    expect(pkg.appName).toBe('ShortVideo TV');
    expect(pkg.packageType).toBe('app');
    expect(pkg.appPath).toBe('index.html');
    expect(pkg.keys).toEqual([]);
    expect(pkg.files).toEqual(['index.html', 'dist']);
  });

  it('loads the generated inject bundle from index.html', () => {
    var html = readFileSync(resolve(root, 'index.html'), 'utf8');
    var scriptMatch = html.match(/<script src="\.\/(dist\/[^"]+)"><\/script>/);

    expect(scriptMatch?.[1]).toBe('dist/inject.js');
    expect(existsSync(resolve(root, scriptMatch![1]))).toBe(true);
  });

  it('does not navigate to platform websites', () => {
    var html = readFileSync(resolve(root, 'index.html'), 'utf8');
    var source = readFileSync(resolve(root, 'src/inject.ts'), 'utf8');

    expect(html).not.toContain('tiktok.com');
    expect(html).not.toContain('facebook.com');
    expect(html).not.toContain('instagram.com');
    expect(html).not.toContain('youtube.com');
    expect(source).not.toContain('window.location');
    expect(source).not.toContain('window.open');
    expect(source).not.toContain('iframe');
  });

  it('defines the local feed and player UI containers', () => {
    var html = readFileSync(resolve(root, 'index.html'), 'utf8');

    expect(html).toContain('id="status"');
    expect(html).toContain('id="feed"');
    expect(html).toContain('id="player"');
    expect(html).toContain('id="video"');
    expect(html).toContain('id="player-title"');
  });

  it('implements feed parsing, remote controls, and video playback', () => {
    var source = readFileSync(resolve(root, 'src/inject.ts'), 'utf8');

    expect(source).toContain('FEED_URL');
    expect(source).toContain('parseFeed');
    expect(source).toContain('renderFeed');
    expect(source).toContain('playItem');
    expect(source).toContain('togglePlayback');
    expect(source).toContain('video.src = item.videoUrl');
    expect(source).toContain('No feed configured');
    expect(source).toContain('This video cannot play on this TV');
  });

  it('handles expected TV remote keys', () => {
    var source = readFileSync(resolve(root, 'src/inject.ts'), 'utf8');

    expect(source).toContain('ArrowDown');
    expect(source).toContain('ArrowUp');
    expect(source).toContain('Enter');
    expect(source).toContain('MediaPlayPause');
    expect(source).toContain('Escape');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails for the current launcher/iframe code**

Run:

```bash
npm test
```

Expected: FAIL because current `index.html` still contains external platform URLs and current `src/inject.ts` does not implement `parseFeed`, `renderFeed`, `playItem`, or `togglePlayback`.

---

### Task 2: Replace The HTML Shell With Local Feed/Player UI

**Files:**
- Modify: `packages/templates/fb-reels-tv/index.html`

- [ ] **Step 1: Replace `index.html` with the local-only shell**

Replace `packages/templates/fb-reels-tv/index.html` with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>ShortVideo TV</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    body {
      background: #070707;
      color: #f4f4f4;
      font-family: 'Segoe UI', Arial, sans-serif;
      user-select: none;
    }
    #app {
      min-height: 100%;
      padding: 32px;
      display: flex;
      flex-direction: column;
      gap: 22px;
    }
    .topline {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 16px;
    }
    h1 { font-size: 2.1rem; letter-spacing: -0.03em; }
    #status { color: #8d8d8d; font-size: 0.95rem; }
    #feed {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      max-width: 900px;
    }
    .item {
      min-height: 112px;
      padding: 18px;
      border: 3px solid transparent;
      border-radius: 12px;
      background: #171717;
      outline: none;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 10px;
    }
    .item:focus, .item.focused {
      border-color: #e94560;
      background: #202020;
    }
    .item-title { font-size: 1.05rem; font-weight: 700; line-height: 1.3; }
    .item-meta { color: #8a8a8a; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.08em; }
    #empty { display: none; color: #777; font-size: 1rem; }
    #player {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 10;
      background: #000;
    }
    #player.active { display: block; }
    #video { width: 100%; height: 100%; background: #000; }
    #player-overlay {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 16px 22px;
      background: linear-gradient(transparent, rgba(0,0,0,0.82));
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-end;
    }
    #player-title { font-size: 1rem; font-weight: 700; }
    #player-help { color: #aaa; font-size: 0.78rem; white-space: nowrap; }
    #error {
      display: none;
      margin-top: 4px;
      color: #e94560;
      font-size: 0.95rem;
    }
  </style>
</head>
<body>
  <main id="app">
    <div class="topline">
      <h1>ShortVideo TV</h1>
      <div id="status">Loading...</div>
    </div>
    <div id="feed"></div>
    <div id="empty">No playable videos in feed.</div>
    <div id="error"></div>
  </main>

  <section id="player">
    <video id="video" playsinline></video>
    <div id="player-overlay">
      <div id="player-title"></div>
      <div id="player-help">OK/Play: pause &nbsp; Back: feed</div>
    </div>
  </section>

  <script>
    window.onerror = function (message, source, line) {
      var error = document.getElementById('error');
      if (error) {
        error.style.display = 'block';
        error.textContent = 'Startup error: ' + message + ' (line ' + line + ')';
      }
    };
  </script>
  <script src="./dist/inject.js"></script>
</body>
</html>
```

- [ ] **Step 2: Run the test and verify the HTML-related failures are gone**

Run:

```bash
npm test
```

Expected: tests still FAIL because `src/inject.ts` does not yet implement feed parsing/player behavior, but failures related to platform URLs and UI containers should be gone.

---

### Task 3: Implement Feed Parsing And Local Playback

**Files:**
- Modify: `packages/templates/fb-reels-tv/src/inject.ts`

- [ ] **Step 1: Replace `src/inject.ts` with the feed player implementation**

Replace `packages/templates/fb-reels-tv/src/inject.ts` with:

```ts
(function () {
  var FEED_URL = '';
  var items = [];
  var selectedIndex = 0;
  var isPlayerOpen = false;

  var statusEl = document.getElementById('status');
  var feedEl = document.getElementById('feed');
  var emptyEl = document.getElementById('empty');
  var errorEl = document.getElementById('error');
  var playerEl = document.getElementById('player');
  var video = document.getElementById('video');
  var playerTitleEl = document.getElementById('player-title');

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message;
  }

  function showError(message) {
    if (errorEl) {
      errorEl.style.display = 'block';
      errorEl.textContent = message;
    }
  }

  function clearError() {
    if (errorEl) {
      errorEl.style.display = 'none';
      errorEl.textContent = '';
    }
  }

  function isHttpUrl(value) {
    return typeof value === 'string' && /^https?:\/\//.test(value);
  }

  function parseFeed(data) {
    if (!data || !Array.isArray(data.items)) return [];

    return data.items
      .filter(function (item) {
        return (
          item &&
          typeof item.id === 'string' &&
          typeof item.title === 'string' &&
          typeof item.source === 'string' &&
          isHttpUrl(item.videoUrl)
        );
      })
      .map(function (item) {
        return {
          id: item.id,
          title: item.title,
          source: item.source,
          sourceUrl: isHttpUrl(item.sourceUrl) ? item.sourceUrl : '',
          videoUrl: item.videoUrl,
          thumbnailUrl: isHttpUrl(item.thumbnailUrl) ? item.thumbnailUrl : '',
          duration: typeof item.duration === 'number' ? item.duration : 0,
        };
      });
  }

  function focusSelected() {
    if (!feedEl) return;
    var nodes = feedEl.querySelectorAll('.item');
    if (nodes[selectedIndex]) nodes[selectedIndex].focus();
  }

  function renderFeed() {
    if (!feedEl) return;
    feedEl.innerHTML = '';

    if (emptyEl) emptyEl.style.display = items.length ? 'none' : 'block';
    if (!items.length) return;

    items.forEach(function (item, index) {
      var node = document.createElement('div');
      node.className = 'item';
      node.tabIndex = 0;
      node.setAttribute('data-index', String(index));

      var title = document.createElement('div');
      title.className = 'item-title';
      title.textContent = item.title;

      var meta = document.createElement('div');
      meta.className = 'item-meta';
      meta.textContent = item.source;

      node.appendChild(title);
      node.appendChild(meta);
      node.addEventListener('click', function () {
        selectedIndex = index;
        playItem(item);
      });

      feedEl.appendChild(node);
    });

    selectedIndex = 0;
    setTimeout(focusSelected, 60);
  }

  function closePlayer() {
    isPlayerOpen = false;
    if (playerEl) playerEl.classList.remove('active');
    if (video) {
      try { video.pause(); } catch (_) {}
      video.removeAttribute('src');
      try { video.load(); } catch (_) {}
    }
    setTimeout(focusSelected, 60);
  }

  function playItem(item) {
    clearError();
    isPlayerOpen = true;
    if (playerTitleEl) playerTitleEl.textContent = item.title;
    if (playerEl) playerEl.classList.add('active');

    if (!video) return;
    video.src = item.videoUrl;
    video.autoplay = true;
    video.controls = false;

    var result = video.play();
    if (result && result.catch) {
      result.catch(function () {
        showError('This video cannot play on this TV');
      });
    }
  }

  function togglePlayback() {
    if (!video || !isPlayerOpen) return;

    if (video.paused) {
      var result = video.play();
      if (result && result.catch) result.catch(function () {});
    } else {
      video.pause();
    }
  }

  function moveSelection(delta) {
    if (!items.length) return;
    selectedIndex += delta;
    if (selectedIndex < 0) selectedIndex = items.length - 1;
    if (selectedIndex >= items.length) selectedIndex = 0;
    focusSelected();
  }

  function selectedItem() {
    return items[selectedIndex] || null;
  }

  var KEY_MAP = {
    13: 'Enter',
    27: 'Escape',
    32: ' ',
    37: 'ArrowLeft',
    38: 'ArrowUp',
    39: 'ArrowRight',
    40: 'ArrowDown',
    10009: 'Escape',
    10190: 'MediaPlayPause',
    10252: 'MediaPlayPause',
  };

  function keyFromEvent(event) {
    if (event.key && event.key !== 'Unidentified') return event.key;
    return KEY_MAP[event.keyCode] || KEY_MAP[event.which] || '';
  }

  function onKeyDown(event) {
    var key = keyFromEvent(event);

    if (isPlayerOpen) {
      if (key === 'Escape') {
        event.preventDefault();
        closePlayer();
        return;
      }

      if (key === 'Enter' || key === ' ' || key === 'MediaPlayPause') {
        event.preventDefault();
        togglePlayback();
      }

      return;
    }

    if (key === 'ArrowDown' || key === 'ArrowRight') {
      event.preventDefault();
      moveSelection(1);
      return;
    }

    if (key === 'ArrowUp' || key === 'ArrowLeft') {
      event.preventDefault();
      moveSelection(-1);
      return;
    }

    if (key === 'Enter' || key === ' ' || key === 'MediaPlayPause') {
      event.preventDefault();
      var item = selectedItem();
      if (item) playItem(item);
    }
  }

  function loadFeed() {
    clearError();

    if (!isHttpUrl(FEED_URL)) {
      setStatus('No feed configured');
      if (emptyEl) {
        emptyEl.style.display = 'block';
        emptyEl.textContent = 'No feed configured.';
      }
      return;
    }

    setStatus('Loading feed...');

    fetch(FEED_URL, { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        items = parseFeed(data);
        setStatus(items.length ? 'Ready' : 'No playable videos');
        renderFeed();
      })
      .catch(function () {
        setStatus('Feed error');
        showError('Could not load feed. Press OK to retry.');
      });
  }

  if (video) {
    video.addEventListener('error', function () {
      showError('This video cannot play on this TV');
    });
    video.addEventListener('ended', function () {
      moveSelection(1);
      var item = selectedItem();
      if (item) playItem(item);
    });
  }

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('load', loadFeed);

  console.info('[shortvideo-tv] public feed player loaded');
})();
```

- [ ] **Step 2: Run tests and verify all behavior markers pass**

Run:

```bash
npm test
```

Expected: PASS, 6 tests.

---

### Task 4: Update Metadata And README

**Files:**
- Modify: `packages/templates/fb-reels-tv/package.json`
- Modify: `packages/templates/fb-reels-tv/tizenbrew.config.ts`
- Modify: `packages/templates/fb-reels-tv/README.md`

- [ ] **Step 1: Update `package.json` keywords and keep app format**

Ensure `packages/templates/fb-reels-tv/package.json` contains:

```json
{
  "name": "@kv8n2oryk/fb-reels-tv",
  "version": "0.1.18",
  "description": "Public short-video feed player for TizenBrew on Samsung Tizen 3",
  "type": "module",
  "packageType": "app",
  "appName": "ShortVideo TV",
  "appPath": "index.html",
  "keys": [],
  "files": [
    "index.html",
    "dist"
  ],
  "publishConfig": {
    "access": "public"
  },
  "scripts": {
    "dev": "tizenbrew-kit dev",
    "build": "tizenbrew-kit build",
    "package": "tizenbrew-kit package",
    "doctor": "tizenbrew-kit doctor",
    "test": "vitest run test/package-format.test.ts"
  },
  "keywords": [
    "short-video",
    "public-feed",
    "video-player",
    "tizen",
    "tizenbrew",
    "samsung-tv",
    "tv",
    "remote"
  ],
  "license": "MIT"
}
```

- [ ] **Step 2: Update `tizenbrew.config.ts` description**

Ensure `packages/templates/fb-reels-tv/tizenbrew.config.ts` contains:

```ts
export default {
  name: 'fb-reels-tv',
  displayName: 'ShortVideo TV',
  version: '0.1.18',
  description: 'Public short-video feed player for TizenBrew on Samsung Tizen 3',
  targetUrl: 'https://localhost',
  inject: {
    scripts: ['src/inject.ts'],
    styles: [],
  },
  tvKeys: {
    arrows: true,
    enter: true,
    back: true,
    playPause: true,
  },
};
```

- [ ] **Step 3: Replace README with curated feed documentation**

Replace `packages/templates/fb-reels-tv/README.md` with:

```md
# ShortVideo TV

ShortVideo TV is a lightweight TizenBrew app for Samsung Tizen 3 TVs. It does not load TikTok, Facebook, Instagram, or YouTube websites. Instead, it plays public no-login videos from a curated JSON feed when direct playable video URLs are available.

## Why This Exists

Modern TikTok, Facebook Reels, and Instagram Reels pages are too heavy for many Tizen 3 browser engines. Loading those websites can show a black screen or exit TizenBrew. This app uses a local TV UI and the browser's native video player instead.

## Feed Format

The app expects a public HTTPS JSON feed with CORS enabled:

```json
{
  "version": 1,
  "updatedAt": "2026-07-11T00:00:00Z",
  "items": [
    {
      "id": "example-1",
      "title": "Example video",
      "source": "tiktok",
      "sourceUrl": "https://www.tiktok.com/@public/video/123",
      "videoUrl": "https://example.com/video.mp4",
      "thumbnailUrl": "https://example.com/thumb.jpg",
      "duration": 30
    }
  ]
}
```

Required item fields: `id`, `title`, `source`, `videoUrl`.

Recommended video format: MP4 with H.264 video and AAC audio.

## Remote Controls

- Up/Down: select video
- OK/Enter: play selected video
- Play/Pause: toggle playback
- Back/Return: return to feed

## Security and Legal Scope

- No login bypass
- No private data scraping
- No platform website embedding
- No DRM bypass
- No downloading feature

## Build

```bash
node D:\pupeteer\tizenbrew-kit\packages\cli\dist\bin.js build
```

## Test

```bash
npm test
```
```

- [ ] **Step 4: Run tests after metadata/docs update**

Run:

```bash
npm test
```

Expected: PASS, 6 tests.

---

### Task 5: Build And Package Verification

**Files:**
- Generated: `packages/templates/fb-reels-tv/dist/inject.js`
- Generated: `packages/templates/fb-reels-tv/dist/manifest.json`
- Generated: `packages/templates/fb-reels-tv/dist/module.json`

- [ ] **Step 1: Build the package with the local CLI**

Run from `D:\pupeteer\tizenbrew-kit\packages\templates\fb-reels-tv`:

```bash
node D:\pupeteer\tizenbrew-kit\packages\cli\dist\bin.js build
```

Expected: output includes `dist/inject.js` and `[tizenbrew-kit] Build completed for fb-reels-tv`.

- [ ] **Step 2: Run tests after build**

Run:

```bash
npm test
```

Expected: PASS, 6 tests.

- [ ] **Step 3: Dry-run npm package**

Run:

```bash
npm pack --dry-run
```

Expected tarball contents include exactly the useful runtime files:

```text
README.md
dist/inject.js
dist/inject.js.map
dist/manifest.json
dist/module.json
dist/README.md
index.html
package.json
```

- [ ] **Step 4: Verify generated manifest**

Read `packages/templates/fb-reels-tv/dist/manifest.json` and confirm:

```json
{
  "schemaVersion": 1,
  "name": "fb-reels-tv",
  "displayName": "ShortVideo TV",
  "version": "0.1.18",
  "description": "Public short-video feed player for TizenBrew on Samsung Tizen 3",
  "targetUrl": "https://localhost",
  "assets": {
    "scripts": ["inject.js"],
    "styles": []
  }
}
```

The real manifest also includes `capabilities`; that is expected.

---

### Task 6: Optional Publish

**Files:**
- No source changes.

- [ ] **Step 1: Confirm npm auth**

Run:

```bash
npm whoami
```

Expected:

```text
kv8n2oryk
```

- [ ] **Step 2: Publish with fresh OTP only after user provides it**

Run from `D:\pupeteer\tizenbrew-kit\packages\templates\fb-reels-tv`:

```bash
npm publish --access public --otp=<fresh-otp>
```

Expected: npm outputs `+ @kv8n2oryk/fb-reels-tv@0.1.18`.

- [ ] **Step 3: Verify registry metadata**

Run:

```bash
npm view @kv8n2oryk/fb-reels-tv version packageType appName appPath
```

Expected:

```text
version = '0.1.18'
packageType = 'app'
appName = 'ShortVideo TV'
appPath = 'index.html'
```

---

## Self-Review

- Spec coverage: The plan implements local app shell, `FEED_URL` handling, feed parsing, invalid-item skipping, no platform navigation, native `<video>` playback, remote keys, error states, tests, build verification, and optional publish.
- Placeholder scan: No `TBD`, `TODO`, or unspecified implementation steps remain. The only configurable value is explicitly defined as `var FEED_URL = '';` with documented behavior.
- Type consistency: Feed item property names are consistent across spec, tests, implementation, and README: `id`, `title`, `source`, `sourceUrl`, `videoUrl`, `thumbnailUrl`, `duration`.
