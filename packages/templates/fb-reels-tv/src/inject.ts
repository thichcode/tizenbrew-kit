(function () {
  var WORKER_URL = 'https://shortvideo-feed.dvt-kisu.workers.dev';
  var FALLBACK_RESOLVER_URL = 'http://84.8.220.24:8000';
  var FALLBACK_API_KEY = '299145bbcefca5e3dd0f193dc6d187b0';
  var POLL_INTERVAL = 5000;
  var items = [];
  var selectedIndex = 0;
  var isPlayerOpen = false;
  var loadTimeout = null;
  var pollTimer = null;
  var lastSeenTopItemId = '';
  var hasLoadedInitialFeed = false;
  var playRequestId = 0;
  var feedRequestId = 0;
  var feedRequestInFlight = false;
  var feedRequestStartedAt = 0;

  var statusEl = document.getElementById('status');
  var feedEl = document.getElementById('feed');
  var emptyEl = document.getElementById('empty');
  var errorEl = document.getElementById('error');
  var helpEl = document.getElementById('help');
  var playerEl = document.getElementById('player');
  var playerLoadingEl = document.getElementById('player-loading');
  var video = document.getElementById('video');
  var playerTitleEl = document.getElementById('player-title');
  var setupEl = document.getElementById('setup');
  var setupCodeEl = document.getElementById('setup-code');
  var setupQrEl = document.getElementById('setup-qr');
  var setupUrlEl = document.getElementById('setup-url');
  var appEl = document.getElementById('app');

  function deviceCode() {
    var key = 'shortvideo_device_code';
    var code = localStorage.getItem(key);
    if (!code) {
      code = 'TV' + Math.random().toString(36).slice(2, 8).toUpperCase();
      localStorage.setItem(key, code);
    }
    return code;
  }

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message;
  }

  function showError(message) {
    if (errorEl) {
      errorEl.style.display = 'block';
      errorEl.textContent = message;
    }
  }

  function showPlaybackError(message) {
    showError(message);
    clearTimeout(loadTimeout);
    if (playerLoadingEl) {
      playerLoadingEl.style.display = 'block';
      playerLoadingEl.style.color = '#e94560';
      playerLoadingEl.textContent = message;
    }
  }

  function clearError() {
    if (errorEl) {
      errorEl.style.display = 'none';
      errorEl.textContent = '';
    }
  }

  function resolveItem(item, callback) {
    if (item.source === 'Facebook') {
      setFacebookFallbacks(item);
      if (isPreResolvedFacebook(item)) {
        callback(item);
        return;
      }

      fetch(FALLBACK_RESOLVER_URL + '/resolve?url=' + encodeURIComponent(item.sourceUrl), {
        headers: { 'X-API-Key': FALLBACK_API_KEY }
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.ok && data.resolved) {
            if (data.resolved.videoUrl) {
              item.videoUrl = data.resolved.videoUrl;
            } else {
              item.videoUrl = item._redirectUrl;
            }
            if (data.resolved.title) {
              item.title = data.resolved.title;
              updateItemTitleInDom(item.id, data.resolved.title);
            }
          } else {
            item.videoUrl = item._redirectUrl;
          }
          callback(item);
        })
        .catch(function () {
          item.videoUrl = item._redirectUrl;
          callback(item);
        });
      return;
    }

    if (item.source === 'Bilibili') {
      setBilibiliFallbacks(item);
      if (isPreResolvedBilibili(item)) {
        callback(item);
        return;
      }

      fetch(FALLBACK_RESOLVER_URL + '/resolve?url=' + encodeURIComponent(item.sourceUrl), {
        headers: { 'X-API-Key': FALLBACK_API_KEY }
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.ok && data.resolved) {
            if (data.resolved.videoUrl) {
              item.videoUrl = data.resolved.videoUrl;
            } else {
              item.videoUrl = item._redirectUrl;
            }
            if (data.resolved.title) {
              item.title = data.resolved.title;
              updateItemTitleInDom(item.id, data.resolved.title);
            }
          } else {
            item.videoUrl = item._redirectUrl;
          }
          callback(item);
        })
        .catch(function () {
          item.videoUrl = item._redirectUrl;
          callback(item);
        });
      return;
    }

    callback(item);
  }

  function isHttpUrl(value) {
    return typeof value === 'string' && /^https?:\/\//.test(value);
  }

  function buildFacebookPlayUrl(sourceUrl, mode) {
    return FALLBACK_RESOLVER_URL + '/play?mode=' + mode + '&url=' + encodeURIComponent(sourceUrl) + '&api_key=' + encodeURIComponent(FALLBACK_API_KEY);
  }

  function buildBilibiliPlayUrl(sourceUrl, mode) {
    return FALLBACK_RESOLVER_URL + '/play?mode=' + mode + '&url=' + encodeURIComponent(sourceUrl) + '&api_key=' + encodeURIComponent(FALLBACK_API_KEY);
  }

  function setFacebookFallbacks(item) {
    item._redirectUrl = buildFacebookPlayUrl(item.sourceUrl, 'redirect');
    item._proxyUrl = buildFacebookPlayUrl(item.sourceUrl, 'proxy');
  }

  function setBilibiliFallbacks(item) {
    item._redirectUrl = buildBilibiliPlayUrl(item.sourceUrl, 'redirect');
    item._proxyUrl = buildBilibiliPlayUrl(item.sourceUrl, 'proxy');
  }

  function isPreResolvedFacebook(item) {
    return item && item.source === 'Facebook' && item.sourceUrl && item.videoUrl && item.videoUrl !== item.sourceUrl;
  }

  function isPreResolvedBilibili(item) {
    return item && item.source === 'Bilibili' && item.sourceUrl && item.videoUrl && item.videoUrl !== item.sourceUrl;
  }

  function updateItemTitleInDom(itemId, newTitle) {
    if (!feedEl) return;
    var nodes = feedEl.querySelectorAll('.item');
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].getAttribute('data-id') === itemId) {
        var titleEl = nodes[i].querySelector('.item-title');
        if (titleEl) titleEl.textContent = newTitle;
        break;
      }
    }
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
          item.source !== 'TikTok' &&
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
          resolvedAt: typeof item.resolvedAt === 'string' ? item.resolvedAt : '',
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

    if (setupEl) setupEl.style.display = 'none';
    if (feedEl) feedEl.style.display = 'flex';
    feedEl.style.flexDirection = 'column';
    if (helpEl) helpEl.style.display = 'block';

    items.forEach(function (item, index) {
      var node = document.createElement('div');
      node.className = 'item';
      node.tabIndex = 0;
      node.setAttribute('data-index', String(index));
      node.setAttribute('data-id', item.id);

      var idx = document.createElement('span');
      idx.className = 'item-idx';
      idx.textContent = String(index + 1);

      var info = document.createElement('div');
      info.className = 'item-info';

      var title = document.createElement('div');
      title.className = 'item-title';
      title.textContent = item.title || '(untitled)';

      var url = document.createElement('div');
      url.className = 'item-url';
      url.textContent = item.sourceUrl || item.videoUrl;

      info.appendChild(title);
      info.appendChild(url);

      var badge = document.createElement('span');
      badge.className = 'item-badge badge-' + item.source.toLowerCase();
      badge.textContent = item.source;

      node.appendChild(idx);
      node.appendChild(info);
      node.appendChild(badge);
      node.addEventListener('click', function () {
        selectedIndex = index;
        playItem(item);
      });
      feedEl.appendChild(node);
    });

    selectedIndex = 0;
    setTimeout(focusSelected, 60);
    if (!isPlayerOpen) resolveTitlesInBackground();
  }

  function resolveTitlesInBackground() {
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item.source !== 'Facebook' && item.source !== 'Bilibili') continue;
      if (item.title !== 'Facebook Reel' && item.title !== 'Bilibili Video' && item.title !== '(untitled)') continue;
      (function (idx) {
        fetch(FALLBACK_RESOLVER_URL + '/resolve?url=' + encodeURIComponent(item.sourceUrl), {
          headers: { 'X-API-Key': FALLBACK_API_KEY }
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data.ok && data.resolved && data.resolved.title) {
              items[idx].title = data.resolved.title;
              updateItemTitleInDom(items[idx].id, data.resolved.title);
            }
          })
          .catch(function () {});
      })(i);
    }
  }

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

  function showSetup() {
    var code = deviceCode();
    if (setupCodeEl) setupCodeEl.textContent = code;
    if (setupUrlEl) setupUrlEl.textContent = WORKER_URL + '/setup?code=' + code;
    if (setupQrEl) setupQrEl.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(WORKER_URL + '/setup?code=' + code);
    if (setupEl) setupEl.style.display = 'block';
    if (feedEl) feedEl.style.display = 'none';
    if (helpEl) helpEl.style.display = 'none';
  }

  var mediaAttemptId = 0;
  var currentMediaErrorHandler = null;
  var currentMediaLoadStartHandler = null;
  var mediaLoadStartedAttemptId = 0;
  var failedMediaAttemptId = 0;
  var pendingMediaFailureTimer = null;
  var mediaFailureScheduleId = 0;

  function closePlayer() {
    isPlayerOpen = false;
    playRequestId += 1;
    mediaAttemptId += 1;
    mediaFailureScheduleId += 1;
    if (pendingMediaFailureTimer) {
      clearTimeout(pendingMediaFailureTimer);
      pendingMediaFailureTimer = null;
    }
    clearTimeout(loadTimeout);
    if (playerEl) playerEl.classList.remove('active');
    if (playerLoadingEl) playerLoadingEl.style.display = 'none';
    if (video) {
      if (currentMediaErrorHandler) {
        video.removeEventListener('error', currentMediaErrorHandler);
        currentMediaErrorHandler = null;
      }
      if (currentMediaLoadStartHandler) {
        video.removeEventListener('loadstart', currentMediaLoadStartHandler);
        currentMediaLoadStartHandler = null;
      }
      try { video.pause(); } catch (_) {}
      video.removeAttribute('src');
      try { video.load(); } catch (_) {}
    }
    if (helpEl) helpEl.style.display = 'block';
    setTimeout(focusSelected, 60);
  }

  var sourceFallbackStage = 0;

  function handleMediaAttemptFailure(item, requestId, attemptId, error) {
    if (!isPlayerOpen || requestId !== playRequestId || attemptId !== mediaAttemptId) return;

    var isSourceError = error && typeof error.code === 'number';
    if (failedMediaAttemptId === attemptId) {
      if (!isSourceError || !pendingMediaFailureTimer) return;
      clearTimeout(pendingMediaFailureTimer);
      pendingMediaFailureTimer = null;
      mediaFailureScheduleId += 1;
    } else {
      failedMediaAttemptId = attemptId;
    }

    if (!isSourceError) {
      var scheduleId = ++mediaFailureScheduleId;
      pendingMediaFailureTimer = setTimeout(function () {
        if (!isPlayerOpen || requestId !== playRequestId || attemptId !== mediaAttemptId || scheduleId !== mediaFailureScheduleId) return;
        pendingMediaFailureTimer = null;
        if (tryNextFallback(item, requestId)) return;
        showPlaybackError('Cannot play: ' + (error && error.message ? error.message : 'format not supported'));
      }, 0);
      return;
    }

    if (tryNextFacebookFallback(item, requestId)) return;
    var code = error.code || 0;
    var msg = 'Unknown error';
    if (code === 1) msg = 'Video load aborted';
    else if (code === 2) msg = 'Network error';
    else if (code === 3) msg = 'Decoding failed (codec not supported)';
    else if (code === 4) msg = 'Format not supported on this TV';
    showPlaybackError('Playback error: ' + msg + ' (code ' + code + ')');
  }

  function startMediaAttempt(item, requestId, sourceUrl, shouldPlay) {
    var androidBridge = window.AndroidBridge;
    if (androidBridge && typeof androidBridge.openVideo === 'function') {
      var androidUrl = sourceUrl;
      if (item && item.source === 'Bilibili' && item._proxyUrl) {
        androidUrl = item._proxyUrl;
      }
      androidBridge.openVideo(androidUrl, item && item.title || '');
      return;
    }

    var attemptId = ++mediaAttemptId;
    mediaFailureScheduleId += 1;
    if (pendingMediaFailureTimer) {
      clearTimeout(pendingMediaFailureTimer);
      pendingMediaFailureTimer = null;
    }
    if (currentMediaErrorHandler) video.removeEventListener('error', currentMediaErrorHandler);
    if (currentMediaLoadStartHandler) video.removeEventListener('loadstart', currentMediaLoadStartHandler);

    mediaLoadStartedAttemptId = 0;
    currentMediaLoadStartHandler = function () {
      if (!isPlayerOpen || requestId !== playRequestId || attemptId !== mediaAttemptId) return;
      var activeSource = video.currentSrc || video.src;
      if (activeSource && activeSource !== sourceUrl) return;
      mediaLoadStartedAttemptId = attemptId;
    };

    currentMediaErrorHandler = function () {
      if (!isPlayerOpen || requestId !== playRequestId || attemptId !== mediaAttemptId) return;
      if (mediaLoadStartedAttemptId !== attemptId) return;
      var activeSource = video.currentSrc || video.src;
      if (activeSource !== sourceUrl) return;
      handleMediaAttemptFailure(item, requestId, attemptId, video.error || { code: 0 });
    };
    video.addEventListener('loadstart', currentMediaLoadStartHandler);
    video.addEventListener('error', currentMediaErrorHandler);
    video.src = sourceUrl;
    video.load();

    if (!shouldPlay) return;
    var result = video.play();
    if (result && result.catch) {
      result.catch(function (err) {
        handleMediaAttemptFailure(item, requestId, attemptId, err);
      });
    }
  }

  function tryNextFallback(item, requestId) {
    if (!isPlayerOpen || requestId !== playRequestId || !item) return false;
    if (item.source !== 'Facebook' && item.source !== 'Bilibili') return false;

    var fallbackUrl;
    if (sourceFallbackStage === 0) {
      fallbackUrl = item._redirectUrl;
      if (playerLoadingEl) {
        playerLoadingEl.style.display = 'block';
        playerLoadingEl.style.color = '#888';
        playerLoadingEl.textContent = 'Refreshing video URL...';
      }
    } else if (sourceFallbackStage === 1) {
      fallbackUrl = item._proxyUrl;
      if (playerLoadingEl) {
        playerLoadingEl.style.display = 'block';
        playerLoadingEl.style.color = '#888';
        playerLoadingEl.textContent = 'Retrying via proxy...';
      }
    } else {
      return false;
    }
    if (!fallbackUrl) return false;

    sourceFallbackStage += 1;
    startMediaAttempt(item, requestId, fallbackUrl, true);
    return true;
  }

  function playItem(item) {
    clearError();
    isPlayerOpen = true;
    var requestId = ++playRequestId;
    sourceFallbackStage = 0;
    if (playerEl) playerEl.classList.add('active');
    if (playerLoadingEl) {
      playerLoadingEl.style.display = 'block';
      playerLoadingEl.style.color = '#888';
      playerLoadingEl.textContent = 'Loading...';
    }

    if (!video) return;

    loadTimeout = setTimeout(function () {
      if (playerLoadingEl) playerLoadingEl.textContent = 'Still loading... check server';
    }, 15000);

    resolveItem(item, function (resolved) {
      if (!isPlayerOpen || requestId !== playRequestId) return;
      if ((resolved.source === 'Facebook' || resolved.source === 'Bilibili') && resolved.videoUrl === resolved._redirectUrl) sourceFallbackStage = 1;
      if (playerTitleEl) playerTitleEl.textContent = resolved.title;
      video.autoplay = true;
      video.controls = false;
      startMediaAttempt(resolved, requestId, resolved.videoUrl, true);
    });
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
    403: 'Red',
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

    if (key === 'Red') {
      event.preventDefault();
      if (items.length && confirm('Clear all videos?')) {
        var code = deviceCode();
        fetch(WORKER_URL + '/feed?code=' + encodeURIComponent(code), { method: 'DELETE' })
          .then(function () {
            items = [];
            renderFeed();
            showSetup();
            setStatus('Feed cleared');
          });
      }
    }
  }

  function fetchFeed() {
    var now = Date.now();
    if (feedRequestInFlight && now - feedRequestStartedAt < 30000) return;
    var requestId = ++feedRequestId;
    feedRequestInFlight = true;
    feedRequestStartedAt = now;
    var code = deviceCode();
    var url = WORKER_URL + '/feed?code=' + encodeURIComponent(code);

    fetch(url, { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        if (requestId !== feedRequestId) return;
        feedRequestInFlight = false;
        var parsed = parseFeed(data);
        var previousTopItemId = items.length && items[0] ? items[0].id : '';
        if (!hasLoadedInitialFeed && !parsed.length) {
          hasLoadedInitialFeed = true;
          lastSeenTopItemId = '';
        }
        if (parsed.length || items.length) {
          items = parsed;
          setStatus(parsed.length + ' video' + (parsed.length > 1 ? 's' : ''));
          renderFeed();
          maybeAutoPlayLatest(previousTopItemId);
        }
        if (!items.length) {
          showSetup();
          setStatus('Waiting for videos...');
        }
      })
      .catch(function () {
        if (requestId !== feedRequestId) return;
        feedRequestInFlight = false;
        if (!items.length) {
          showSetup();
          setStatus('Cannot reach server');
        }
      });
  }

  function startPolling() {
    fetchFeed();
    pollTimer = setInterval(fetchFeed, POLL_INTERVAL);
  }

  function registerRemoteKeys() {
    try {
      if (window.tizen && window.tizen.tvinputdevice && window.tizen.tvinputdevice.registerKey) {
        window.tizen.tvinputdevice.registerKey('ColorF0Red');
      }
    } catch (_) {}
  }

  function startApp() {
    registerRemoteKeys();
    startPolling();
  }

  if (video) {
    video.addEventListener('playing', function () {
      clearTimeout(loadTimeout);
      if (playerLoadingEl) playerLoadingEl.style.display = 'none';
    });
    video.addEventListener('ended', function () {
      moveSelection(1);
      var item = selectedItem();
      if (item) playItem(item);
    });
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && isPlayerOpen) closePlayer();
  });

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('load', startApp);

  console.info('[shortvideo-tv] setup + feed player loaded');
})();
