(function () {
  var WORKER_URL = 'https://shortvideo-feed.dvt-kisu.workers.dev';
  var FALLBACK_RESOLVER_URL = 'https://find-football-tizenbrew.onrender.com';
  var FALLBACK_API_KEY = '299145bbcefca5e3dd0f193dc6d187b0';
  var POLL_INTERVAL = 5000;
  var SUGGEST_POLL_INTERVAL = 10000;
  var items = [];
  var suggestions = [];
  var selectedIndex = 0;
  var isPlayerOpen = false;
  var loadTimeout = null;
  var pollTimer = null;
  var suggestPollTimer = null;
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
  var seekBarFill = document.getElementById('seek-bar-fill');
  var seekIndicator = document.getElementById('seek-indicator');
  var setupEl = document.getElementById('setup');
  var setupCodeEl = document.getElementById('setup-code');
  var setupQrEl = document.getElementById('setup-qr');
  var setupUrlEl = document.getElementById('setup-url');
  var feedConnectEl = document.getElementById('feed-connect');
  var feedConnectCodeEl = document.getElementById('feed-connect-code');
  var feedConnectQrEl = document.getElementById('feed-connect-qr');
  var feedConnectUrlEl = document.getElementById('feed-connect-url');
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
      callback(item);
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

    if (feedConnectEl) {
      var code = deviceCode();
      if (feedConnectCodeEl) feedConnectCodeEl.textContent = code;
      if (feedConnectQrEl) feedConnectQrEl.src = 'https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=' + encodeURIComponent(WORKER_URL + '/setup?code=' + code);
      if (feedConnectUrlEl) feedConnectUrlEl.textContent = WORKER_URL + '/setup?code=' + code;
      feedConnectEl.style.display = 'block';
    }

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

  function fetchSuggestions() {
    fetch(WORKER_URL + '/suggestions?code=' + deviceCode())
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.items && data.items.length) {
          suggestions = data.items.filter(function (it) {
            return it && typeof it.sourceUrl === 'string' && /^https?:\/\//.test(it.sourceUrl);
          });
        } else {
          suggestions = [];
        }
        renderSuggestions();
      })
      .catch(function () {});
  }

  function renderSuggestions() {
    var el = document.getElementById('suggestions');
    if (!el) return;
    if (!suggestions.length) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = '<div class="suggest-title">Suggestions (' + suggestions.length + ')</div>';
    suggestions.forEach(function (item, index) {
      var node = document.createElement('div');
      node.className = 'suggest-item';
      node.tabIndex = 0;

      var title = document.createElement('span');
      title.className = 'suggest-item-title';
      title.textContent = item.title || item.sourceUrl.slice(0, 50);

      var addBtn = document.createElement('button');
      addBtn.className = 'suggest-add-btn';
      addBtn.textContent = 'Add';
      addBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        addToFeed(item);
      });

      node.appendChild(title);
      node.appendChild(addBtn);
      node.addEventListener('click', function () {
        playSuggestion(item);
      });
      el.appendChild(node);
    });
  }

  function addToFeed(suggestItem) {
    fetch(WORKER_URL + '/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: deviceCode(),
        url: suggestItem.sourceUrl,
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) {
          suggestions = suggestions.filter(function (s) { return s.sourceUrl !== suggestItem.sourceUrl; });
          renderSuggestions();
          fetchFeed();
        }
      })
      .catch(function () {});
  }

  function playSuggestion(item) {
    var sItem = {
      id: 'suggest_' + Date.now(),
      title: item.title || 'Suggested Reel',
      source: 'Facebook',
      sourceUrl: item.sourceUrl,
      videoUrl: item.sourceUrl,
      thumbnailUrl: '',
      duration: 0,
    };
    playItem(sItem);
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
    if (feedConnectEl) feedConnectEl.style.display = 'none';
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
    stallCount = 0;
    stopNetStats();
    avStopTick();
    if (useAv) { avCloseQuiet(); useAv = false; }
    if (video) { try { video.style.display = ''; } catch (_) {} }
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
  var stallCount = 0;
  var netStatsEl = null;
  var netStatsTimer = null;
  var lastBufEnd = -1;
  var lastBufTs = 0;
  var intakeEma = 0;

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

    if (tryNextFallback(item, requestId)) return;
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
      if (item && item.source === 'Bilibili' && item.sourceUrl) {
        androidUrl = FALLBACK_RESOLVER_URL + '/dash?url=' + encodeURIComponent(item.sourceUrl) + '&api_key=' + encodeURIComponent(FALLBACK_API_KEY);
      } else if (item && item.source === 'Facebook' && item._redirectUrl) {
        // Feed items carry the CDN URL resolved at submit time. Signed fbcdn
        // links expire, and the APK has no fallback chain, so a stale link
        // just times out. Always resolve fresh through the redirect endpoint.
        androidUrl = item._redirectUrl;
      }
      androidBridge.openVideo(androidUrl, item && item.title || '');
      return;
    }

    if (item && item.source === 'Bilibili') {
      showPlaybackError('Bilibili requires Android TV');
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
    // Assigning src already runs the resource selection algorithm; calling
    // load() on top of it restarts selection and opens a second connection.
    video.src = sourceUrl;

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
    if (item.source === 'Bilibili') return false;

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

  var APP_VERSION = '1.2.15';
  var useAv = false;
  var avObjEl = null;
  var avPrepareTimer = null;
  var avTickTimer = null;
  var avCurSec = 0;
  var avDurSec = 0;
  var avPaused = true;

  function avApi() {
    try {
      if (typeof window !== 'undefined' && window.webapis && window.webapis.avplay) {
        return window.webapis.avplay;
      }
    } catch (_) {}
    return null;
  }

  function avCloseQuiet() {
    var api = avApi();
    if (!api) return;
    try { api.stop(); } catch (_) {}
    try { api.close(); } catch (_) {}
  }

  function avStopTick() {
    if (avTickTimer) { try { clearInterval(avTickTimer); } catch (_) {} avTickTimer = null; }
    if (avPrepareTimer) { try { clearTimeout(avPrepareTimer); } catch (_) {} avPrepareTimer = null; }
  }

  function avEnsureObject() {
    if (avObjEl) return true;
    try {
      var el = document.createElement('object');
      el.setAttribute('type', 'application/avplayer');
      el.setAttribute('id', 'av-player-obj');
      el.style.position = 'absolute';
      el.style.left = '0px';
      el.style.top = '0px';
      el.style.width = '0px';
      el.style.height = '0px';
      (document.body || playerEl).appendChild(el);
      avObjEl = el;
      return true;
    } catch (_) {
      return false;
    }
  }

  function avFallbackToHtml(item, requestId, sourceUrl) {
    if (!isPlayerOpen || requestId !== playRequestId) return;
    avStopTick();
    avCloseQuiet();
    if (useAv) avSupport = 'fail';
    useAv = false;
    if (video) { try { video.style.display = ''; } catch (_) {} }
    if (playerLoadingEl) {
      playerLoadingEl.style.display = 'block';
      playerLoadingEl.style.color = '#888';
      playerLoadingEl.textContent = 'Loading...';
    }
    startMediaAttempt(item, requestId, sourceUrl, true);
  }

  function avStart(item, requestId, sourceUrl) {
    var api = avApi();
    if (!api) {
      avSupport = 'no';
      return false;
    }
    if (!avEnsureObject()) {
      avSupport = 'fail';
      return false;
    }
    avSupport = 'yes';
    try {
      avCloseQuiet();
      var w = 1920;
      var h = 1080;
      try {
        if (window.innerWidth > 0) w = window.innerWidth;
        if (window.innerHeight > 0) h = window.innerHeight;
      } catch (_) {}
      api.open(sourceUrl);
      api.setDisplayRect(0, 0, w, h);
      api.setListener({
        onbufferingstart: function () {
          if (playerLoadingEl && isPlayerOpen && requestId === playRequestId) {
            playerLoadingEl.style.display = 'block';
            playerLoadingEl.style.color = '#888';
            playerLoadingEl.textContent = 'Buffering...';
          }
        },
        onbufferingcomplete: function () {
          if (playerLoadingEl && isPlayerOpen && requestId === playRequestId) {
            playerLoadingEl.style.display = 'none';
          }
        },
        oncurrentplaytime: function (t) {
          try { avCurSec = (t || 0) / 1000; } catch (_) {}
        },
        onstreamcompleted: function () {
          if (!isPlayerOpen || requestId !== playRequestId) return;
          moveSelection(1);
          var next = selectedItem();
          if (next) playItem(next);
        }
      });
      avCurSec = 0;
      avDurSec = 0;
      avPaused = true;
      useAv = true;
      if (video) { try { video.style.display = 'none'; } catch (_) {} }
      api.prepareAsync(function () {
        if (!isPlayerOpen || requestId !== playRequestId || !useAv) return;
        if (avPrepareTimer) { try { clearTimeout(avPrepareTimer); } catch (_) {} avPrepareTimer = null; }
        try { avDurSec = (api.getDuration() || 0) / 1000; } catch (_) {}
        try {
          api.play();
          avPaused = false;
        } catch (err) {
          avFallbackToHtml(item, requestId, sourceUrl);
          return;
        }
        if (playerLoadingEl) playerLoadingEl.style.display = 'none';
        if (loadTimeout) clearTimeout(loadTimeout);
        try {
          avTickTimer = setInterval(avTick, 500);
        } catch (_) {
          avTickTimer = null;
        }
      }, function () {
        avFallbackToHtml(item, requestId, sourceUrl);
      });
      avPrepareTimer = setTimeout(function () {
        avFallbackToHtml(item, requestId, sourceUrl);
      }, 15000);
      return true;
    } catch (_) {
      avSupport = 'fail';
      try { avCloseQuiet(); } catch (_) {}
      return false;
    }
  }

  function avTick() {
    if (!isPlayerOpen || !useAv) return;
    var api = avApi();
    if (!api) return;
    try { avCurSec = (api.getCurrentTime() || 0) / 1000; } catch (_) {}
    try {
      var d = (api.getDuration() || 0) / 1000;
      if (isFinite(d) && d > 0) avDurSec = d;
    } catch (_) {}
    updateSeekBar();
  }

  function mediaCurSec() {
    if (useAv) return avCurSec || 0;
    try { return (video && video.currentTime) || 0; } catch (_) { return 0; }
  }

  function mediaDurSec() {
    if (useAv) return avDurSec || 0;
    try { return (video && video.duration) || 0; } catch (_) { return 0; }
  }

  function ensureNetStats() {
    if (netStatsEl || !playerEl) return;
    try {
      netStatsEl = document.createElement('div');
      netStatsEl.setAttribute('id', 'net-stats');
      var style = netStatsEl.style;
      style.position = 'absolute';
      style.left = '12px';
      style.bottom = '76px';
      style.background = 'rgba(0,0,0,0.65)';
      style.color = '#4caf50';
      style.fontSize = '12px';
      style.fontFamily = 'monospace';
      style.padding = '6px 10px';
      style.borderRadius = '6px';
      style.zIndex = '30';
      style.pointerEvents = 'none';
      netStatsEl.textContent = '...';
      playerEl.appendChild(netStatsEl);
    } catch (_) {
      netStatsEl = null;
    }
  }

  var avSupport = 'unknown';

  function avSupportLabel() {
    if (avSupport === 'yes') return 'AVPLAY-OK';
    if (avSupport === 'no') return 'AVPLAY-NONE';
    if (avSupport === 'fail') return 'AVPLAY-FAIL';
    return 'AVPLAY-?';
  }

  function updateNetStats() {
    if (!isPlayerOpen || !netStatsEl) return;
    var tag = 'v' + APP_VERSION + ' ' + avSupportLabel();
    if (useAv) {
      try {
        var c = avCurSec || 0;
        var d = avDurSec || 0;
        netStatsEl.style.color = '#4caf50';
        netStatsEl.textContent = tag + ' | T ' + c.toFixed(1) + 's/' + (d ? d.toFixed(1) + 's' : '?') + ' | stall ' + stallCount;
      } catch (_) {}
      return;
    }
    if (!video) return;
    try {
      var now = Date.now();
      var cur = video.currentTime || 0;
      var bufEnd = cur;
      if (video.buffered && video.buffered.length) {
        bufEnd = video.buffered.end(video.buffered.length - 1);
      }
      var ahead = Math.max(0, bufEnd - cur);
      if (lastBufTs > 0) {
        var dt = (now - lastBufTs) / 1000;
        if (dt > 0) {
          var rate = (bufEnd - lastBufEnd) / dt;
          if (rate >= 0 && rate < 10) {
            intakeEma = intakeEma < 0 ? rate : intakeEma * 0.7 + rate * 0.3;
          }
        }
      }
      lastBufEnd = bufEnd;
      lastBufTs = now;
      var dur = video.duration || 0;
      var full = isFinite(dur) && dur > 0 && bufEnd >= dur - 0.5;
      var bufText = full ? 'FULL' : (ahead > 999 ? '>999s' : ahead.toFixed(1) + 's');
      var inText = full ? '--' : (intakeEma < 0 ? '--' : intakeEma.toFixed(2) + 'x');
      var color = '#888';
      if (full || intakeEma >= 1) color = '#4caf50';
      else if (intakeEma >= 0.3) color = '#f0ad4e';
      else if (intakeEma >= 0) color = '#e94560';
      var res = (video.videoWidth || 0) + 'x' + (video.videoHeight || 0);
      netStatsEl.style.color = color;
      netStatsEl.textContent = tag + ' | BUF ' + bufText + ' | IN ' + inText + ' | ' + res + ' | stall ' + stallCount;
    } catch (_) {}
  }

  var NETSTATS_LS_KEY = 'shortvideo_netstats_off';
  var netStatsOff = false;
  try {
    netStatsOff = localStorage.getItem(NETSTATS_LS_KEY) === '1';
  } catch (_) {
    netStatsOff = false;
  }

  function startNetStats() {
    lastBufEnd = -1;
    lastBufTs = 0;
    intakeEma = -1;
    if (netStatsTimer) {
      try { clearInterval(netStatsTimer); } catch (_) {}
      netStatsTimer = null;
    }
    if (netStatsOff) {
      if (netStatsEl) netStatsEl.style.display = 'none';
      return;
    }
    ensureNetStats();
    if (netStatsEl) netStatsEl.style.display = 'block';
    try {
      netStatsTimer = setInterval(updateNetStats, 1000);
    } catch (_) {
      netStatsTimer = null;
    }
  }

  function toggleNetStats() {
    netStatsOff = !netStatsOff;
    try {
      localStorage.setItem(NETSTATS_LS_KEY, netStatsOff ? '1' : '0');
    } catch (_) {}
    if (netStatsOff) {
      if (netStatsTimer) {
        try { clearInterval(netStatsTimer); } catch (_) {}
        netStatsTimer = null;
      }
      if (netStatsEl) netStatsEl.style.display = 'none';
    } else {
      startNetStats();
      if (netStatsEl) netStatsEl.style.display = 'block';
    }
    if (playerTitleEl) {
      playerTitleEl.textContent = netStatsOff ? 'stats OFF (green to show)' : 'stats ON (green to hide)';
    }
    if (playerLoadingEl) playerLoadingEl.style.display = 'none';
  }

  function stopNetStats() {
    if (netStatsTimer) {
      try { clearInterval(netStatsTimer); } catch (_) {}
      netStatsTimer = null;
    }
    if (netStatsEl) {
      try {
        if (netStatsEl.parentNode) netStatsEl.parentNode.removeChild(netStatsEl);
      } catch (_) {}
      netStatsEl = null;
    }
  }

  function countStall() {
    if (!isPlayerOpen) return;
    stallCount += 1;
  }

  function playItem(item) {
    clearError();
    isPlayerOpen = true;
    var requestId = ++playRequestId;
    sourceFallbackStage = 0;
    stallCount = 0;
    avStopTick();
    if (useAv) { avCloseQuiet(); useAv = false; }
    if (video) { try { video.style.display = ''; } catch (_) {} }
    startNetStats();
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
      if (!avStart(resolved, requestId, resolved.videoUrl)) {
        startMediaAttempt(resolved, requestId, resolved.videoUrl, true);
      }
    });
  }

  function togglePlayback() {
    if (!video || !isPlayerOpen) return;
    if (useAv) {
      var api = avApi();
      if (!api) return;
      try {
        if (avPaused) { api.play(); avPaused = false; }
        else { api.pause(); avPaused = true; }
      } catch (_) {}
      return;
    }
    if (video.paused) {
      var result = video.play();
      if (result && result.catch) result.catch(function () {});
    } else {
      video.pause();
    }
  }

  var seekIndicatorTimer = null;
  function seekVideo(seconds) {
    if (!video || !isPlayerOpen) return;
    if (useAv) {
      var api = avApi();
      if (!api) return;
      var target = mediaCurSec() + seconds;
      if (target < 0) target = 0;
      var avDur = mediaDurSec();
      if (isFinite(avDur) && avDur > 0 && target > avDur) target = avDur;
      try {
        api.seekTo(Math.floor(target * 1000), function () {}, function () {});
      } catch (_) {}
      updateSeekBar();
      showSeekIndicator(seconds > 0 ? '+' + seconds + 's' : seconds + 's');
      return;
    }
    var target = video.currentTime + seconds;
    if (target < 0) target = 0;
    if (isFinite(video.duration) && target > video.duration) target = video.duration;
    video.currentTime = target;
    updateSeekBar();
    showSeekIndicator(seconds > 0 ? '+' + seconds + 's' : seconds + 's');
  }

  function updateSeekBar() {
    if (!seekBarFill) return;
    if (useAv) {
      var avDur = mediaDurSec();
      var avPct = avDur ? (mediaCurSec() / avDur) * 100 : 0;
      seekBarFill.style.width = avPct + '%';
      return;
    }
    if (!video) return;
    var pct = video.duration ? (video.currentTime / video.duration) * 100 : 0;
    seekBarFill.style.width = pct + '%';
  }

  function showSeekIndicator(text) {
    if (!seekIndicator) return;
    seekIndicator.textContent = text;
    seekIndicator.style.display = 'block';
    clearTimeout(seekIndicatorTimer);
    seekIndicatorTimer = setTimeout(function () {
      seekIndicator.style.display = 'none';
    }, 800);
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
    404: 'Green',
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
        return;
      }
      if (key === 'ArrowLeft') {
        event.preventDefault();
        seekVideo(-10);
        return;
      }
      if (key === 'ArrowRight') {
        event.preventDefault();
        seekVideo(10);
        return;
      }
      if (key === 'Green') {
        event.preventDefault();
        toggleNetStats();
        return;
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

    if (key === 'Green') {
      event.preventDefault();
      toggleNetStats();
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
    fetchSuggestions();
    pollTimer = setInterval(fetchFeed, POLL_INTERVAL);
    suggestPollTimer = setInterval(fetchSuggestions, SUGGEST_POLL_INTERVAL);
  }

  function registerRemoteKeys() {
    try {
      if (window.tizen && window.tizen.tvinputdevice && window.tizen.tvinputdevice.registerKey) {
        window.tizen.tvinputdevice.registerKey('ColorF0Red');
        window.tizen.tvinputdevice.registerKey('ColorF0Green');
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
    video.addEventListener('waiting', countStall);
    video.addEventListener('stalled', countStall);
    video.addEventListener('ended', function () {
      moveSelection(1);
      var item = selectedItem();
      if (item) playItem(item);
    });
    video.addEventListener('timeupdate', updateSeekBar);
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && isPlayerOpen) closePlayer();
  });

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('load', startApp);

  console.info('[shortvideo-tv] setup + feed player loaded');
})();
