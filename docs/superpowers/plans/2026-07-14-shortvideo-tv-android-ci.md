# ShortVideo TV Android TV + GitHub CI Implementation Plan

> **For agentic workers:** Execute steps sequentially. No subagent dispatch needed — single session.

**Goal:** Ship `shortvideo-tv` as an Android TV APK via GitHub CI release.

**Architecture:** Minimal WebView Activity loads the existing web app from assets. CI builds the web app via esbuild, copies assets into the Android project, builds an APK with Gradle, then creates a GitHub Release with the APK attached.

**Tech Stack:** Java (Android), AGP 8.2, Gradle 8.2, GitHub Actions (ubuntu-latest)

---
**Files to create:**
- `android/ShortVideoTV/settings.gradle.kts`
- `android/ShortVideoTV/build.gradle.kts`
- `android/ShortVideoTV/gradle.properties`
- `android/ShortVideoTV/app/build.gradle.kts`
- `android/ShortVideoTV/app/src/main/AndroidManifest.xml`
- `android/ShortVideoTV/app/src/main/java/com/shortvideo/tv/MainActivity.java`
- `android/ShortVideoTV/app/src/main/res/values/strings.xml`
- `android/ShortVideoTV/app/src/main/res/values/themes.xml`
- `android/ShortVideoTV/app/src/main/res/drawable/ic_launcher_foreground.xml`
- `.github/workflows/android-release.yml`

### Task 1: Android TV project skeleton

- Create `android/ShortVideoTV/settings.gradle.kts` — root settings with `:app` module
- Create `android/ShortVideoTV/build.gradle.kts` — root build with AGP 8.2 plugin
- Create `android/ShortVideoTV/gradle.properties` — AndroidX, JVM args
- Create `android/ShortVideoTV/app/build.gradle.kts` — compileSdk 34, minSdk 21, WebView dependencies
- Create `android/ShortVideoTV/app/src/main/AndroidManifest.xml` — LEANBACK_LAUNCHER, INTERNET, hardwareAccelerated
- Create `android/ShortVideoTV/app/src/main/java/com/shortvideo/tv/MainActivity.java` — WebView loading `file:///android_asset/web/index.html`, key mapping (DPAD → arrow keys, BACK → Escape, CENTER → Enter)
- Create `android/ShortVideoTV/app/src/main/res/values/strings.xml` — app_name
- Create `android/ShortVideoTV/app/src/main/res/values/themes.xml` — Android TV theme (no action bar)
- Create `android/ShortVideoTV/app/src/main/res/drawable/ic_launcher_foreground.xml` — simple play-icon vector drawable
- Create `.github/workflows/android-release.yml` — workflow_dispatch trigger, build web app, copy assets, assembleDebug, create GitHub Release with APK

### Task 2: Verify

- Run `npm run build` in `packages/templates/fb-reels-tv`
- Verify dist/inject.js is generated
- Run all existing tests (npm test in TV, pytest in backend, npm test in worker)
- Verify CI workflow is syntactically valid (check GitHub Actions syntax)
