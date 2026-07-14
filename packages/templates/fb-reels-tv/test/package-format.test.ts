import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

var root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function createElement(tagName) {
  var element = {
    tagName: tagName,
    className: '',
    style: {},
    children: [],
    events: {},
    eventHistory: {},
    classList: {
      add: function () {},
      remove: function () {},
    },
    appendChild: function (child) {
      this.children.push(child);
    },
    setAttribute: function (name, value) {
      this[name] = value;
    },
    addEventListener: function (name, handler) {
      this.events[name] = handler;
      if (!this.eventHistory[name]) this.eventHistory[name] = [];
      this.eventHistory[name].push(handler);
    },
    removeEventListener: function (name, handler) {
      if (this.events[name] === handler) delete this.events[name];
    },
    querySelectorAll: function () {
      return this.children;
    },
    focus: function () {},
  };
  Object.defineProperty(element, 'innerHTML', {
    get: function () { return this._innerHTML || ''; },
    set: function (value) {
      this._innerHTML = value;
      this.children = [];
    },
  });
  return element;
}

function deferred() {
  var resolvePromise;
  var rejectPromise;
  var promise = new Promise(function (resolve, reject) {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise: promise, resolve: resolvePromise, reject: rejectPromise };
}

function createInjectHarness(playResults, options) {
  var source = readFileSync(resolve(root, 'dist/inject.js'), 'utf8');
  var windowEvents = {};
  var intervalHandlers = [];
  var fetchCalls = [];
  var assignedSources = [];
  var registeredKeys = [];
  var feedResponseIndex = 0;
  var currentTime = 0;
  var nextTimeoutId = 1;
  var timeoutHandlers = [];
  var sourceUrl = 'https://www.facebook.com/reel/123';
  var directCdnUrl = 'https://video.xx.fbcdn.net/v/t42.1790-2/video.mp4';
  var feedItems = options && options.feedItems ? options.feedItems : [{
    id: 'fb-1',
    title: 'Pre-resolved Facebook clip',
    source: 'Facebook',
    sourceUrl: sourceUrl,
    videoUrl: directCdnUrl,
    duration: 12,
    resolvedAt: '2026-07-13T00:00:00.000Z',
  }];
  var resolveData = options && options.resolveData ? options.resolveData : {
    ok: true,
    resolved: { videoUrl: directCdnUrl },
  };
  var elements = {
    status: createElement('div'),
    feed: createElement('div'),
    empty: createElement('div'),
    error: createElement('div'),
    help: createElement('div'),
    player: createElement('div'),
    'player-loading': createElement('div'),
    video: createElement('video'),
    'player-title': createElement('div'),
    setup: createElement('div'),
    'setup-code': createElement('div'),
    'setup-qr': createElement('img'),
    'setup-url': createElement('div'),
    app: createElement('div'),
  };

  elements.video.error = { code: 4 };
  elements.video.load = function () {
    if ((!options || options.autoLoadStart !== false) && this.events.loadstart) this.events.loadstart();
  };
  elements.video.pause = function () {};
  elements.video.removeAttribute = function (name) { if (name === 'src') this._src = ''; };
  elements.video.playCalls = 0;
  elements.video.play = function () {
    this.playCalls += 1;
    var result = playResults.shift();
    if (result === 'reject') {
      return { catch: function (handler) { handler(new Error('direct playback failed')); } };
    }
    return result;
  };
  Object.defineProperty(elements.video, 'src', {
    get: function () { return this._src || ''; },
    set: function (value) {
      this._src = value;
      assignedSources.push(value);
    },
  });
  Object.defineProperty(elements.video, 'currentSrc', {
    get: function () { return this._src || ''; },
  });

  function clearHarnessTimeout(id) {
    timeoutHandlers.forEach(function (timer) {
      if (timer.id === id) timer.cancelled = true;
    });
  }

  function runDueTimers() {
    var timer;
    do {
      timer = null;
      for (var index = 0; index < timeoutHandlers.length; index += 1) {
        if (!timeoutHandlers[index].cancelled && timeoutHandlers[index].time <= currentTime) {
          timer = timeoutHandlers.splice(index, 1)[0];
          break;
        }
      }
      if (timer) timer.handler();
    } while (timer);
  }

  runInNewContext(source, {
    console: { info: function () {} },
    confirm: function () { return false; },
    clearTimeout: clearHarnessTimeout,
    Date: { now: function () { return currentTime; } },
    document: {
      createElement: createElement,
      getElementById: function (id) { return elements[id] || null; },
    },
    encodeURIComponent: encodeURIComponent,
    fetch: function (url) {
      fetchCalls.push(String(url));
      if (String(url).indexOf('/resolve?') !== -1) {
        if (options && options.resolveResponse) return options.resolveResponse;
        return Promise.resolve({
          ok: true,
          json: function () { return Promise.resolve(resolveData); },
        });
      }
      if (options && options.feedResponses) {
        return options.feedResponses[feedResponseIndex++].promise;
      }
      var currentFeedItems = typeof feedItems === 'function' ? feedItems() : feedItems;
      return Promise.resolve({
        ok: true,
        json: function () {
          return Promise.resolve({ items: currentFeedItems });
        },
      });
    },
    localStorage: {
      value: '',
      getItem: function () { return this.value; },
      setItem: function (_key, value) { this.value = value; },
    },
    Math: Math,
    Promise: Promise,
    setInterval: function (handler) { intervalHandlers.push(handler); return 1; },
    setTimeout: function (handler, delay) {
      var id = nextTimeoutId++;
      timeoutHandlers.push({ id: id, time: currentTime + (delay || 0), handler: handler, cancelled: false });
      return id;
    },
    window: {
      addEventListener: function (name, handler) { windowEvents[name] = handler; },
      tizen: {
        tvinputdevice: {
          registerKey: function (key) { registeredKeys.push(key); },
        },
      },
    },
  });

  return {
    assignedSources: assignedSources,
    elements: elements,
    fetchCalls: fetchCalls,
    registeredKeys: registeredKeys,
    poll: function () { intervalHandlers[0](); },
    runTimers: runDueTimers,
    advanceTime: function (milliseconds) {
      currentTime += milliseconds;
      runDueTimers();
    },
    keydown: function (key) {
      windowEvents.keydown({ key: key, preventDefault: function () {} });
    },
    windowEvents: windowEvents,
  };
}

function feedResponse(items) {
  return {
    ok: true,
    json: function () {
      return Promise.resolve({ items: items });
    },
  };
}

async function loadHarnessFeed(harness) {
  harness.windowEvents.load();
  await flushPromises();
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('Public ShortVideo TV package format', () => {
  it('publishes as a TizenBrew app package', () => {
    var pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

    expect(pkg.name).toBe('shortvideo-tv');
    expect(pkg.version).toBe('1.1.1');
    expect(pkg.appName).toBe('ShortVideo TV');
    expect(pkg.packageType).toBe('app');
    expect(pkg.appPath).toBe('index.html');
    expect(pkg.keys).toEqual(['ColorF0Red']);
    expect(pkg.files).toEqual(['index.html', 'dist']);
  });

  it('rebuilds the inject bundle before running tests', () => {
    var pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    var bundleCommand = 'npx esbuild src/inject.ts --bundle --minify --target=es2015 --outfile=dist/inject.js';

    expect(pkg.scripts.pretest).toBe(bundleCommand);
    expect(pkg.scripts.build).toBe(bundleCommand);
    expect(pkg.scripts.test).toBe('vitest run test/package-format.test.ts');
  });

  it('loads the generated inject bundle from index.html', () => {
    var html = readFileSync(resolve(root, 'index.html'), 'utf8');
    var scriptMatch = html.match(/<script src="\.\/(dist\/[^"]+)"><\/script>/);

    expect(scriptMatch).not.toBeNull();
    if (!scriptMatch) return;
    expect(scriptMatch[1]).toBe('dist/inject.js');
    expect(existsSync(resolve(root, scriptMatch[1]))).toBe(true);
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

  it('defines the setup, feed, player, and error UI containers', () => {
    var html = readFileSync(resolve(root, 'index.html'), 'utf8');

    expect(html).toContain('id="setup"');
    expect(html).toContain('id="setup-code"');
    expect(html).toContain('id="setup-qr"');
    expect(html).toContain('id="status"');
    expect(html).toContain('id="feed"');
    expect(html).toContain('id="player"');
    expect(html).toContain('id="video"');
    expect(html).toContain('id="player-title"');
  });

  it('implements device code, feed polling, and video playback', () => {
    var source = readFileSync(resolve(root, 'src/inject.ts'), 'utf8');

    expect(source).toContain('deviceCode');
    expect(source).toContain('WORKER_URL');
    expect(source).toContain('parseFeed');
    expect(source).toContain('renderFeed');
    expect(source).toContain('playItem');
    expect(source).toContain('togglePlayback');
    expect(source).toContain('fetchFeed');
    expect(source).toContain('startMediaAttempt');
    expect(source).toContain('Cannot play:');
  });

  it('routes all server fallback URLs through the public Nginx port', () => {
    var source = readFileSync(resolve(root, 'src/inject.ts'), 'utf8');
    var testSource = readFileSync(fileURLToPath(import.meta.url), 'utf8');
    var publicOrigin = 'http://84.8.220.24:' + '8000';
    var bareOrigin = 'http://84.8.220.24';

    expect(source).toContain(publicOrigin);
    expect(testSource).toContain(publicOrigin);
    expect(source).not.toContain(bareOrigin + '/play');
    expect(source).not.toContain(bareOrigin + '/resolve');
    expect(testSource).not.toContain(bareOrigin + '/play');
    expect(testSource).not.toContain(bareOrigin + '/resolve');
  });

  it('plays pre-resolved Facebook URLs through direct, redirect, and proxy stages', async () => {
    var harness = createInjectHarness([undefined, undefined, undefined]);

    await loadHarnessFeed(harness);

    expect(harness.elements.feed.children.length).toBe(1);
    expect(function () { harness.elements.feed.children[0].events.click(); }).not.toThrow();
    expect(harness.assignedSources[0]).toBe('https://video.xx.fbcdn.net/v/t42.1790-2/video.mp4');
    expect(function () { harness.elements.video.events.error(); }).not.toThrow();
    expect(harness.assignedSources[1]).toBe('http://84.8.220.24:8000/play?mode=redirect&url=https%3A%2F%2Fwww.facebook.com%2Freel%2F123&api_key=299145bbcefca5e3dd0f193dc6d187b0');
    expect(harness.elements['player-loading'].textContent).toBe('Refreshing video URL...');
    expect(function () { harness.elements.video.events.error(); }).not.toThrow();
    expect(harness.assignedSources[2]).toBe('http://84.8.220.24:8000/play?mode=proxy&url=https%3A%2F%2Fwww.facebook.com%2Freel%2F123&api_key=299145bbcefca5e3dd0f193dc6d187b0');
    expect(harness.elements['player-loading'].textContent).toBe('Retrying via proxy...');
    expect(function () { harness.elements.video.events.error(); }).not.toThrow();
    expect(harness.assignedSources).toHaveLength(3);
    expect(harness.elements.error.textContent).toBe('Playback error: Format not supported on this TV (code 4)');
    expect(harness.elements['player-loading'].style.display).toBe('block');
    expect(harness.elements['player-loading'].textContent).toContain('Playback error');
    expect(harness.fetchCalls.some(function (url) { return url.indexOf('/resolve?') !== -1; })).toBe(false);
  });

  it('resolves unresolved Facebook URLs before direct, redirect, and proxy playback', async () => {
    var sourceUrl = 'https://www.facebook.com/reel/456';
    var resolvedUrl = 'https://video.xx.fbcdn.net/v/t42.1790-2/resolved.mp4';
    var harness = createInjectHarness([undefined, undefined, undefined], {
      feedItems: [{
        id: 'fb-2',
        title: 'Unresolved Facebook clip',
        source: 'Facebook',
        sourceUrl: sourceUrl,
        videoUrl: sourceUrl,
        duration: 9,
        resolvedAt: '',
      }],
      resolveData: {
        ok: true,
        resolved: { videoUrl: resolvedUrl },
      },
    });

    await loadHarnessFeed(harness);
    harness.elements.feed.children[0].events.click();
    await flushPromises();

    expect(harness.fetchCalls.some(function (url) {
      return url === 'http://84.8.220.24:8000/resolve?url=https%3A%2F%2Fwww.facebook.com%2Freel%2F456';
    })).toBe(true);
    expect(harness.assignedSources[0]).toBe(resolvedUrl);
    expect(harness.assignedSources[0]).not.toContain('/play?');
    harness.elements.video.events.error();
    expect(harness.assignedSources[1]).toBe('http://84.8.220.24:8000/play?mode=redirect&url=https%3A%2F%2Fwww.facebook.com%2Freel%2F456&api_key=299145bbcefca5e3dd0f193dc6d187b0');
    harness.elements.video.events.error();
    expect(harness.assignedSources[2]).toBe('http://84.8.220.24:8000/play?mode=proxy&url=https%3A%2F%2Fwww.facebook.com%2Freel%2F456&api_key=299145bbcefca5e3dd0f193dc6d187b0');
  });

  it('does not assume video error fallback playback returns a Promise', async () => {
    var harness = createInjectHarness([undefined, undefined, undefined]);

    await loadHarnessFeed(harness);
    harness.elements.feed.children[0].events.click();

    expect(function () { harness.elements.video.events.error(); }).not.toThrow();
    expect(function () { harness.elements.video.events.error(); }).not.toThrow();
    expect(harness.elements.video.src).toBe('http://84.8.220.24:8000/play?mode=proxy&url=https%3A%2F%2Fwww.facebook.com%2Freel%2F123&api_key=299145bbcefca5e3dd0f193dc6d187b0');
    expect(harness.fetchCalls.some(function (url) { return url.indexOf('/resolve?') !== -1; })).toBe(false);
  });

  it('advances rejected play calls through both Facebook fallbacks before failing', async () => {
    var harness = createInjectHarness(['reject', 'reject', 'reject']);

    await loadHarnessFeed(harness);

    expect(function () { harness.elements.feed.children[0].events.click(); }).not.toThrow();
    harness.runTimers();
    expect(harness.assignedSources).toEqual([
      'https://video.xx.fbcdn.net/v/t42.1790-2/video.mp4',
      'http://84.8.220.24:8000/play?mode=redirect&url=https%3A%2F%2Fwww.facebook.com%2Freel%2F123&api_key=299145bbcefca5e3dd0f193dc6d187b0',
      'http://84.8.220.24:8000/play?mode=proxy&url=https%3A%2F%2Fwww.facebook.com%2Freel%2F123&api_key=299145bbcefca5e3dd0f193dc6d187b0',
    ]);
    expect(harness.elements.error.textContent).toBe('Cannot play: direct playback failed');
    expect(harness.elements['player-loading'].style.display).toBe('block');
    expect(harness.elements['player-loading'].textContent).toContain('Cannot play');
  });

  it('does not advance past redirect when one direct attempt rejects and errors', async () => {
    var harness = createInjectHarness(['reject', undefined], { autoLoadStart: false });

    await loadHarnessFeed(harness);
    harness.elements.feed.children[0].events.click();
    if (harness.elements.video.events.loadstart) harness.elements.video.events.loadstart();
    var directErrorHandler = harness.elements.video.events.error;
    directErrorHandler();
    harness.elements.video.events.error();
    harness.runTimers();

    expect(harness.assignedSources).toEqual([
      'https://video.xx.fbcdn.net/v/t42.1790-2/video.mp4',
      'http://84.8.220.24:8000/play?mode=redirect&url=https%3A%2F%2Fwww.facebook.com%2Freel%2F123&api_key=299145bbcefca5e3dd0f193dc6d187b0',
    ]);
  });

  it('ignores a delayed direct play rejection after redirect playback starts', async () => {
    var directPlay = deferred();
    var harness = createInjectHarness([directPlay.promise, undefined]);

    await loadHarnessFeed(harness);
    harness.elements.feed.children[0].events.click();
    harness.elements.video.events.error();
    directPlay.reject(new Error('late direct failure'));
    await flushPromises();

    expect(harness.assignedSources).toEqual([
      'https://video.xx.fbcdn.net/v/t42.1790-2/video.mp4',
      'http://84.8.220.24:8000/play?mode=redirect&url=https%3A%2F%2Fwww.facebook.com%2Freel%2F123&api_key=299145bbcefca5e3dd0f193dc6d187b0',
    ]);
  });

  it('ignores an old source error after a different item opens', async () => {
    var firstVideoUrl = 'https://video.xx.fbcdn.net/v/t42.1790-2/first.mp4';
    var secondVideoUrl = 'https://video.xx.fbcdn.net/v/t42.1790-2/second.mp4';
    var harness = createInjectHarness([undefined, undefined, undefined], {
      feedItems: [{
        id: 'fb-first',
        title: 'First Facebook clip',
        source: 'Facebook',
        sourceUrl: 'https://www.facebook.com/reel/first',
        videoUrl: firstVideoUrl,
      }, {
        id: 'fb-second',
        title: 'Second Facebook clip',
        source: 'Facebook',
        sourceUrl: 'https://www.facebook.com/reel/second',
        videoUrl: secondVideoUrl,
      }],
    });

    await loadHarnessFeed(harness);
    harness.elements.feed.children[0].events.click();
    var oldErrorHandler = harness.elements.video.eventHistory.error[0];
    harness.elements.feed.children[1].events.click();

    oldErrorHandler();
    expect(harness.assignedSources).toEqual([firstVideoUrl, secondVideoUrl]);

    harness.elements.video.events.error();
    expect(harness.assignedSources[2]).toBe('http://84.8.220.24:8000/play?mode=redirect&url=https%3A%2F%2Fwww.facebook.com%2Freel%2Fsecond&api_key=299145bbcefca5e3dd0f193dc6d187b0');
  });

  it('resets Facebook fallback stages when a different item opens', async () => {
    var firstVideoUrl = 'https://video.xx.fbcdn.net/v/t42.1790-2/first.mp4';
    var secondVideoUrl = 'https://video.xx.fbcdn.net/v/t42.1790-2/second.mp4';
    var harness = createInjectHarness([undefined, undefined, undefined, undefined, undefined], {
      feedItems: [{
        id: 'fb-first',
        title: 'First Facebook clip',
        source: 'Facebook',
        sourceUrl: 'https://www.facebook.com/reel/first',
        videoUrl: firstVideoUrl,
      }, {
        id: 'fb-second',
        title: 'Second Facebook clip',
        source: 'Facebook',
        sourceUrl: 'https://www.facebook.com/reel/second',
        videoUrl: secondVideoUrl,
      }],
    });

    await loadHarnessFeed(harness);
    harness.elements.feed.children[0].events.click();
    harness.elements.video.events.error();
    harness.elements.video.events.error();
    harness.elements.feed.children[1].events.click();
    harness.elements.video.events.error();

    expect(harness.assignedSources).toEqual([
      firstVideoUrl,
      'http://84.8.220.24:8000/play?mode=redirect&url=https%3A%2F%2Fwww.facebook.com%2Freel%2Ffirst&api_key=299145bbcefca5e3dd0f193dc6d187b0',
      'http://84.8.220.24:8000/play?mode=proxy&url=https%3A%2F%2Fwww.facebook.com%2Freel%2Ffirst&api_key=299145bbcefca5e3dd0f193dc6d187b0',
      secondVideoUrl,
      'http://84.8.220.24:8000/play?mode=redirect&url=https%3A%2F%2Fwww.facebook.com%2Freel%2Fsecond&api_key=299145bbcefca5e3dd0f193dc6d187b0',
    ]);
  });

  it('ignores stale video errors after the player closes', async () => {
    var harness = createInjectHarness([undefined]);

    await loadHarnessFeed(harness);
    harness.elements.feed.children[0].events.click();
    var errorHandler = harness.elements.video.events.error;
    harness.keydown('Escape');

    expect(function () { errorHandler(); }).not.toThrow();
    expect(harness.assignedSources).toEqual([
      'https://video.xx.fbcdn.net/v/t42.1790-2/video.mp4',
    ]);
  });

  it('does not auto-play the initial feed load', async () => {
    var harness = createInjectHarness([undefined]);

    await loadHarnessFeed(harness);

    expect(harness.elements.feed.children.length).toBe(1);
    expect(harness.assignedSources).toEqual([]);
    expect(harness.elements.video.playCalls).toBe(0);
  });

  it('does not replace a feed request that has been pending for only five seconds', async () => {
    var first = deferred();
    var second = deferred();
    var videoUrl = 'https://video.xx.fbcdn.net/v/t42.1790-2/pending.mp4';
    var harness = createInjectHarness([undefined], {
      feedResponses: [first, second],
    });

    harness.windowEvents.load();
    await flushPromises();
    harness.advanceTime(5000);
    harness.poll();

    expect(harness.fetchCalls.filter(function (url) { return url.indexOf('/feed?') !== -1; })).toHaveLength(1);

    first.resolve(feedResponse([{
      id: 'fb-pending',
      title: 'Pending Facebook clip',
      source: 'Facebook',
      sourceUrl: 'https://www.facebook.com/reel/pending',
      videoUrl: videoUrl,
      duration: 7,
      resolvedAt: '2026-07-13T00:03:00.000Z',
    }]));
    await flushPromises();

    expect(harness.elements.feed.children[0].children[1].children[0].textContent).toBe('Pending Facebook clip');
  });

  it('auto-plays the first video after an empty initial poll', async () => {
    var firstVideoUrl = 'https://video.xx.fbcdn.net/v/t42.1790-2/first.mp4';
    var snapshots = [[], [{
      id: 'fb-first',
      title: 'First Facebook clip',
      source: 'Facebook',
      sourceUrl: 'https://www.facebook.com/reel/first',
      videoUrl: firstVideoUrl,
      duration: 8,
      resolvedAt: '2026-07-13T00:02:00.000Z',
    }]];
    var feedIndex = 0;
    var harness = createInjectHarness([undefined], {
      feedItems: function () {
        return snapshots[Math.min(feedIndex++, snapshots.length - 1)];
      },
    });

    await loadHarnessFeed(harness);
    harness.poll();
    await flushPromises();

    expect(harness.assignedSources).toEqual([firstVideoUrl]);
    expect(harness.elements.video.playCalls).toBe(1);
  });

  it('auto-plays a new top feed item when the player is idle', async () => {
    var oldSourceUrl = 'https://www.facebook.com/reel/old';
    var oldVideoUrl = 'https://video.xx.fbcdn.net/v/t42.1790-2/old.mp4';
    var newSourceUrl = 'https://www.facebook.com/reel/new';
    var newVideoUrl = 'https://video.xx.fbcdn.net/v/t42.1790-2/new.mp4';
    var snapshots = [
      [{
        id: 'fb-old',
        title: 'Old Facebook clip',
        source: 'Facebook',
        sourceUrl: oldSourceUrl,
        videoUrl: oldVideoUrl,
        duration: 12,
        resolvedAt: '2026-07-13T00:00:00.000Z',
      }],
      [{
        id: 'fb-new',
        title: 'New Facebook clip',
        source: 'Facebook',
        sourceUrl: newSourceUrl,
        videoUrl: newVideoUrl,
        duration: 10,
        resolvedAt: '2026-07-13T00:01:00.000Z',
      }, {
        id: 'fb-old',
        title: 'Old Facebook clip',
        source: 'Facebook',
        sourceUrl: oldSourceUrl,
        videoUrl: oldVideoUrl,
        duration: 12,
        resolvedAt: '2026-07-13T00:00:00.000Z',
      }],
    ];
    var feedIndex = 0;
    var harness = createInjectHarness([undefined], {
      feedItems: function () {
        return snapshots[Math.min(feedIndex++, snapshots.length - 1)];
      },
    });

    await loadHarnessFeed(harness);
    harness.poll();
    await flushPromises();

    expect(harness.assignedSources).toEqual([newVideoUrl]);
    expect(harness.elements.video.playCalls).toBe(1);
  });

  it('does not interrupt an already-open player for a new top feed item', async () => {
    var oldSourceUrl = 'https://www.facebook.com/reel/old';
    var oldVideoUrl = 'https://video.xx.fbcdn.net/v/t42.1790-2/old.mp4';
    var newSourceUrl = 'https://www.facebook.com/reel/new';
    var newVideoUrl = 'https://video.xx.fbcdn.net/v/t42.1790-2/new.mp4';
    var snapshots = [
      [{
        id: 'fb-old',
        title: 'Old Facebook clip',
        source: 'Facebook',
        sourceUrl: oldSourceUrl,
        videoUrl: oldVideoUrl,
        duration: 12,
        resolvedAt: '2026-07-13T00:00:00.000Z',
      }],
      [{
        id: 'fb-new',
        title: 'New Facebook clip',
        source: 'Facebook',
        sourceUrl: newSourceUrl,
        videoUrl: newVideoUrl,
        duration: 10,
        resolvedAt: '2026-07-13T00:01:00.000Z',
      }, {
        id: 'fb-old',
        title: 'Old Facebook clip',
        source: 'Facebook',
        sourceUrl: oldSourceUrl,
        videoUrl: oldVideoUrl,
        duration: 12,
        resolvedAt: '2026-07-13T00:00:00.000Z',
      }],
    ];
    var feedIndex = 0;
    var harness = createInjectHarness([undefined], {
      feedItems: function () {
        return snapshots[Math.min(feedIndex++, snapshots.length - 1)];
      },
    });

    await loadHarnessFeed(harness);
    harness.elements.feed.children[0].events.click();
    await flushPromises();
    harness.poll();
    await flushPromises();

    expect(harness.assignedSources).toEqual([oldVideoUrl]);
    expect(harness.elements.video.playCalls).toBe(1);
  });

  it('ignores a pending resolver callback after the player is closed', async () => {
    var resolveDeferred = deferred();
    var resolvedUrl = 'https://video.xx.fbcdn.net/v/t42.1790-2/late.mp4';
    var harness = createInjectHarness([undefined], {
      feedItems: [{
        id: 'fb-late',
        title: 'Late resolving clip',
        source: 'Facebook',
        sourceUrl: 'https://www.facebook.com/reel/late',
        videoUrl: 'https://www.facebook.com/reel/late',
        duration: 9,
        resolvedAt: '',
      }],
      resolveResponse: resolveDeferred.promise,
    });

    await loadHarnessFeed(harness);
    harness.elements.feed.children[0].events.click();
    harness.keydown('Escape');
    resolveDeferred.resolve({
      ok: true,
      json: function () {
        return Promise.resolve({ ok: true, resolved: { videoUrl: resolvedUrl } });
      },
    });
    await flushPromises();

    expect(harness.assignedSources).toEqual([]);
    expect(harness.elements.video.playCalls).toBe(0);
  });

  it('ignores older overlapping feed responses after a newer response renders', async () => {
    var older = deferred();
    var newer = deferred();
    var oldVideoUrl = 'https://video.xx.fbcdn.net/v/t42.1790-2/older.mp4';
    var newVideoUrl = 'https://video.xx.fbcdn.net/v/t42.1790-2/newer.mp4';
    var harness = createInjectHarness([undefined], {
      feedResponses: [older, newer],
    });

    harness.windowEvents.load();
    harness.advanceTime(30000);
    harness.poll();
    newer.resolve(feedResponse([{
      id: 'fb-newer',
      title: 'Newer Facebook clip',
      source: 'Facebook',
      sourceUrl: 'https://www.facebook.com/reel/newer',
      videoUrl: newVideoUrl,
      duration: 7,
      resolvedAt: '2026-07-13T00:03:00.000Z',
    }]));
    await flushPromises();

    expect(harness.elements.feed.children[0].children[1].children[0].textContent).toBe('Newer Facebook clip');

    older.resolve(feedResponse([{
      id: 'fb-older',
      title: 'Older Facebook clip',
      source: 'Facebook',
      sourceUrl: 'https://www.facebook.com/reel/older',
      videoUrl: oldVideoUrl,
      duration: 11,
      resolvedAt: '2026-07-13T00:01:00.000Z',
    }]));
    await flushPromises();

    expect(harness.elements.feed.children[0].children[1].children[0].textContent).toBe('Newer Facebook clip');
    expect(harness.elements.status.textContent).toBe('1 video');
  });

  it('guards playback and feed requests with request ids', () => {
    var source = readFileSync(resolve(root, 'src/inject.ts'), 'utf8');

    expect(source).toContain('playRequestId');
    expect(source).toContain('feedRequestId');
    expect(source).toContain('requestId !== playRequestId');
    expect(source).toContain('requestId !== feedRequestId');
  });

  it('handles expected TV remote keys', () => {
    var source = readFileSync(resolve(root, 'src/inject.ts'), 'utf8');

    expect(source).toContain('ArrowDown');
    expect(source).toContain('ArrowUp');
    expect(source).toContain('Enter');
    expect(source).toContain('MediaPlayPause');
    expect(source).toContain('Escape');
  });

  it('registers the red remote key when the Tizen API is available', async () => {
    var harness = createInjectHarness([undefined]);

    await loadHarnessFeed(harness);

    expect(harness.registeredKeys).toEqual(['ColorF0Red']);
  });
});
