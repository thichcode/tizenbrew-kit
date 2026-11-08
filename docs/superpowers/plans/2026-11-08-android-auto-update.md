# Android TV Auto-Update (Hybrid Web OTA + APK) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide silent, background updates for the Android TV app (ShortVideo TV), featuring instant Over-The-Air (OTA) updates for the web bundle without requiring APK reinstallation, and background APK downloading with a 1-click install prompt for native updates.

**Architecture:** 
1. Cloudflare Worker provides a `/api/app-version` metadata endpoint and `/web/inject.js` static bundle endpoint.
2. Android app checks `/api/app-version` on launch asynchronously.
3. For web updates: downloads `inject.js` silently to app internal storage (`filesDir/web/inject.js`), intercepted dynamically by `WebViewClient.shouldInterceptRequest`.
4. For native APK updates: downloads APK silently to app cache, then prompts user on TV to install via `FileProvider` and `ACTION_VIEW`.

**Tech Stack:** Java, Android SDK 21-34, AndroidX Core FileProvider, WebView, Cloudflare Worker (TypeScript, Vitest).

---

## Global Constraints

- Android `minSdk = 21`, `targetSdk = 34`.
- Maintain full Android TV remote control compatibility (D-Pad, Back button).
- Zero interruptions during video playback: background checks must run on worker threads.
- OTA Web Bundle updates must be atomic: download to `.tmp` file and verify non-empty before replacing active bundle.

## Review Focus

1. **Network offline / flaky:** App must gracefully fallback to pre-bundled asset files if update endpoint fails or times out.
2. **Corrupted bundle:** If downloaded `inject.js` is truncated or corrupted, app must discard it and load pre-bundled asset.
3. **Android 7-14 FileProvider Uri security:** Use `FileProvider.getUriForFile` with `FLAG_GRANT_READ_URI_PERMISSION` for APK installation.
4. **Leanback TV compatibility:** Dialog / prompt for APK update must be navigable with TV remote D-Pad.
5. **CORS & headers:** `/api/app-version` and `/web/inject.js` must return `Access-Control-Allow-Origin: *`.

---

### Task 1: Cloudflare Worker Update Endpoints

**Files:**
- Modify: `workers/tiktok-resolver/src/index.ts`
- Test: `workers/tiktok-resolver/test/index.test.ts`

- [ ] Step 1: Add `/api/app-version` handler returning current versions and download URLs.
- [ ] Step 2: Add `/web/inject.js` handler serving the latest web bundle.
- [ ] Step 3: Write tests in `workers/tiktok-resolver/test/index.test.ts` for `/api/app-version`.
- [ ] Step 4: Run `npx vitest run test/index.test.ts` to ensure all tests pass.
- [ ] Step 5: Deploy Worker via `npx wrangler deploy`.

---

### Task 2: Android Manifest & FileProvider Configuration

**Files:**
- Create: `android/ShortVideoTV/app/src/main/res/xml/file_paths.xml`
- Modify: `android/ShortVideoTV/app/src/main/AndroidManifest.xml`

- [ ] Step 1: Create `file_paths.xml` declaring external-cache-path and cache-path.
- [ ] Step 2: Add `REQUEST_INSTALL_PACKAGES` permission to `AndroidManifest.xml`.
- [ ] Step 3: Add `androidx.core.content.FileProvider` to `<application>` in `AndroidManifest.xml`.

---

### Task 3: Android UpdateManager Implementation

**Files:**
- Create: `android/ShortVideoTV/app/src/main/java/com/shortvideo/tv/UpdateManager.java`

- [ ] Step 1: Implement `checkAndUpdate(Activity activity)` running on background executor.
- [ ] Step 2: Implement OTA Web Bundle fetch: compare version, download `inject.js.tmp`, atomically rename to `filesDir/web/inject.js`.
- [ ] Step 3: Implement Native APK download & prompt: compare `apkVersionCode`, download `ShortVideoTV.apk` to cache, show TV-friendly AlertDialog with "Cập nhật" button invoking `FileProvider` install intent.

---

### Task 4: MainActivity Dynamic Interceptor & Update Hook

**Files:**
- Modify: `android/ShortVideoTV/app/src/main/java/com/shortvideo/tv/MainActivity.java`

- [ ] Step 1: Override `WebViewClient.shouldInterceptRequest` to serve `filesDir/web/inject.js` when present instead of asset.
- [ ] Step 2: Call `UpdateManager.checkAndUpdate(this)` in `MainActivity.onCreate`.
- [ ] Step 3: Verify build via `./gradlew assembleDebug` in `android/ShortVideoTV`.

---

### Task 5: Verification & Git Commit

- [ ] Step 1: Test Worker endpoint with curl.
- [ ] Step 2: Verify Android compilation and APK packaging.
- [ ] Step 3: Git commit and push changes to trigger GitHub Release build.
