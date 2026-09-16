(function () {
  var DEFAULT_BASE = 'https://find-football-tizenbrew.onrender.com';
  var LS_KEY = 'findfootball_tv_base';
  var matches = [];
  var focusIdx = 0;
  var polling = false;
  var statusEl = null;
  var listEl = null;
  var video = null;
  var screen = 'home';

  var KEY_CODES = {
    13: 'Enter', 27: 'Escape', 32: ' ',
    37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown',
    415: 'MediaPlay', 19: 'MediaPause', 413: 'MediaStop',
    10009: 'Escape', 10190: 'MediaPlayPause', 10252: 'MediaPlayPause',
    427: 'ChannelUp', 428: 'ChannelDown'
  };

  /* ---------- inject CSS ---------- */
  function injectCSS() {
    var s = document.createElement('style');
    s.textContent = '*{margin:0;padding:0;box-sizing:border-box}'
      + 'body{background:#0a0a0a;color:#eee;font-family:system-ui,sans-serif;height:100vh;overflow:hidden}'
      + '#home-screen{display:flex;align-items:center;justify-content:center;height:100vh;background:linear-gradient(135deg,#0a1628,#1a0a2e)}'
      + '.home-center{text-align:center}'
      + '.home-center h1{font-size:48px;color:#ffd600;margin-bottom:40px;font-weight:700}'
      + '#btn-crawl{padding:28px 72px;font-size:32px;font-weight:700;background:#ffd600;color:#000;border:none;border-radius:16px;cursor:pointer;outline:none}'
      + '#btn-crawl:focus{transform:scale(1.05);box-shadow:0 0 0 4px #ffd600,0 0 30px rgba(255,214,0,.4)}'
      + '#btn-crawl:disabled{opacity:.5;cursor:default}'
      + '#st{margin-top:20px;font-size:22px;color:#888}'
      + '#list-screen{display:flex;flex-direction:column;height:100vh}'
      + '.list-header{display:flex;gap:12px;align-items:center;padding:14px 24px;background:#111;border-bottom:1px solid #333}'
      + '.list-header button{padding:12px 28px;font-size:22px;font-weight:600;background:#222;color:#fff;border:2px solid #555;border-radius:8px;cursor:pointer;outline:none}'
      + '.list-header button:focus{border-color:#ffd600;color:#ffd600;background:#333}'
      + '#list{flex:1;overflow-y:auto;padding:12px 0}'
      + '.match-row{display:flex;align-items:center;gap:16px;padding:16px 28px;border:2px solid transparent;border-bottom:1px solid #222;cursor:pointer;outline:none}'
      + '.match-row:focus{background:#1a1a2e;border-color:#ffd600}'
      + '.match-info{display:flex;align-items:center;gap:12px;flex:1}'
      + '.match-time{color:#7db4ff;font-size:20px;font-weight:600;min-width:100px}'
      + '.match-title{font-size:24px;color:#fff}'
      + '.match-league{font-size:16px;color:#666;min-width:120px;text-align:right}'
      + '.live{background:#e53935;color:#fff;font-size:14px;font-weight:700;padding:3px 10px;border-radius:4px}'
      + '.play-btn{padding:12px 24px;font-size:24px;background:#ffd600;color:#000;border:none;border-radius:8px;cursor:pointer;font-weight:700;outline:none}'
      + '.play-btn:focus{box-shadow:0 0 0 3px #ffd600}'
      + '.empty{padding:40px;text-align:center;color:#666;font-size:24px}'
      + '#player{position:fixed;top:0;left:0;width:100vw;height:100vh;background:#000;z-index:999;display:none}'
      + '#list::-webkit-scrollbar{width:8px}'
      + '#list::-webkit-scrollbar-track{background:#0a0a0a}'
      + '#list::-webkit-scrollbar-thumb{background:#444;border-radius:4px}';
    document.head.appendChild(s);
  }

  /* ---------- localStorage ---------- */
  function getBaseUrl() {
    try { return localStorage.getItem(LS_KEY) || DEFAULT_BASE; } catch (e) { return DEFAULT_BASE; }
  }

  /* ---------- XHR ---------- */
  function request(method, path, body, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, getBaseUrl() + path, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        try { cb(null, JSON.parse(xhr.responseText || '{}')); } catch (e) { cb(e); }
      } else { cb(new Error('HTTP ' + xhr.status)); }
    };
    xhr.onerror = function () { cb(new Error('Network error')); };
    xhr.send(body === undefined ? null : JSON.stringify(body));
  }

  /* ---------- time ---------- */
  function fmtTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var h = d.getHours(), m = d.getMinutes(), dd = d.getDate(), mo = d.getMonth() + 1;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ' ' + (dd < 10 ? '0' : '') + dd + '/' + (mo < 10 ? '0' : '') + mo;
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---------- render ---------- */
  function renderHome() {
    screen = 'home';
    document.body.innerHTML =
      '<div id="home-screen"><div class="home-center">'
      + '<h1>FindFootball</h1>'
      + '<button id="btn-crawl">Quet lich moi</button>'
      + '<div id="st"></div>'
      + '</div></div>';
    statusEl = document.getElementById('st');
    var crawlBtn = document.getElementById('btn-crawl');
    if (crawlBtn) crawlBtn.addEventListener('click', onCrawl);
    setTimeout(function () { if (crawlBtn) crawlBtn.focus(); }, 100);
  }

  function renderList() {
    screen = 'list';
    document.body.innerHTML =
      '<div id="list-screen">'
      + '<div class="list-header">'
      + '<button id="btn-back">Quay lai</button>'
      + '<button id="btn-crawl2">Quet lai</button>'
      + '<span id="st"></span>'
      + '</div>'
      + '<div id="list"></div></div>'
      + '<video id="player" playsinline style="display:none"></video>';
    statusEl = document.getElementById('st');
    listEl = document.getElementById('list');
    video = document.getElementById('player');
    document.getElementById('btn-back').addEventListener('click', renderHome);
    document.getElementById('btn-crawl2').addEventListener('click', onCrawl);
    buildMatchList();
    setTimeout(focusFirst, 100);
  }

  function buildMatchList() {
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!matches.length) {
      listEl.innerHTML = '<div class="empty">Chua co tran nao. Quet lich moi.</div>';
      return;
    }
    for (var i = 0; i < matches.length; i++) {
      (function (idx) {
        var m = matches[idx];
        var hasStream = false;
        for (var j = 0; j < (m.links || []).length; j++) {
          if (m.links[j].streamUrl) { hasStream = true; break; }
        }
        var row = document.createElement('div');
        row.className = 'match-row';
        row.setAttribute('tabindex', '0');
        var badge = m.isLive ? '<span class="live">LIVE</span>' : '';
        var playBtn = hasStream ? '<button class="play-btn" data-idx="' + idx + '">&#9654;</button>' : '';
        row.innerHTML =
          '<div class="match-info">'
          + '<span class="match-time">' + esc(fmtTime(m.kickoffISO)) + '</span>'
          + '<span class="match-title">' + esc(m.home + ' vs ' + m.away) + '</span>'
          + badge + '</div>'
          + '<div class="match-league">' + esc(m.league || '') + '</div>'
          + playBtn;
        if (hasStream) {
          var pb = row.querySelector('.play-btn');
          if (pb) pb.addEventListener('click', function (e) {
            e.stopPropagation();
            playMatch(idx);
          });
        }
        row.addEventListener('click', function () {
          if (hasStream) playMatch(idx);
        });
        listEl.appendChild(row);
      })(i);
    }
  }

  /* ---------- play ---------- */
  function playMatch(idx) {
    var m = matches[idx];
    if (!m) return;
    var streamUrl = null;
    for (var j = 0; j < (m.links || []).length; j++) {
      if (m.links[j].streamUrl) { streamUrl = m.links[j].streamUrl; break; }
    }
    if (!streamUrl) return;
    screen = 'player';
    if (listEl) listEl.style.display = 'none';
    var hdr = document.querySelector('.list-header');
    if (hdr) hdr.style.display = 'none';
    video.style.display = 'block';
    video.src = streamUrl;
    var r = video.play();
    if (r && r.catch) r.catch(function () {});
  }

  function stopPlayer() {
    if (video) {
      try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) {}
      video.style.display = 'none';
    }
    if (listEl) listEl.style.display = '';
    var hdr = document.querySelector('.list-header');
    if (hdr) hdr.style.display = '';
    screen = 'list';
  }

  /* ---------- crawl ---------- */
  function onCrawl() {
    if (polling) return;
    setStatus('Dang quet lich...');
    polling = true;
    var crawlBtn = document.getElementById('btn-crawl');
    if (crawlBtn) crawlBtn.disabled = true;
    request('POST', '/api/crawl', undefined, function (err, r) {
      if (err) { polling = false; setStatus('Loi. Thu lai.'); if (crawlBtn) crawlBtn.disabled = false; return; }
      setStatus(r.ok ? 'Quet xong: ' + (r.count || '?') + ' tran' : 'Loi crawl');
      polling = false;
      if (crawlBtn) crawlBtn.disabled = false;
      loadMatches();
    });
  }

  function loadMatches() {
    request('GET', '/matches.json', undefined, function (err, data) {
      if (err) { setStatus('Loi tai du lieu'); return; }
      matches = Array.isArray(data) ? data : [];
      if (screen === 'home') {
        if (matches.length) renderList();
        else setStatus('Chua co tran. Quet lai.');
      } else {
        buildMatchList();
      }
    });
  }

  function setStatus(t) { if (statusEl) statusEl.textContent = t; }

  /* ---------- focus ---------- */
  function getAllFocusable() {
    var els = [];
    if (screen === 'home') {
      var btn = document.getElementById('btn-crawl');
      if (btn) els.push(btn);
    } else if (screen === 'list') {
      var rows = document.querySelectorAll('.match-row');
      for (var i = 0; i < rows.length; i++) els.push(rows[i]);
    }
    return els;
  }

  function focusFirst() {
    var els = getAllFocusable();
    if (els.length) els[0].focus();
  }

  function moveFocus(d) {
    var els = getAllFocusable();
    if (!els.length) return;
    focusIdx = ((focusIdx + d) % els.length + els.length) % els.length;
    els[focusIdx].focus();
    els[focusIdx].scrollIntoView(false);
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
      case 'ArrowUp': case 'ChannelUp':
        e.preventDefault(); moveFocus(-1); break;
      case 'ArrowDown': case 'ChannelDown':
        e.preventDefault(); moveFocus(1); break;
      case 'ArrowLeft':
        e.preventDefault(); moveFocus(-3); break;
      case 'ArrowRight':
        e.preventDefault(); moveFocus(3); break;
      case 'Enter':
        e.preventDefault();
        var el = document.activeElement;
        if (el && (el.tagName === 'BUTTON' || el.classList.contains('match-row'))) el.click();
        break;
      case ' ': case 'MediaPlayPause': case 'MediaPlay': case 'MediaPause':
        e.preventDefault();
        if (screen === 'player') {
          if (video) { if (video.paused) video.play().catch(function () {}); else video.pause(); }
        }
        break;
      case 'Backspace': case 'Escape':
        e.preventDefault();
        if (screen === 'player') { stopPlayer(); return; }
        if (screen === 'list') { renderHome(); return; }
        break;
    }
  }

  /* ---------- start ---------- */
  function start() {
    injectCSS();
    renderHome();
    registerKeys();
    document.addEventListener('keydown', handleKey);
    loadMatches();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
