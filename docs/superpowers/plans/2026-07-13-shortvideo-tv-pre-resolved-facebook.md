# ShortVideo TV Pre-Resolved Facebook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve Facebook Reels during phone/setup submit so the TV receives a ready-to-play CDN URL and can auto-play new items without waiting for yt-dlp.

**Architecture:** Keep the existing Cloudflare Worker KV feed and TV polling loop. Worker `/submit` pre-resolves Facebook with the existing Morocco `/resolve` backend when possible, while TV prefers pre-resolved `videoUrl` and only falls back to resolve/proxy paths when needed.

**Tech Stack:** Cloudflare Workers TypeScript, KV, Vitest, TizenBrew app TypeScript bundled with esbuild, FastAPI resolver already deployed separately.

---

## File Structure

- Modify `workers/tiktok-resolver/src/index.ts`: extend `FeedItem`, pre-resolve Facebook in `handleSubmit`, persist `resolvedAt` metadata, keep unresolved fallback behavior.
- Modify `workers/tiktok-resolver/test/index.test.ts`: update old Facebook submit expectation and add pre-resolve success/failure tests.
- Modify `packages/templates/fb-reels-tv/src/inject.ts`: preserve optional metadata in `parseFeed`, skip Facebook `/resolve` when `videoUrl` is already direct, auto-play newest item when TV is idle.
- Modify `packages/templates/fb-reels-tv/test/package-format.test.ts`: update stale package assertions and add static checks for pre-resolved Facebook/auto-play behavior.
- Build output `packages/templates/fb-reels-tv/dist/inject.js`: regenerate with esbuild after TV source changes.

## Task 1: Worker Pre-Resolve Facebook On Submit

**Files:**
- Modify: `workers/tiktok-resolver/src/index.ts`
- Test: `workers/tiktok-resolver/test/index.test.ts`

- [ ] **Step 1: Write failing Worker tests**

Update `workers/tiktok-resolver/test/index.test.ts` Facebook submit block to cover pre-resolve success and fallback. Replace the existing `stores Facebook URL as-is (TV resolves directly)` test with:

```ts
    it('stores pre-resolved Facebook CDN URL when fallback resolver succeeds', async () => {
      const testEnv = env({
        FALLBACK_RESOLVER_URL: 'https://resolver.example.com',
        FALLBACK_API_KEY: 'secret',
      });
      const rawUrl = 'https://www.facebook.com/reel/123456';
      mockFetch(200, {
        ok: true,
        resolved: {
          videoUrl: 'https://video.xx.fbcdn.net/v/t42.1790-2/video.mp4',
          title: 'Resolved Facebook Title',
          thumbnailUrl: 'https://scontent.xx.fbcdn.net/thumb.jpg',
        },
      });

      const res = await post('https://feed.example.com/submit', { code: CODE, url: rawUrl }, testEnv);
      expect(res.status).toBe(200);
      const item = (await json(res)).item as Record<string, unknown>;
      expect(item.source).toBe('Facebook');
      expect(item.sourceUrl).toBe(rawUrl);
      expect(item.videoUrl).toBe('https://video.xx.fbcdn.net/v/t42.1790-2/video.mp4');
      expect(item.title).toBe('Resolved Facebook Title');
      expect(item.thumbnailUrl).toBe('https://scontent.xx.fbcdn.net/thumb.jpg');
      expect(typeof item.resolvedAt).toBe('string');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://resolver.example.com/resolve?url=' + encodeURIComponent(rawUrl),
        expect.objectContaining({
          headers: { 'X-API-Key': 'secret' },
        }),
      );
    });

    it('stores unresolved Facebook URL when fallback resolver fails', async () => {
      const testEnv = env({ FALLBACK_RESOLVER_URL: 'https://resolver.example.com' });
      const rawUrl = 'https://www.facebook.com/reel/123456';
      mockFetch(502, { error: 'resolver failed' });

      const res = await post('https://feed.example.com/submit', { code: CODE, url: rawUrl }, testEnv);
      expect(res.status).toBe(200);
      const item = (await json(res)).item as Record<string, unknown>;
      expect(item.source).toBe('Facebook');
      expect(item.sourceUrl).toBe(rawUrl);
      expect(item.videoUrl).toBe(rawUrl);
      expect(item.title).toBe('Facebook Reel');
      expect(item.resolvedAt).toBeUndefined();
    });
```

Keep the existing `accepts Facebook share/v/ link format` test, but pass an env with no `FALLBACK_RESOLVER_URL` so it does not depend on network mocking:

```ts
      const res = await post('https://feed.example.com/submit', { code: CODE, url: rawUrl }, env());
```

- [ ] **Step 2: Run Worker tests and verify failure**

Run: `npm test`

Working directory: `workers/tiktok-resolver`

Expected: FAIL because Facebook submit still stores `videoUrl` as the original Facebook URL and does not set `resolvedAt`.

- [ ] **Step 3: Implement Worker pre-resolve**

In `workers/tiktok-resolver/src/index.ts`, extend `FeedItem`:

```ts
interface FeedItem {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  resolvedAt?: string;
}
```

Replace the Facebook branch in `handleSubmit` with:

```ts
  } else if (isValidFacebookUrl(platformUrl)) {
    const fallbackResolved = await callFallbackResolver(env, platformUrl);
    let fbTitle = 'Facebook Reel';
    let fbVideoUrl = platformUrl;
    let fbThumbnailUrl = '';
    let resolvedAt: string | undefined;

    if (fallbackResolved) {
      fbTitle = fallbackResolved.title || fbTitle;
      fbVideoUrl = fallbackResolved.videoUrl;
      fbThumbnailUrl = fallbackResolved.thumbnailUrl || '';
      resolvedAt = new Date().toISOString();
    } else {
      try {
        const resolved = await resolveFacebookUrl(platformUrl);
        if (resolved && resolved.title) fbTitle = resolved.title;
        if (resolved && resolved.thumbnailUrl) fbThumbnailUrl = resolved.thumbnailUrl;
      } catch {}
    }

    feedItem = {
      id: generateId(platformUrl),
      title: fbTitle,
      source: 'Facebook',
      sourceUrl: platformUrl,
      videoUrl: fbVideoUrl,
      thumbnailUrl: fbThumbnailUrl,
      duration: 0,
      ...(resolvedAt ? { resolvedAt } : {}),
    };
```

- [ ] **Step 4: Run Worker verification**

Run: `npm test`

Working directory: `workers/tiktok-resolver`

Expected: PASS.

Run: `npm run typecheck`

Working directory: `workers/tiktok-resolver`

Expected: PASS.

- [ ] **Step 5: Checkpoint without commit unless requested**

Run: `git diff -- workers/tiktok-resolver/src/index.ts workers/tiktok-resolver/test/index.test.ts`

Expected: Diff only contains Worker pre-resolve logic and related tests. Do not run `git commit` unless the user explicitly asks.

## Task 2: TV Prefer Pre-Resolved Facebook URL

**Files:**
- Modify: `packages/templates/fb-reels-tv/src/inject.ts`
- Test: `packages/templates/fb-reels-tv/test/package-format.test.ts`

- [ ] **Step 1: Write failing TV static tests**

In `packages/templates/fb-reels-tv/test/package-format.test.ts`, update stale package assertions in the first test:

```ts
    expect(pkg.name).toBe('shortvideo-tv');
    expect(pkg.version).toBe('1.0.1');
```

In the `implements device code, feed polling, and video playback` test, replace the stale expectations:

```ts
    expect(source).toContain('video.src = resolved.videoUrl');
    expect(source).toContain('Cannot play:');
```

Add this test near the playback test:

```ts
  it('prefers pre-resolved Facebook video URLs and keeps fallback proxy behavior', () => {
    var source = readFileSync(resolve(root, 'src/inject.ts'), 'utf8');

    expect(source).toContain('isPreResolvedFacebook');
    expect(source).toContain('item.videoUrl !== item.sourceUrl');
    expect(source).toContain('buildFacebookProxyUrl');
    expect(source).toContain('item._proxyUrl = buildFacebookProxyUrl(item.sourceUrl)');
  });
```

- [ ] **Step 2: Run TV package test and verify failure**

Run: `npm test`

Working directory: `packages/templates/fb-reels-tv`

Expected: FAIL because `isPreResolvedFacebook` and `buildFacebookProxyUrl` are not implemented yet.

- [ ] **Step 3: Implement direct-CDN preference helpers**

In `packages/templates/fb-reels-tv/src/inject.ts`, add these helpers after `isHttpUrl`:

```ts
  function buildFacebookProxyUrl(sourceUrl) {
    return FALLBACK_RESOLVER_URL + '/play?url=' + encodeURIComponent(sourceUrl) + '&api_key=' + encodeURIComponent(FALLBACK_API_KEY);
  }

  function isPreResolvedFacebook(item) {
    return item && item.source === 'Facebook' && item.sourceUrl && item.videoUrl && item.videoUrl !== item.sourceUrl;
  }
```

In `parseFeed`, preserve `resolvedAt`:

```ts
          resolvedAt: typeof item.resolvedAt === 'string' ? item.resolvedAt : '',
```

Place it after `duration` in the returned object.

Replace the Facebook branch in `resolveItem` with:

```ts
    if (item.source === 'Facebook') {
      if (isPreResolvedFacebook(item)) {
        item._proxyUrl = buildFacebookProxyUrl(item.sourceUrl);
        callback(item);
        return;
      }

      fetch(FALLBACK_RESOLVER_URL + '/resolve?url=' + encodeURIComponent(item.sourceUrl), {
        headers: { 'X-API-Key': FALLBACK_API_KEY }
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.ok && data.resolved && data.resolved.videoUrl) {
            item.videoUrl = data.resolved.videoUrl;
            item._proxyUrl = buildFacebookProxyUrl(item.sourceUrl);
          } else {
            item.videoUrl = buildFacebookProxyUrl(item.sourceUrl);
          }
          callback(item);
        })
        .catch(function () {
          item.videoUrl = buildFacebookProxyUrl(item.sourceUrl);
          callback(item);
        });
      return;
    }
```

- [ ] **Step 4: Run TV package test**

Run: `npm test`

Working directory: `packages/templates/fb-reels-tv`

Expected: PASS.

- [ ] **Step 5: Regenerate TV bundle**

Run: `npx esbuild src/inject.ts --bundle --minify --target=es2015 --outfile=dist/inject.js`

Working directory: `packages/templates/fb-reels-tv`

Expected: command succeeds and prints `dist\inject.js` bundle size.

- [ ] **Step 6: Checkpoint without commit unless requested**

Run: `git diff -- packages/templates/fb-reels-tv/src/inject.ts packages/templates/fb-reels-tv/test/package-format.test.ts packages/templates/fb-reels-tv/dist/inject.js`

Expected: Diff only contains direct-CDN preference, fallback proxy helper, resolved metadata preservation, tests, and regenerated bundle. Do not run `git commit` unless the user explicitly asks.

## Task 3: TV Auto-Play Newly Submitted Item

**Files:**
- Modify: `packages/templates/fb-reels-tv/src/inject.ts`
- Test: `packages/templates/fb-reels-tv/test/package-format.test.ts`

- [ ] **Step 1: Write failing static test for auto-play**

Add this test to `packages/templates/fb-reels-tv/test/package-format.test.ts`:

```ts
  it('auto-plays the newest feed item when the TV is idle', () => {
    var source = readFileSync(resolve(root, 'src/inject.ts'), 'utf8');

    expect(source).toContain('lastSeenTopItemId');
    expect(source).toContain('maybeAutoPlayLatest');
    expect(source).toContain('if (isPlayerOpen) return;');
    expect(source).toContain('playItem(latest);');
  });
```

- [ ] **Step 2: Run TV package test and verify failure**

Run: `npm test`

Working directory: `packages/templates/fb-reels-tv`

Expected: FAIL because auto-play tracking is not implemented yet.

- [ ] **Step 3: Implement auto-play tracking**

In `packages/templates/fb-reels-tv/src/inject.ts`, add state near the existing globals:

```ts
  var lastSeenTopItemId = '';
  var hasLoadedInitialFeed = false;
```

Add this function after `renderFeed`:

```ts
  function maybeAutoPlayLatest(previousTopItemId) {
    if (!items.length) return;
    var latest = items[0];
    if (!latest || !latest.id) return;
    if (!hasLoadedInitialFeed) {
      hasLoadedInitialFeed = true;
      lastSeenTopItemId = latest.id;
      return;
    }
    if (isPlayerOpen) return;
    if (latest.id === previousTopItemId || latest.id === lastSeenTopItemId) return;
    lastSeenTopItemId = latest.id;
    selectedIndex = 0;
    renderFeed();
    playItem(latest);
  }
```

Update the success branch in `fetchFeed`:

```ts
        var parsed = parseFeed(data);
        var previousTopItemId = items.length && items[0] ? items[0].id : '';
        if (parsed.length || items.length) {
          items = parsed;
          setStatus(parsed.length + ' video' + (parsed.length > 1 ? 's' : ''));
          renderFeed();
          maybeAutoPlayLatest(previousTopItemId);
        }
```

Keep the existing empty-state block after this branch:

```ts
        if (!items.length) {
          showSetup();
          setStatus('Waiting for videos...');
        }
```

- [ ] **Step 4: Run TV package test**

Run: `npm test`

Working directory: `packages/templates/fb-reels-tv`

Expected: PASS.

- [ ] **Step 5: Regenerate TV bundle**

Run: `npx esbuild src/inject.ts --bundle --minify --target=es2015 --outfile=dist/inject.js`

Working directory: `packages/templates/fb-reels-tv`

Expected: command succeeds and prints `dist\inject.js` bundle size.

- [ ] **Step 6: Checkpoint without commit unless requested**

Run: `git diff -- packages/templates/fb-reels-tv/src/inject.ts packages/templates/fb-reels-tv/test/package-format.test.ts packages/templates/fb-reels-tv/dist/inject.js`

Expected: Diff only contains auto-play tracking and regenerated bundle. Do not run `git commit` unless the user explicitly asks.

## Task 4: End-To-End Verification And Deploy/Publish Prep

**Files:**
- Verify: `workers/tiktok-resolver/src/index.ts`
- Verify: `workers/tiktok-resolver/test/index.test.ts`
- Verify: `packages/templates/fb-reels-tv/src/inject.ts`
- Verify: `packages/templates/fb-reels-tv/dist/inject.js`

- [ ] **Step 1: Run Worker tests**

Run: `npm test`

Working directory: `workers/tiktok-resolver`

Expected: PASS.

- [ ] **Step 2: Run Worker typecheck**

Run: `npm run typecheck`

Working directory: `workers/tiktok-resolver`

Expected: PASS.

- [ ] **Step 3: Run TV package tests**

Run: `npm test`

Working directory: `packages/templates/fb-reels-tv`

Expected: PASS.

- [ ] **Step 4: Build TV bundle**

Run: `npx esbuild src/inject.ts --bundle --minify --target=es2015 --outfile=dist/inject.js`

Working directory: `packages/templates/fb-reels-tv`

Expected: PASS and `dist/inject.js` updated.

- [ ] **Step 5: Inspect final diff**

Run: `git diff --stat`

Expected: changed files are limited to the Worker, Worker tests, TV source, TV tests, generated bundle, and plan/spec docs.

- [ ] **Step 6: Deploy Worker only after tests pass**

Run: `npx wrangler deploy`

Working directory: `workers/tiktok-resolver`

Expected: deploy succeeds and prints `https://shortvideo-feed.dvt-kisu.workers.dev`.

- [ ] **Step 7: Publish TV package only if user provides OTP**

Version has already been bumped to `1.0.1`. Do not run `npm version patch` again for this release.

Run after OTP is provided: `npm publish --otp=<OTP>`

Working directory: `packages/templates/fb-reels-tv`

Expected: npm publishes `shortvideo-tv@1.0.1` with latest tag.

## Self-Review

- Spec coverage: Worker pre-resolve, TV direct-CDN preference, fallback proxy, auto-play when idle, and old unresolved item compatibility are each covered by tasks.
- Placeholder scan: No TBD/TODO/fill-later placeholders remain. Each code change step includes concrete snippets and verification commands.
- Type consistency: New `resolvedAt?: string` matches stored JSON, TV parsed `resolvedAt`, and no required consumer depends on it.
