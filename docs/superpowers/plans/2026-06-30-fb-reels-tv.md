# Facebook Reels TV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a new TizenBrew-compatible Samsung TV Tizen 3 module package named `@kv8n2oryk/fb-reels-tv`.

**Architecture:** Add a new isolated package under `packages/templates/fb-reels-tv` using the same app package shape as `@kv8n2oryk/iptv-player`. The app shell is a lightweight `index.html`; the main behavior is a client-side inject helper that adapts Facebook Reels for TV remote navigation, fullscreen-style viewing, and low-overhead DOM cleanup.

**Tech Stack:** TypeScript, TizenBrew Kit CLI, Vite build through `tizenbrew-kit build`, Vitest for package/source checks, npm public package publishing.

---

## File Structure

- Create `packages/templates/fb-reels-tv/package.json`: public npm package metadata and TizenBrew app package fields.
- Create `packages/templates/fb-reels-tv/tizenbrew.config.ts`: TizenBrew config targeting Facebook Reels and bundling inject assets.
- Create `packages/templates/fb-reels-tv/index.html`: lightweight app shell for TizenBrew package format.
- Create `packages/templates/fb-reels-tv/README.md`: usage, safety scope, build/package/publish notes.
- Create `packages/templates/fb-reels-tv/src/inject.ts`: TV remote key mapping, visible video controls, scroll navigation, DOM cleanup, MutationObserver debounce.
- Create `packages/templates/fb-reels-tv/src/style.css`: static CSS shipped by TizenBrew Kit for TV-mode cleanup.
- Create `packages/templates/fb-reels-tv/test/package-format.test.ts`: verifies package name, public publish config, app package fields, and key-code support.
- Modify `packages/cli/src/types.ts`: include `fb-reels-tv` as a valid template name.
- Modify `packages/cli/src/commands.ts`: include `fb-reels-tv` in `SUPPORTED_TEMPLATES`.
- Modify `packages/cli/src/bin.ts`: include `fb-reels-tv` in create command help text.
- Modify `README.md`: document `fb-reels-tv` in template list and CLI command help.

## Task 1: Add Failing Package Tests

**Files:**
- Create: `packages/templates/fb-reels-tv/test/package-format.test.ts`

- [ ] **Step 1: Create the test directory**

Run: `Test-Path -LiteralPath "packages/templates/fb-reels-tv"`

Expected: `False`

Run: `New-Item -ItemType Directory -Path "packages/templates/fb-reels-tv/test"`

Expected: Directory created.

- [ ] **Step 2: Write the failing package/source tests**

Create `packages/templates/fb-reels-tv/test/package-format.test.ts` with:

```ts
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('Facebook Reels TV package format', () => {
  it('publishes under the requested public npm package name', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

    expect(pkg.name).toBe('@kv8n2oryk/fb-reels-tv');
    expect(pkg.private).toBeUndefined();
    expect(pkg.publishConfig).toEqual({ access: 'public' });
  });

  it('uses the TizenBrew app package format', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

    expect(pkg.packageType).toBe('app');
    expect(pkg.appName).toBe('Facebook Reels TV');
    expect(pkg.appPath).toBe('index.html');
    expect(pkg.files).toEqual(['index.html', 'dist']);
  });

  it('includes Samsung/Tizen remote key support in the inject source', () => {
    const injectSource = readFileSync(resolve(root, 'src/inject.ts'), 'utf8');

    expect(injectSource).toContain('10009');
    expect(injectSource).toContain('10190');
    expect(injectSource).toContain('10252');
    expect(injectSource).toContain('ArrowUp');
    expect(injectSource).toContain('ArrowDown');
    expect(injectSource).toContain('[fb-reels-tv]');
  });
});
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `pnpm exec vitest run packages/templates/fb-reels-tv/test/package-format.test.ts`

Expected: FAIL because `package.json` and `src/inject.ts` do not exist yet.

- [ ] **Step 4: Commit the failing test**

Run:

```bash
git add packages/templates/fb-reels-tv/test/package-format.test.ts
git commit -m "test: add fb reels tv package checks"
```

Expected: Commit succeeds.

## Task 2: Add Package Metadata And TizenBrew Config

**Files:**
- Create: `packages/templates/fb-reels-tv/package.json`
- Create: `packages/templates/fb-reels-tv/tizenbrew.config.ts`
- Create: `packages/templates/fb-reels-tv/index.html`
- Create: `packages/templates/fb-reels-tv/README.md`

- [ ] **Step 1: Create package metadata**

Create `packages/templates/fb-reels-tv/package.json` with:

```json
{
  "name": "@kv8n2oryk/fb-reels-tv",
  "version": "0.1.0",
  "description": "Facebook Reels TV helper for TizenBrew on Samsung Tizen 3",
  "type": "module",
  "packageType": "app",
  "appName": "Facebook Reels TV",
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
    "facebook",
    "reels",
    "tizen",
    "tizenbrew",
    "samsung-tv",
    "tv",
    "remote"
  ],
  "license": "MIT"
}
```

- [ ] **Step 2: Create TizenBrew config**

Create `packages/templates/fb-reels-tv/tizenbrew.config.ts` with:

```ts
export default {
  name: 'fb-reels-tv',
  displayName: 'Facebook Reels TV',
  version: '0.1.0',
  description: 'Facebook Reels TV helper for TizenBrew on Samsung Tizen 3',
  targetUrl: 'https://www.facebook.com/reel',
  inject: {
    scripts: ['src/inject.ts'],
    styles: ['src/style.css'],
  },
  tvKeys: {
    arrows: true,
    enter: true,
    back: true,
    playPause: true,
  },
  performance: {
    removeAnimations: true,
    lazyMedia: true,
    hideComments: true,
    memorySaver: true,
  },
};
```

- [ ] **Step 3: Create app shell**

Create `packages/templates/fb-reels-tv/index.html` with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Facebook Reels TV</title>
    <style>
      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: #050505;
        color: #f5f5f5;
        font-family: Arial, sans-serif;
      }

      main {
        display: flex;
        min-height: 100%;
        align-items: center;
        justify-content: center;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <main>
      <div>
        <h1>Facebook Reels TV</h1>
        <p>Open this module through TizenBrew to load Facebook Reels with TV remote helpers.</p>
      </div>
    </main>
  </body>
</html>
```

- [ ] **Step 4: Create README**

Create `packages/templates/fb-reels-tv/README.md` with:

~~~md
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
~~~

- [ ] **Step 5: Run the package-format test and verify the remaining failure**

Run: `pnpm exec vitest run packages/templates/fb-reels-tv/test/package-format.test.ts`

Expected: FAIL only because `src/inject.ts` does not exist or key strings are missing.

- [ ] **Step 6: Commit package skeleton**

Run:

```bash
git add packages/templates/fb-reels-tv/package.json packages/templates/fb-reels-tv/tizenbrew.config.ts packages/templates/fb-reels-tv/index.html packages/templates/fb-reels-tv/README.md
git commit -m "feat: add fb reels tv package skeleton"
```

Expected: Commit succeeds.

## Task 3: Add Inject Script And TV CSS

**Files:**
- Create: `packages/templates/fb-reels-tv/src/inject.ts`
- Create: `packages/templates/fb-reels-tv/src/style.css`

- [ ] **Step 1: Create source directory**

Run: `New-Item -ItemType Directory -Path "packages/templates/fb-reels-tv/src"`

Expected: Directory created.

- [ ] **Step 2: Write the inject helper**

Create `packages/templates/fb-reels-tv/src/inject.ts` with:

```ts
const LOG_PREFIX = '[fb-reels-tv]';
const CLEANUP_DELAY_MS = 350;
const NAVIGATION_SCROLL_RATIO = 0.82;

const KEY_CODES: Record<number, string> = {
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

const HIDE_SELECTORS = [
  '[aria-label="Stories"]',
  '[aria-label="Comments"]',
  '[role="complementary"]',
  '[data-pagelet="RightRail"]',
  '[data-pagelet="VideoChatHomeUnit"]',
  'div[aria-label="Comment"]',
];

let cleanupTimer: number | undefined;

function log(message: string, detail?: unknown): void {
  if (detail === undefined) {
    console.info(LOG_PREFIX, message);
    return;
  }
  console.info(LOG_PREFIX, message, detail);
}

function normalizedKey(event: KeyboardEvent): string {
  if (event.key && event.key !== 'Unidentified') return event.key;
  return KEY_CODES[event.keyCode] ?? KEY_CODES[event.which] ?? '';
}

function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
}

function currentVideo(): HTMLVideoElement | undefined {
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
  return videos.find((video) => isVisible(video)) ?? videos[0];
}

function toggleVideoPlayback(): void {
  const video = currentVideo();
  if (!video) {
    log('No visible video found for play/pause');
    return;
  }

  if (video.paused) {
    video.play().catch((error: unknown) => log('Video play failed', error));
    return;
  }

  video.pause();
}

function navigateReel(direction: 1 | -1): void {
  const amount = Math.max(320, Math.floor(window.innerHeight * NAVIGATION_SCROLL_RATIO));
  window.scrollBy({ top: amount * direction, left: 0, behavior: 'smooth' });
}

function enterTvMode(): void {
  document.documentElement.classList.add('fb-reels-tv-mode');
  document.body.classList.add('fb-reels-tv-mode');
}

function exitFullscreenLikeMode(): void {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch((error: unknown) => log('Exit fullscreen failed', error));
  }
}

function clickPrimaryControl(): boolean {
  const active = document.activeElement;
  if (active instanceof HTMLElement && typeof active.click === 'function') {
    active.click();
    return true;
  }

  const selectors = ['[aria-label="Play"]', '[aria-label="Pause"]', '[role="button"]'];
  for (const selector of selectors) {
    const el = Array.from(document.querySelectorAll<HTMLElement>(selector)).find(isVisible);
    if (el) {
      el.click();
      return true;
    }
  }

  return false;
}

function hideHeavyPanels(): void {
  for (const selector of HIDE_SELECTORS) {
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      el.style.display = 'none';
    });
  }
}

function reduceMotion(): void {
  document.documentElement.style.scrollBehavior = 'auto';
}

function cleanupDom(): void {
  enterTvMode();
  reduceMotion();
  hideHeavyPanels();
}

function scheduleCleanup(): void {
  if (cleanupTimer !== undefined) window.clearTimeout(cleanupTimer);
  cleanupTimer = window.setTimeout(cleanupDom, CLEANUP_DELAY_MS);
}

function setupKeyboardNavigation(): void {
  window.addEventListener(
    'keydown',
    (event) => {
      const key = normalizedKey(event);

      if (key === 'ArrowUp') {
        event.preventDefault();
        navigateReel(-1);
        scheduleCleanup();
        return;
      }

      if (key === 'ArrowDown') {
        event.preventDefault();
        navigateReel(1);
        scheduleCleanup();
        return;
      }

      if (key === ' ' || key === 'MediaPlayPause') {
        event.preventDefault();
        toggleVideoPlayback();
        return;
      }

      if (key === 'Enter') {
        event.preventDefault();
        if (!clickPrimaryControl()) toggleVideoPlayback();
        return;
      }

      if (key === 'Escape' || key === 'Backspace') {
        exitFullscreenLikeMode();
      }
    },
    { capture: true },
  );
}

function setupDomObserver(): void {
  const observer = new MutationObserver(scheduleCleanup);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function boot(): void {
  try {
    cleanupDom();
    setupKeyboardNavigation();
    setupDomObserver();
    log('Loaded');
  } catch (error) {
    log('Boot failed', error);
  }
}

boot();
```

- [ ] **Step 3: Write static TV CSS**

Create `packages/templates/fb-reels-tv/src/style.css` with:

```css
html.fb-reels-tv-mode,
body.fb-reels-tv-mode {
  background: #000 !important;
  overflow-x: hidden !important;
}

.fb-reels-tv-mode *,
.fb-reels-tv-mode *::before,
.fb-reels-tv-mode *::after {
  animation-duration: 0.001s !important;
  animation-iteration-count: 1 !important;
  scroll-behavior: auto !important;
  transition-duration: 0.001s !important;
}

.fb-reels-tv-mode [role='complementary'],
.fb-reels-tv-mode [aria-label='Stories'],
.fb-reels-tv-mode [aria-label='Comments'],
.fb-reels-tv-mode [data-pagelet='RightRail'] {
  display: none !important;
}

.fb-reels-tv-mode video {
  outline: none !important;
}
```

- [ ] **Step 4: Run the package-format test and verify it passes**

Run: `pnpm exec vitest run packages/templates/fb-reels-tv/test/package-format.test.ts`

Expected: PASS.

- [ ] **Step 5: Run doctor from the package directory**

Run: `pnpm exec tizenbrew-kit doctor`

Working directory: `packages/templates/fb-reels-tv`

Expected: `[tizenbrew-kit doctor] All checks passed.`

- [ ] **Step 6: Commit inject helper**

Run:

```bash
git add packages/templates/fb-reels-tv/src/inject.ts packages/templates/fb-reels-tv/src/style.css
git commit -m "feat: add fb reels tv remote helper"
```

Expected: Commit succeeds.

## Task 4: Register The Template In The CLI And Docs

**Files:**
- Modify: `packages/cli/src/types.ts`
- Modify: `packages/cli/src/commands.ts`
- Modify: `packages/cli/src/bin.ts`
- Modify: `README.md`

- [ ] **Step 1: Update template type**

Modify `packages/cli/src/types.ts` so line 3 becomes:

```ts
export type TemplateName =
  | 'blank'
  | 'youtube-tv-lite'
  | 'facebook-reels-lite'
  | 'fb-reels-tv'
  | 'noc-dashboard'
  | 'iptv-player';
```

- [ ] **Step 2: Update supported templates**

Modify `packages/cli/src/commands.ts` so `SUPPORTED_TEMPLATES` includes `fb-reels-tv`:

```ts
const SUPPORTED_TEMPLATES: TemplateName[] = [
  'blank',
  'youtube-tv-lite',
  'facebook-reels-lite',
  'fb-reels-tv',
  'noc-dashboard',
  'iptv-player',
];
```

- [ ] **Step 3: Update CLI help text**

Modify `packages/cli/src/bin.ts` option description to:

```ts
'template name: blank|youtube-tv-lite|facebook-reels-lite|fb-reels-tv|noc-dashboard|iptv-player',
```

- [ ] **Step 4: Update root README command and template list**

Modify `README.md` line 36 to:

```md
- `tizenbrew-kit create <name> --template <blank|youtube-tv-lite|facebook-reels-lite|fb-reels-tv|noc-dashboard|iptv-player>`
```

Modify the Templates section to include:

```md
- `fb-reels-tv`: publishable Facebook Reels TV package for Samsung Tizen 3 remote navigation
```

- [ ] **Step 5: Build CLI and verify create command can use template**

Run: `pnpm --filter @tizenbrew-kit/cli build`

Expected: Build succeeds.

Run: `pnpm exec tizenbrew-kit create fb-reels-tv-smoke -t fb-reels-tv`

Expected: `Created fb-reels-tv-smoke from template fb-reels-tv`.

Run: `Remove-Item -Recurse -Force -LiteralPath "fb-reels-tv-smoke"`

Expected: Smoke directory removed.

- [ ] **Step 6: Commit CLI/docs registration**

Run:

```bash
git add packages/cli/src/types.ts packages/cli/src/commands.ts packages/cli/src/bin.ts README.md
git commit -m "feat(cli): register fb reels tv template"
```

Expected: Commit succeeds.

## Task 5: Build, Package, And Verify Publish Contents

**Files:**
- Generated: `packages/templates/fb-reels-tv/dist/*`
- Generated: `packages/templates/fb-reels-tv/release/fb-reels-tv-0.1.0.zip`

- [ ] **Step 1: Run package tests**

Run: `pnpm exec vitest run packages/templates/fb-reels-tv/test/package-format.test.ts`

Expected: PASS.

- [ ] **Step 2: Run full repo checks**

Run: `pnpm check`

Expected: lint, tests, and build all pass.

- [ ] **Step 3: Build the new module**

Run: `pnpm exec tizenbrew-kit build`

Working directory: `packages/templates/fb-reels-tv`

Expected: `dist/inject.js`, `dist/style.css`, `dist/manifest.json`, `dist/module.json`, and `dist/README.md` exist.

- [ ] **Step 4: Package the new module zip**

Run: `pnpm exec tizenbrew-kit package`

Working directory: `packages/templates/fb-reels-tv`

Expected: `release/fb-reels-tv-0.1.0.zip` exists.

- [ ] **Step 5: Verify npm package contents without publishing**

Run: `npm pack --dry-run --cache "D:\pupeteer\tizenbrew-kit\.npm-cache"`

Working directory: `packages/templates/fb-reels-tv`

Expected output includes `index.html`, `dist/inject.js`, `dist/style.css`, `dist/module.json`, and `package.json`. Expected package name is `@kv8n2oryk/fb-reels-tv@0.1.0`.

- [ ] **Step 6: Leave generated artifacts uncommitted**

Do not commit `packages/templates/fb-reels-tv/dist` or `packages/templates/fb-reels-tv/release` during the initial source implementation. They are generated by the build/package commands and npm can publish the generated `dist` files from the package working directory after verification.

Run: `git status --short`

Expected: Source commits are clean except generated `packages/templates/fb-reels-tv/dist/` and `packages/templates/fb-reels-tv/release/` files, if those directories were created by the build/package commands.

## Task 6: Publish To npm

**Files:**
- No source edits expected.

- [ ] **Step 1: Confirm npm auth**

Run: `npm whoami --cache "D:\pupeteer\tizenbrew-kit\.npm-cache"`

Working directory: `packages/templates/fb-reels-tv`

Expected: Prints the npm username that has publish access to `@kv8n2oryk/fb-reels-tv`.

If this fails with `ENEEDAUTH`, `E401`, or permission errors, stop and report the exact npm error. Do not retry blindly.

- [ ] **Step 2: Publish package**

Run: `npm publish --access public --cache "D:\pupeteer\tizenbrew-kit\.npm-cache"`

Working directory: `packages/templates/fb-reels-tv`

Expected: Publish succeeds for `@kv8n2oryk/fb-reels-tv@0.1.0`.

If this fails with `E403`, `E401`, package-name conflict, or OTP/authentication errors, stop and report the exact npm error.

- [ ] **Step 3: Verify package is visible**

Run: `npm view @kv8n2oryk/fb-reels-tv version --cache "D:\pupeteer\tizenbrew-kit\.npm-cache"`

Expected: `0.1.0`.

## Self-Review

- Spec coverage: The plan creates the new `@kv8n2oryk/fb-reels-tv` package, keeps `facebook-reels-lite` intact, implements app package format, adds remote keys, adds fullscreen/DOM cleanup behavior, adds tests, builds/packages, and includes npm publish verification.
- Placeholder scan: No unresolved placeholder markers are present. Publishing auth failures have concrete stop/report behavior.
- Type consistency: The new template name is consistently `fb-reels-tv`; the npm package name is consistently `@kv8n2oryk/fb-reels-tv`; the app name is consistently `Facebook Reels TV`.
