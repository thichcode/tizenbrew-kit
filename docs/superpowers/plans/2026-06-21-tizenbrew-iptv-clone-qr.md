# TizenBrew IPTV Clone QR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `tizenbrew-iptv` as a close clone of `@kv8n2oryk/iptv-player@0.5.7`, changing only the hardcoded M3U playlist source into a QR setup flow.

**Architecture:** Use the original root `index.html` + `dist/inject.js` package shape. Preserve the original injected IPTV player UI, parsing, remote controls, and fullscreen behavior, while replacing the constant hardcoded playlist URL with localStorage-backed QR setup and Cloudflare Worker polling.

**Tech Stack:** npm package metadata, TizenBrew app package format, ES5 browser JavaScript, XMLHttpRequest, localStorage, Cloudflare Worker setup API, Vitest static package tests.

---

## File Structure

- Modify `packages/templates/tizenbrew-iptv/package.json`: match original package shape with `appPath: "index.html"`, `files: ["index.html", "dist"]`, and bumped version.
- Replace `packages/templates/tizenbrew-iptv/index.html`: root loader matching original package.
- Create `packages/templates/tizenbrew-iptv/dist/inject.js`: original `@kv8n2oryk/iptv-player@0.5.7` injected player code plus QR setup replacement.
- Create `packages/templates/tizenbrew-iptv/dist/manifest.json`: original manifest shape adapted to `tizenbrew-iptv` identity.
- Create `packages/templates/tizenbrew-iptv/dist/README.md`: short runtime note for QR setup.
- Modify `packages/templates/tizenbrew-iptv/test/package.test.ts`: assert package shape and QR replacement behavior.
- Remove from published files by metadata, not necessarily delete: `app/`, `service.js`. They must not appear in `npm pack --dry-run`.

---

### Task 1: Update Static Package Tests

**Files:**
- Modify: `packages/templates/tizenbrew-iptv/test/package.test.ts`

- [ ] **Step 1: Replace test file with clone-focused assertions**

Use this complete file content:

```ts
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('tizenbrew-iptv package', () => {
  it('publishes as a root index.html + dist app like @kv8n2oryk/iptv-player', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

    expect(pkg.name).toBe('tizenbrew-iptv');
    expect(pkg.packageType).toBe('app');
    expect(pkg.appName).toBe('IPTV Player');
    expect(pkg.appPath).toBe('index.html');
    expect(pkg.files).toEqual(['index.html', 'dist']);
    expect(pkg.serviceFile).toBeUndefined();
    expect(pkg.evaluateScriptOnDocumentStart).toBeUndefined();
  });

  it('loads the original-style injected player from root index.html', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');

    expect(html).toContain('Loading IPTV Player');
    expect(html).toContain('<script src="./dist/inject.js"></script>');
    expect(html).not.toContain('./app.js');
  });

  it('keeps original player behavior while replacing hardcoded playlist with QR setup', () => {
    const inject = readFileSync(resolve(root, 'dist/inject.js'), 'utf8');

    expect(inject).toContain('IPTV Player');
    expect(inject).toContain('fullscreen-mode');
    expect(inject).toContain('ChannelUp');
    expect(inject).toContain('VolumeUp');
    expect(inject).toContain('group-title="([^\\"]*)"');
    expect(inject).toContain('tizenbrew-iptv-setup.dvt-kisu.workers.dev');
    expect(inject).toContain('/setup?code=');
    expect(inject).toContain('/api/config?code=');
    expect(inject).toContain('localStorage');
    expect(inject).toContain('XMLHttpRequest');
    expect(inject).not.toMatch(/raw\.githubusercontent\.com|filtered_playlist|api\.qrserver\.com/);
    expect(inject).not.toMatch(/\bfetch\s*\(|async\s+function|=>|\bconst\b|\blet\b|\?\./);
  });
});
```

- [ ] **Step 2: Run test to verify it fails before implementation**

Run:

```bash
pnpm exec vitest run packages/templates/tizenbrew-iptv/test/package.test.ts
```

Expected: FAIL because current `package.json` uses `app/index.html`, current root `index.html` does not exist, and current QR app is not a clone of the original injected player.

---

### Task 2: Restore Original Package Shape

**Files:**
- Modify: `packages/templates/tizenbrew-iptv/package.json`
- Create: `packages/templates/tizenbrew-iptv/index.html`
- Create: `packages/templates/tizenbrew-iptv/dist/manifest.json`
- Create: `packages/templates/tizenbrew-iptv/dist/README.md`

- [ ] **Step 1: Update package metadata**

Edit `package.json` so it has these relevant fields:

```json
{
  "name": "tizenbrew-iptv",
  "version": "0.1.6",
  "description": "IPTV Player for TizenBrew with QR playlist setup",
  "license": "MIT",
  "private": false,
  "packageType": "app",
  "appName": "IPTV Player",
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
    "pack:check": "npm pack --dry-run",
    "publish:public": "npm publish --access public"
  },
  "keywords": [
    "iptv",
    "tizen",
    "tizenbrew",
    "tv",
    "player",
    "m3u",
    "streaming"
  ]
}
```

- [ ] **Step 2: Create root loader HTML**

Create `index.html` with:

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IPTV Player</title>
</head>
<body>
  <div id="status-text">Loading IPTV Player...</div>
  <script>
    window.onerror = function (message, source, line) {
      var status = document.getElementById('status-text');
      if (status) status.textContent = 'Startup error: ' + message + ' (line ' + line + ')';
    };
  </script>
  <script src="./dist/inject.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create manifest**

Create `dist/manifest.json` with:

```json
{
  "schemaVersion": 1,
  "name": "tizenbrew-iptv",
  "displayName": "IPTV Player",
  "version": "0.1.6",
  "description": "IPTV Player for TizenBrew with QR playlist setup",
  "targetUrl": "https://localhost",
  "assets": {
    "scripts": [
      "inject.js"
    ],
    "styles": []
  },
  "capabilities": {
    "tvKeys": {
      "arrows": true,
      "enter": true,
      "back": true,
      "playPause": true
    },
    "performance": {
      "removeAnimations": false,
      "lazyMedia": false,
      "hideComments": false,
      "memorySaver": false
    }
  }
}
```

- [ ] **Step 4: Create dist README**

Create `dist/README.md` with:

```md
# IPTV Player

TizenBrew IPTV player based on `@kv8n2oryk/iptv-player`, with playlist URL setup through QR code instead of a bundled M3U URL.
```

- [ ] **Step 5: Run package shape test**

Run:

```bash
pnpm exec vitest run packages/templates/tizenbrew-iptv/test/package.test.ts
```

Expected: still FAIL because `dist/inject.js` has not been replaced yet.

---

### Task 3: Replace `dist/inject.js` With Original Player Plus QR Setup

**Files:**
- Create/Modify: `packages/templates/tizenbrew-iptv/dist/inject.js`

- [ ] **Step 1: Start from the original injected player**

Use `@kv8n2oryk/iptv-player@0.5.7` `dist/inject.js` as the base. Preserve its functions and behavior: style injection, DOM creation, `K()` playlist loading, `z()` M3U parsing, `N()` fallback grouping, `R()` grouping, `_()` list rendering, `y()` channel playback, `L()` channel movement, `X()` play/pause, `P()` seek, `A()` volume, `Y()` numeric entry, `G()` key handling, `J()` key registration, and `O()` startup.

- [ ] **Step 2: Replace hardcoded playlist variable**

Replace original:

```js
var I = "https://raw.githubusercontent.com/thichcode/thichcode/refs/heads/main/filtered_playlist.m3u";
```

With ES5-compatible setup variables:

```js
var I = "";
var W = "https://tizenbrew-iptv-setup.dvt-kisu.workers.dev";
var LS = "tizenbrewIptv:playlistUrl";
var setupCode = "";
var setupTimer = null;
```

- [ ] **Step 3: Add QR setup helper functions before original `K()`**

Add ES5 helpers that:

```js
function makeSetupCode() {
  var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var code = "";
  for (var idx = 0; idx < 6; idx++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function setupUrl(code) {
  return W + "/setup?code=" + encodeURIComponent(code);
}

function xhrGetText(url, done) {
  var req = new XMLHttpRequest();
  req.open("GET", url, true);
  req.onreadystatechange = function() {
    if (req.readyState !== 4) return;
    done(null, req.status, req.responseText);
  };
  req.onerror = function() { done(new Error("Network failed"), 0, ""); };
  req.send();
}

function savePlaylistUrl(url) {
  I = url;
  try { localStorage.setItem(LS, url); } catch (err) {}
}

function clearSetupTimer() {
  if (setupTimer) clearInterval(setupTimer);
  setupTimer = null;
}
```

- [ ] **Step 4: Add local QR renderer**

Add a local QR renderer in `dist/inject.js`. It may be the same ES5-compatible `QRCode` implementation previously used in `app/qrcode-lib.js`, embedded before setup rendering code. It must not call `api.qrserver.com` or any external QR image API.

- [ ] **Step 5: Add setup screen rendering**

Add a `showSetup()` function that replaces `document.body.innerHTML` with the original app shell plus a setup card, or injects setup content into the original shell created by `U()`. It must show:

```html
<h1>IPTV Player</h1>
<div id="qr"></div>
<div id="setup-url"></div>
<div id="setup-code"></div>
<div id="st">Scan QR to set playlist URL</div>
```

Then call:

```js
new QRCode(document.getElementById("qr"), {
  text: setupUrl(setupCode),
  width: 220,
  height: 220
});
```

- [ ] **Step 6: Add polling flow**

Add `startSetupPolling()`:

```js
function startSetupPolling() {
  clearSetupTimer();
  setupTimer = setInterval(function() {
    xhrGetText(W + "/api/config?code=" + encodeURIComponent(setupCode), function(err, status, text) {
      if (err) { d("Setup poll failed: " + (err.message || "unknown")); return; }
      if (status === 404) return;
      if (status < 200 || status >= 300) { d("Setup poll failed: HTTP " + status); return; }
      try {
        var data = JSON.parse(text);
        if (data && typeof data.playlistUrl === "string" && data.playlistUrl) {
          clearSetupTimer();
          savePlaylistUrl(data.playlistUrl);
          U();
          K();
        }
      } catch (parseErr) {
        d("Setup poll failed: bad response");
      }
    });
  }, 3000);
}
```

- [ ] **Step 7: Modify original playlist load function `K()`**

Keep original `K()` behavior, but read from `I` instead of hardcoded URL. Its first lines must guard empty URL:

```js
function K() {
  if (!I) { showSetup(); return; }
  d("Fetching playlist...");
  var e = new XMLHttpRequest();
  e.open("GET", I, true);
```

Keep the rest of the original success/error handling unchanged.

- [ ] **Step 8: Modify startup function `O()`**

Change startup so it loads saved playlist if present, otherwise shows QR setup:

```js
function O() {
  U();
  J();
  document.addEventListener("keydown", G);
  document.addEventListener("click", g);
  document.addEventListener("mousemove", g);
  try { I = localStorage.getItem(LS) || ""; } catch (err) { I = ""; }
  if (I) K(); else showSetup();
}
```

- [ ] **Step 9: Add reset shortcut without breaking original controls**

In original key map `B`, add yellow remote key:

```js
405: "ColorF2Yellow"
```

In `G(e)`, add a case:

```js
case "ColorF2Yellow":
  e.preventDefault();
  try { localStorage.removeItem(LS); } catch (r) {}
  I = "";
  showSetup();
  break;
```

Register key in `J()` by adding `"ColorF2Yellow"` to the key array.

- [ ] **Step 10: Run static test**

Run:

```bash
pnpm exec vitest run packages/templates/tizenbrew-iptv/test/package.test.ts
```

Expected: PASS.

---

### Task 4: Verify Package Contents and Compatibility

**Files:**
- Read: `packages/templates/tizenbrew-iptv/package.json`
- Read: `packages/templates/tizenbrew-iptv/dist/inject.js`

- [ ] **Step 1: Check JavaScript syntax**

Run:

```bash
node -e "const fs=require('fs'); new Function(fs.readFileSync('dist/inject.js','utf8')); console.log('inject.js OK')"
```

From `packages/templates/tizenbrew-iptv`.

Expected: `inject.js OK`.

- [ ] **Step 2: Check for forbidden modern JavaScript and hardcoded playlist**

Run:

```bash
node -e "const fs=require('fs'); const s=fs.readFileSync('dist/inject.js','utf8'); const bad=[/raw\\.githubusercontent\\.com/,/filtered_playlist/,/api\\.qrserver\\.com/,/\\bfetch\\s*\\(/,/async\\s+function/,/=>/,/\\bconst\\b/,/\\blet\\b/,/\\?\\./].filter(r=>r.test(s)); if (bad.length) { console.error('bad patterns: '+bad.map(String).join(', ')); process.exit(1); } console.log('compat OK')"
```

From `packages/templates/tizenbrew-iptv`.

Expected: `compat OK`.

- [ ] **Step 3: Check tarball contents**

Run:

```bash
npm pack --dry-run
```

Expected tarball includes only package files like:

```text
README.md
dist/README.md
dist/inject.js
dist/manifest.json
index.html
package.json
```

Expected tarball must not include:

```text
app/app.js
app/index.html
app/qrcode-lib.js
service.js
```

---

### Task 5: Publish New Version

**Files:**
- Modify: `packages/templates/tizenbrew-iptv/package.json`

- [ ] **Step 1: Confirm current npm latest**

Run:

```bash
npm view tizenbrew-iptv version
```

Expected before publish: current latest is `0.1.5` unless another version has already been published.

- [ ] **Step 2: Ensure package version is newer than npm latest**

If latest is `0.1.5`, keep `"version": "0.1.6"`. If latest is already `0.1.6`, bump to `0.1.7` before publish.

- [ ] **Step 3: Check npm auth**

Run:

```bash
npm whoami
```

Expected: `kv8n2oryk`. If it returns `E401`, ask user to run `npm login` before publishing.

- [ ] **Step 4: Publish with OTP**

Run from `packages/templates/tizenbrew-iptv`:

```bash
npm publish --access public --otp=<current-otp>
```

Expected: `+ tizenbrew-iptv@0.1.6` or the bumped version.

- [ ] **Step 5: Verify published package**

Run:

```bash
npm view tizenbrew-iptv version
```

Expected: returns the version just published.

---

## Self-Review

- Spec coverage: package shape, original player preservation, QR setup, Tizen 3 ES5 compatibility, error handling, and publish verification are covered by Tasks 1-5.
- Placeholder scan: no TBD/TODO/later placeholders remain.
- Type/name consistency: setup variables `W`, `LS`, `setupCode`, `setupTimer`, helper functions, and package paths are consistent across tasks.
