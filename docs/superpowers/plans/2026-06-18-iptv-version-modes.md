# IPTV Version Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mode selector inside the IPTV player so one installed app can switch between legacy `0.2.0`, current `0.5.1`, and latest behavior.

**Architecture:** Keep one app bundle and model version differences as behavior modes. Legacy mode gets its own parser and player/remote behavior where needed; current/latest use the existing behavior. Persist the selected mode in localStorage so TV testing does not require reinstalling packages.

**Tech Stack:** TypeScript, DOM APIs, Vitest, TizenBrew app package format.

---

### Task 1: Parser Mode

**Files:**
- Modify: `packages/templates/iptv-player/src/playlist.ts`
- Create: `packages/templates/iptv-player/test/playlist.test.ts`

- [ ] Add `PlayerMode = 'legacy-0.2.0' | 'current-0.5.1' | 'latest'`.
- [ ] Add `parseM3ULegacy` that only reads the URL immediately after `#EXTINF`, matching `0.2.0` behavior.
- [ ] Add `parsePlaylistForMode(content, mode)` that chooses legacy or current parser.
- [ ] Test that legacy finds `KIX HD` in a direct-URL entry.
- [ ] Test that current parser keeps channels with `#EXTVLCOPT` while legacy skips them.

### Task 2: UI Selector And Persistence

**Files:**
- Modify: `packages/templates/iptv-player/index.html`
- Modify: `packages/templates/iptv-player/src/index.html`
- Modify: `packages/templates/iptv-player/src/inject.ts`

- [ ] Add a mode `<select id="mode-select">` with `Legacy 0.2.0`, `Current 0.5.1`, and `Latest`.
- [ ] Read and save mode in localStorage key `iptv-player-mode`.
- [ ] Re-load the current playlist when mode changes.
- [ ] Auto-load default playlist only in legacy mode.

### Task 3: Legacy Playback And Remote Behavior

**Files:**
- Modify: `packages/templates/iptv-player/src/player.ts`
- Modify: `packages/templates/iptv-player/src/remote.ts`
- Modify: `packages/templates/iptv-player/src/inject.ts`

- [ ] Add a legacy load path that sets `video.src`, calls `play()`, and reports `onerror`/`oncanplay` like `0.2.0`.
- [ ] In legacy mode, ArrowUp/ArrowDown select adjacent channels directly instead of only moving focus.
- [ ] Keep current/latest behavior unchanged.

### Task 4: Build Verification

**Files:**
- Generated: `packages/templates/iptv-player/dist/inject.js`
- Generated: `packages/templates/iptv-player/dist/style.css`

- [ ] Run parser tests and confirm pass.
- [ ] Build the IPTV package.
- [ ] Verify compiled JS has no `fetch(` call.
- [ ] Validate compiled JS syntax with `new Function`.
