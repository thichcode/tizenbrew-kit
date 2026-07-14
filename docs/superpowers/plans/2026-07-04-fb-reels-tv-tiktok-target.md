# fb-reels-tv TikTok Target Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change `@kv8n2oryk/fb-reels-tv` from Facebook Reels to TikTok while keeping the package name and TizenBrew `mods` format.

**Architecture:** Keep this as a website mod package, not an app package. Update npm metadata and TizenBrew config to load `https://www.tiktok.com/`, and keep `src/userScript.ts` minimal so it does not interfere with page rendering.

**Tech Stack:** TypeScript, TizenBrew Kit CLI build, Vitest, npm publish.

---

## File Structure

- Modify `packages/templates/fb-reels-tv/package.json`: version, description, `websiteURL`, keywords.
- Modify `packages/templates/fb-reels-tv/tizenbrew.config.ts`: version, display/description, `targetUrl`.
- Modify `packages/templates/fb-reels-tv/test/package-format.test.ts`: assert TikTok URL and user script support.
- Modify `packages/templates/fb-reels-tv/README.md`: document TikTok target and minimal injection.
- Keep `packages/templates/fb-reels-tv/src/userScript.ts`: minimal remote handler only.

## Task 1: Test TikTok Package Metadata

**Files:**
- Modify: `packages/templates/fb-reels-tv/test/package-format.test.ts`

- [ ] **Step 1: Write failing test expectations**

Change the package format test to expect TikTok metadata:

```ts
expect(pkg.websiteURL).toBe('https://www.tiktok.com/');
expect(pkg.main).toBe('dist/userScript.js');
expect(pkg.serviceFile).toBe('dist/service.js');
```

Keep the remote-key assertions reading `src/userScript.ts` and checking `10009`, `10190`, `10252`, `ArrowUp`, `ArrowDown`, and `[fb-reels-tv]`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run test/package-format.test.ts`

Working directory: `packages/templates/fb-reels-tv`

Expected: FAIL because `package.json` still has `https://m.facebook.com/reel/`.

## Task 2: Update Package To TikTok Target

**Files:**
- Modify: `packages/templates/fb-reels-tv/package.json`
- Modify: `packages/templates/fb-reels-tv/tizenbrew.config.ts`
- Modify: `packages/templates/fb-reels-tv/README.md`

- [ ] **Step 1: Update package metadata**

Change `packages/templates/fb-reels-tv/package.json` fields to:

```json
"version": "0.1.14",
"description": "TikTok TV helper for TizenBrew on Samsung Tizen 3",
"appName": "TikTok TV",
"websiteURL": "https://www.tiktok.com/"
```

Update keywords by replacing `facebook` and `reels` with `tiktok` and `short-video`.

- [ ] **Step 2: Update TizenBrew config**

Change `packages/templates/fb-reels-tv/tizenbrew.config.ts` fields to:

```ts
displayName: 'TikTok TV',
version: '0.1.14',
description: 'TikTok TV helper for TizenBrew on Samsung Tizen 3',
targetUrl: 'https://www.tiktok.com/',
```

Keep `inject.scripts: ['src/userScript.ts', 'src/service.ts']` and no styles.

- [ ] **Step 3: Update README**

Change the README title and intro to:

```md
# TikTok TV

TikTok TV is a minimal TizenBrew website mod that opens TikTok and adds lightweight Samsung TV remote helpers.
```

Document that it does not fetch feeds, scrape data, inject CSS, or bypass login.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run test/package-format.test.ts`

Working directory: `packages/templates/fb-reels-tv`
Expected: PASS.

## Task 3: Build And Publish 0.1.14

**Files:**
- Generated: `packages/templates/fb-reels-tv/dist/userScript.js`
- Generated: `packages/templates/fb-reels-tv/dist/service.js`

- [ ] **Step 1: Build package**

Run: `node "$(git rev-parse --show-toplevel)/packages/cli/dist/bin.js" build`

Working directory: `packages/templates/fb-reels-tv`
Expected: `dist/userScript.js`, `dist/service.js`, `dist/manifest.json`, and `dist/module.json` exist.

- [ ] **Step 2: Verify npm dry-run**

Run: `npm pack --dry-run --cache "D:\pupeteer\tizenbrew-kit\.npm-cache"`

Working directory: `packages/templates/fb-reels-tv`
Expected: package `@kv8n2oryk/fb-reels-tv@0.1.14` includes `dist/userScript.js`, `dist/service.js`, `package.json`, and README.

- [ ] **Step 3: Publish**

Run: `npm publish --access public --otp=<OTP> --cache "D:\pupeteer\tizenbrew-kit\.npm-cache"`

Working directory: `packages/templates/fb-reels-tv`
Expected: publish succeeds for `@kv8n2oryk/fb-reels-tv@0.1.14`.

- [ ] **Step 4: Verify npm latest**

Run: `npm view @kv8n2oryk/fb-reels-tv version packageType websiteURL main serviceFile --cache "D:\pupeteer\tizenbrew-kit\.npm-cache"`

Expected: version `0.1.14`, packageType `mods`, websiteURL `https://www.tiktok.com/`, main `dist/userScript.js`, serviceFile `dist/service.js`.

## Self-Review

- Spec coverage: Plan updates TikTok target, keeps package name, preserves `mods` format, keeps injection minimal, and publishes a new npm version.
- Placeholder scan: No unresolved placeholders except `<OTP>`, which is provided interactively at publish time.
- Type consistency: `websiteURL` and `targetUrl` both use `https://www.tiktok.com/`; package name remains `@kv8n2oryk/fb-reels-tv`.
