(function () {
  var DEFAULT_BASE = 'https://find-football-tizenbrew.onrender.com';
  var LS_KEY = 'findfootball_tv_base';
  var matches = [];
  var focusIdx = 0;
  var polling = false;
  var statusEl = null;
  var nowEl = null;
  var listEl = null;
  var countEl = null;
  var settingsEl = null;
  var baseInput = null;
  var player = null;
  var video = null;

  var KEY_CODES = {
    13: 'Enter', 27: 'Escape', 32: ' ',
    37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown',
    415: 'MediaPlay', 19: 'MediaPause', 413: 'MediaStop',
    10009: 'Escape', 10190: 'MediaPlayPause', 10252: 'MediaPlayPause',
    427: 'ChannelUp', 428: 'ChannelDown'
  };

  /* ---------- localStorage ---------- */
  function getBaseUrl() {
    try { return localStorage.getItem(LS_KEY) || DEFAULT_BASE; } catch (e) { return DEFAULT_BASE; }
  }
  function setBaseUrl(url) {
    try { localStorage.setItem(LS_KEY, url.replace(/\/+$/, '')); } catch (e) {}
  }

  /* ---------- XHR helper ---------- */
  function request(method, path, body, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, getBaseUrl() + path, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        try { cb(null, JSON.parse(xhr.responseText || '{}')); } catch (e) { cb(e); }
      } else {
        cb(new Error('HTTP ' + xhr.status));
      }
    };
    xhr.onerror = function () { cb(new Error('Network error')); };
    xhr.send(body === undefined ? null : JSON.stringify(body));
  }

  /* ---------- time fmt ---------- */
  function fmtTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var h = d.getHours(), m = d.getMinutes(), dd = d.getDate(), mo = d.getMonth() + 1;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ' ' + (dd < 10 ? '0' : '') + dd + '/' + (mo < 10 ? '0' : '') + mo;
  }

  /* ---------- data helpers ---------- */
  function toPlayables(list) {
    var out = [];
    var sorted = list.slice().sort(function (a, b) {
      return new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime();
    });
    for (var i = 0; i < sorted.length; i++) {
      var m = sorted[i];
      var links = m.links || [];
      for (var j = 0; j < links.length; j++) {
        var l = links[j];
        if (!l.streamUrl) continue;
        out.push({
          id: out.length,
          title: m.home + ' vs ' + m.away + ' \u2014 ' + l.label,
          time: fmtTime(m.kickoffISO),
          streamUrl: l.streamUrl,
          pageUrl: l.url
        });
      }
    }
    return out;
  }

  function loadList() {
    setStatus('Dang tai lich...');
    request('GET', '/matches.json', undefined, function (err, data) {
      if (err) { setStatus('Loi mang: ' + err.message); return; }
      matches = Array.isArray(data) ? data : [];
      renderList();
      var p = toPlayables(matches);
      setCount(p.length);
      setStatus(p.length ? 'San sang (' + p.length + ' link xem)' : 'Chua co link xem. Bam "Quet lich moi".');
      focusItem(0);
    });
  }

  function getPlayables() { return toPlayables(matches); }

  /* ---------- play ---------- */
  function playAt(i) {
    var p = getPlayables();
    var it = p[i];
    if (!it) return;
    setNow('Dang phat: ' + it.title);
    setStatus('Dang tai stream...');
    stopPlayer();
    if (player) {
      player.play(it.streamUrl);
    } else {
      playNative(it.streamUrl);
    }
  }

  function playNative(url) {
    if (!video) { setStatus('No video element'); return; }
    video.src = url;
    var r = video.play();
    if (r && r.catch) r.catch(function () { setStatus('Play failed'); });
  }

  function stopPlayer() {
    if (player) { try { player.stop(); } catch (e) {} }
    if (video) {
      try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) {}
    }
  }

  function pauseToggle() {
    if (player) { player.pauseToggle(); return; }
    if (!video) return;
    if (video.paused) { video.play().catch(function () {}); }
    else { video.pause(); }
  }

  /* ---------- AVPlay wrapper ---------- */
  function getAvplay() {
    try {
      var w = window;
      return w.webapis && w.webapis.avplay ? w.webapis.avplay : null;
    } catch (e) { return null; }
  }

  function createTvPlayer() {
    return {
      _avplay: false,
      _video: video,
      play: function (url) {
        this.stop();
        var self = this;
        var av = getAvplay();
        if (av) {
          try {
            self._avplay = true;
            av.open(url);
            av.setDisplayRect(0, 0, 1920, 1080);
            av.setListener({
              onbufferingstart: function () {},
              onbufferingcomplete: function () { setStatus('Dang phat'); },
              onerror: function () { self._avplay = false; playNative(url); }
            });
            av.prepareAsync(function () { av.play(); }, function () { self._avplay = false; playNative(url); });
            return;
          } catch (e) { self._avplay = false; }
        }
        playNative(url);
      },
      stop: function () {
        var av = getAvplay();
        if (this._avplay && av) {
          try { av.stop(); av.close(); } catch (e) {}
        }
        this._avplay = false;
        if (video) {
          try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) {}
        }
      },
      pauseToggle: function () {
        var av = this._avplay ? getAvplay() : null;
        if (av) { try { av.pause(); return; } catch (e) {} }
        if (!video) return;
        if (video.paused) { video.play().catch(function () {}); } else { video.pause(); }
      }
    };
  }

  /* ---------- crawl ---------- */
  function onCrawl() {
    if (polling) return;
    setStatus('Dang goi crawl...');
    polling = true;
    request('POST', '/api/crawl', undefined, function (err, r) {
      if (err) { polling = false; setStatus('Crawl loi. Thu lai sau.'); return; }
      setStatus(r.ok ? 'Quet xong: ' + (r.count || '?') + ' tran' : 'Crawl loi');
      polling = false;
      loadList();
    });
  }

  /* ---------- UI helpers ---------- */
  function setStatus(t) { if (statusEl) statusEl.textContent = t; }
  function setNow(t) { if (nowEl) nowEl.textContent = t; }
  function setCount(n) { if (countEl) countEl.textContent = n ? n + ' link xem' : ''; }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = '';
    var p = getPlayables();
    if (!p.length) {
      var emp = document.createElement('p');
      emp.className = 'empty';
      emp.textContent = 'Chua co link xem. Bam "Quet lich moi".';
      listEl.appendChild(emp);
      return;
    }
    for (var i = 0; i < p.length; i++) {
      (function (idx) {
        var it = p[idx];
        var b = document.createElement('button');
        b.className = 'match';
        b.setAttribute('data-idx', String(idx));
        b.innerHTML = '<span class="t">' + escapeHtml(it.time) + '</span> <span class="n">' + escapeHtml(it.title) + '</span>';
        b.addEventListener('click', function () { playAt(idx); });
        b.addEventListener('focus', function () { focusIdx = idx; });
        listEl.appendChild(b);
      })(i);
    }
  }

  function focusItem(i) {
    var nodes = document.querySelectorAll('.match');
    var n = nodes.length;
    if (!n) return;
    focusIdx = ((i % n) + n) % n;
    var el = nodes[focusIdx];
    if (el) { el.focus(); el.scrollIntoView(false); }
  }

  function moveFocus(d) {
    var nodes = document.querySelectorAll('.match');
    var n = nodes.length;
    if (!n) return;
    focusIdx = ((focusIdx + d) % n + n) % n;
    var el = nodes[focusIdx];
    if (el) { el.focus(); el.scrollIntoView(false); }
  }

  /* ---------- settings ---------- */
  function toggleSettings(show) {
    if (settingsEl) settingsEl.style.display = show ? 'block' : 'none';
    if (show && baseInput) baseInput.value = getBaseUrl();
  }

  function saveSettings() {
    if (baseInput && baseInput.value.trim()) setBaseUrl(baseInput.value.trim());
    toggleSettings(false);
    loadList();
  }

  /* ---------- build UI ---------- */
  function buildUI() {
    document.body.innerHTML =
      '<div id="app">' +
      '<header><h1>FindFootball TV</h1><span id="cnt"></span></header>' +
      '<div id="main"><div id="player-wrap"><video id="player" playsinline></video>' +
      '<div id="now">Chua chon tran</div></div>' +
      '<aside id="side"><div id="actions">' +
      '<button id="btn-crawl">Quet lich moi</button> ' +
      '<button id="btn-reload">Tai lai</button> ' +
      '<button id="btn-settings">Cai dat</button>' +
      '</div><div id="list"></div></div></div>' +
      '<div id="settings" style="display:none"><label>Backend URL</label> ' +
      '<input id="base" type="text"> <button id="btn-save">Luu</button></div>' +
      '<footer id="bar"><span id="st">Khoi dong...</span></footer></div>';
    listEl = document.getElementById('list');
    statusEl = document.getElementById('st');
    nowEl = document.getElementById('now');
    countEl = document.getElementById('cnt');
    settingsEl = document.getElementById('settings');
    baseInput = document.getElementById('base');
    video = document.getElementById('player');
    player = createTvPlayer();
    var crawlBtn = document.getElementById('btn-crawl');
    if (crawlBtn) crawlBtn.addEventListener('click', onCrawl);
    var reloadBtn = document.getElementById('btn-reload');
    if (reloadBtn) reloadBtn.addEventListener('click', loadList);
    var settingsBtn = document.getElementById('btn-settings');
    if (settingsBtn) settingsBtn.addEventListener('click', function () { toggleSettings(true); });
    var saveBtn = document.getElementById('btn-save');
    if (saveBtn) saveBtn.addEventListener('click', saveSettings);
    if (video) {
      video.addEventListener('error', function () { setStatus('Video error'); });
      video.addEventListener('playing', function () { setStatus('Dang phat'); });
    }
  }

  /* ---------- remote ---------- */
  function registerKeys() {
    try {
      var api = window.tizen && window.tizen.tvinputdevice;
      if (!api) return;
      var keys = ['MediaPlay', 'MediaPause', 'MediaStop', 'ChannelUp', 'ChannelDown'];
      for (var i = 0; i < keys.length; i++) {
        try { api.registerKey(keys[i]); } catch (e) {}
      }
    } catch (e) {}
  }

  function handleKey(e) {
    var key = e.key && e.key !== 'Unidentified' ? e.key : KEY_CODES[e.keyCode];
    switch (key) {
      case 'ArrowUp': case 'ChannelUp': e.preventDefault(); moveFocus(-1); break;
      case 'ArrowDown': case 'ChannelDown': e.preventDefault(); moveFocus(1); break;
      case 'Enter':
        e.preventDefault();
        var el = document.activeElement;
        if (el && el.tagName === 'BUTTON') el.click();
        break;
      case ' ': case 'MediaPlayPause': case 'MediaPlay': case 'MediaPause':
        e.preventDefault(); pauseToggle(); break;
      case 'Backspace': case 'Escape':
        e.preventDefault();
        if (settingsEl && settingsEl.style.display === 'block') { toggleSettings(false); return; }
        stopPlayer(); setNow('Chua chon tran'); focusItem(0);
        break;
      default:
        if (key && key >= '1' && key <= '9') {
          var nodes = document.querySelectorAll('.match');
          var n = parseInt(key, 10);
          if (n <= nodes.length) { e.preventDefault(); focusItem(n - 1); }
        }
        break;
    }
  }

  /* ---------- start ---------- */
  function start() {
    buildUI();
    registerKeys();
    document.addEventListener('keydown', handleKey);
    loadList();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
