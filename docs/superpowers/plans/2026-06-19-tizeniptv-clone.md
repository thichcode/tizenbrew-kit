# TizenIPTV Clone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create and publish `@kv8n2oryk/tizeniptv@1.2.4` as a separate app-format clone of the working IPTV player `0.5.6` with a new playlist URL.

**Architecture:** Copy `packages/templates/iptv-player` to `packages/templates/tizeniptv` so the original package remains intact. Update only package identity, version, display metadata, and playlist URL in the clone, then build and publish from the clone directory.

**Tech Stack:** TypeScript source bundled by Vite through `tizenbrew-kit`; Vitest tests; npm publish with OTP.

---

### Task 1: Create TizenIPTV Clone

**Files:**
- Create: `packages/templates/tizeniptv/**`
- Test: `packages/templates/tizeniptv/test/package-format.test.ts`
- Test: `packages/templates/tizeniptv/test/playlist.test.ts`

- [ ] **Step 1: Copy the working IPTV package**

Copy `packages/templates/iptv-player` to `packages/templates/tizeniptv` without deleting or changing `packages/templates/iptv-player`.

- [ ] **Step 2: Update package identity**

Set `packages/templates/tizeniptv/package.json` to:

```json
{
  "name": "@kv8n2oryk/tizeniptv",
  "version": "1.2.4",
  "description": "Tizen IPTV player for TizenBrew with remote control",
  "type": "module",
  "packageType": "app",
  "appName": "TizenIPTV",
  "appPath": "index.html",
  "keys": [],
  "files": ["index.html", "dist"],
  "publishConfig": { "access": "public" },
  "scripts": {
    "dev": "tizenbrew-kit dev",
    "build": "tizenbrew-kit build",
    "package": "tizenbrew-kit package",
    "doctor": "tizenbrew-kit doctor"
  },
  "keywords": ["iptv", "tizen", "tizenbrew", "tv", "player", "m3u", "streaming"],
  "license": "MIT"
}
```

- [ ] **Step 3: Update TizenBrew config**

Set `packages/templates/tizeniptv/tizenbrew.config.ts` to use `name: 'tizeniptv'`, `displayName: 'TizenIPTV'`, and `version: '1.2.4'`, keeping app inject script `src/inject.ts` and no styles.

- [ ] **Step 4: Update runtime playlist URL**

In `packages/templates/tizeniptv/src/inject.ts`, set:

```js
var DEFAULT_PLAYLIST_URL = 'https://raw.githubusercontent.com/vuminhthanh12/vuminhthanh12/refs/heads/main/vmttv';
```

In `packages/templates/tizeniptv/src/playlist.ts`, set:

```ts
export const DEFAULT_PLAYLIST_URL =
  'https://raw.githubusercontent.com/vuminhthanh12/vuminhthanh12/refs/heads/main/vmttv';
```

- [ ] **Step 5: Update tests for clone identity and playlist**

In `packages/templates/tizeniptv/test/package-format.test.ts`, assert package name/version/appName and source markers.

In `packages/templates/tizeniptv/test/playlist.test.ts`, assert the new playlist URL.

- [ ] **Step 6: Verify tests**

Run: `pnpm exec vitest run "packages/templates/tizeniptv/test/package-format.test.ts" "packages/templates/tizeniptv/test/playlist.test.ts"`

Expected: PASS.

- [ ] **Step 7: Build and validate package**

Run from `packages/templates/tizeniptv`: `node "D:\pupeteer\tizenbrew-kit\packages\cli\dist\bin.js" build 2>&1`

Expected: build completes and writes `dist/inject.js`, `dist/manifest.json`, and `dist/module.json` with version `1.2.4`.

Run from `packages/templates/tizeniptv`: `node -e "var fs=require('fs'); var code=fs.readFileSync('dist/inject.js','utf8'); new Function(code); console.log('JS OK');" 2>&1`

Expected: `JS OK`.

Run from `packages/templates/tizeniptv`: `npm pack --dry-run 2>&1`

Expected: tarball contains `index.html`, `dist/inject.js`, and `package.json` for `@kv8n2oryk/tizeniptv@1.2.4`.

- [ ] **Step 8: Publish and verify registry**

Run from `packages/templates/tizeniptv`: `npm publish --access public 2>&1`.

If npm asks for OTP, retry with `npm publish --access public --otp=<code> 2>&1`.

After publish, run: `npm view @kv8n2oryk/tizeniptv version dist-tags.latest packageType appPath --json 2>&1`.

Expected: latest is `1.2.4`, packageType is `app`, appPath is `index.html`.
