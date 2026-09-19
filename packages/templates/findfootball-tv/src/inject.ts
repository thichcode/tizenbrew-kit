(function () {
  var DEFAULT_BASE = 'https://find-football-tizenbrew.onrender.com';
  var LS_KEY = 'findfootball_tv_base';
  var matches = [];
  var focusIdx = 0;
  var polling = false;
  var statusEl = null;
  var listEl = null;
  var video = null;
  var screen = 'list';
  var hls = null;
  var backCount = 0;
  var backTimer = null;
  var currentMatchIdx = -1;
  var blvIdx = 0;
  var blvLinks = [];
  var blvHideTimer = null;

  var KEY_CODES = {
    13: 'Enter', 27: 'Escape', 32: ' ',
    37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown',
    415: 'MediaPlay', 19: 'MediaPause', 413: 'MediaStop',
    10009: 'Escape', 10190: 'MediaPlayPause', 10252: 'MediaPlayPause',
    427: 'ChannelUp', 428: 'ChannelDown'
  };

  function injectCSS() {
    var s = document.createElement('style');
    s.textContent = '*{margin:0;padding:0;box-sizing:border-box}'
      + 'body{background:#0a0a0a;color:#eee;font-family:system-ui,sans-serif;height:100vh;overflow:hidden}'
      + '.list-header{display:flex;gap:12px;align-items:center;padding:14px 24px;background:#111;border-bottom:1px solid #333}'
      + '.list-header button{padding:12px 28px;font-size:22px;font-weight:600;background:#222;color:#fff;border:2px solid #555;border-radius:8px;cursor:pointer;outline:none}'
      + '.list-header button:focus{border-color:#ffd600;color:#ffd600;background:#333}'
      + '.list-header button.primary{background:#ffd600;color:#000;border-color:#ffd600;font-weight:700}'
      + '.list-header button.primary:focus{box-shadow:0 0 0 3px #ffd600}'
      + '#st{margin-left:auto;font-size:20px;color:#888}'
      + '#list{height:calc(100vh - 60px);overflow-y:auto;padding:12px 0}'
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
      + '#btn-back-play{position:fixed;top:16px;left:16px;z-index:1001;padding:10px 24px;font-size:20px;background:rgba(0,0,0,.7);color:#fff;border:2px solid #555;border-radius:8px;cursor:pointer;outline:none;display:none}'
      + '#btn-back-play:focus{border-color:#ffd600}'
      + '#blv-panel{position:fixed;bottom:0;left:0;width:100%;z-index:1001;background:rgba(0,0,0,.9);border-top:2px solid #ffd600;display:none}'
      + '#blv-panel .blv-title{padding:10px 24px;color:#888;font-size:18px}'
      + '#blv-list{display:flex;flex-wrap:wrap;gap:8px;padding:0 24px 16px}'
      + '.blv-btn{padding:10px 20px;font-size:18px;background:#222;color:#fff;border:2px solid #555;border-radius:8px;cursor:pointer;outline:none}'
      + '.blv-btn:focus,.blv-btn.active{border-color:#ffd600;color:#ffd600;background:#333}'
      + '#loading-overlay{position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,.85);z-index:1000;display:flex;align-items:center;justify-content:center}'
      + '.loading-box{text-align:center}'
      + '.spinner{width:60px;height:60px;border:6px solid #333;border-top-color:#ffd600;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 20px}'
      + '@keyframes spin{to{transform:rotate(360deg)}}'
      + '.loading-msg{color:#ffd600;font-size:24px}'
      + '#list::-webkit-scrollbar{width:8px}'
      + '#list::-webkit-scrollbar-track{background:#0a0a0a}'
      + '#list::-webkit-scrollbar-thumb{background:#444;border-radius:4px}';
    document.head.appendChild(s);
  }

  function getBaseUrl() {
    try { return localStorage.getItem(LS_KEY) || DEFAULT_BASE; } catch (e) { return DEFAULT_BASE; }
  }

  function request(method, path, body, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, getBaseUrl() + path, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 90000;
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        try { cb(null, JSON.parse(xhr.responseText || '{}')); } catch (e) { cb(e); }
      } else { cb(new Error('HTTP ' + xhr.status)); }
    };
    xhr.onerror = function () { cb(new Error('Network error')); };
    xhr.ontimeout = function () { cb(new Error('Timeout')); };
    xhr.send(body === undefined ? null : JSON.stringify(body));
  }

  function fmtTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var h = d.getHours(), m = d.getMinutes(), dd = d.getDate(), mo = d.getMonth() + 1;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ' ' + (dd < 10 ? '0' : '') + dd + '/' + (mo < 10 ? '0' : '') + mo;
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function initApp() {
    screen = 'list';
    document.body.innerHTML =
      '<div class="list-header">'
      + '<button id="btn-crawl" class="primary">Quet lich moi</button>'
      + '<button id="btn-crawl2">Quet lai</button>'
      + '<span id="st"></span>'
      + '</div>'
      + '<div id="list"></div>'
      + '<video id="player" playsinline style="display:none"></video>'
      + '<button id="btn-back-play" style="display:none">Quay lai</button>'
      + '<div id="blv-panel"><div class="blv-title">Chon BLV (len/xuong):</div><div id="blv-list"></div></div>';
    statusEl = document.getElementById('st');
    listEl = document.getElementById('list');
    video = document.getElementById('player');
    document.getElementById('btn-crawl').addEventListener('click', onCrawl);
    document.getElementById('btn-crawl2').addEventListener('click', onCrawl);
    document.getElementById('btn-back-play').addEventListener('click', stopPlayer);
    loadMatches();
    setTimeout(function () { document.getElementById('btn-crawl').focus(); }, 100);
  }

  function buildList() {
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!matches.length) {
      listEl.innerHTML = '<div class="empty">Chua co tran nao. Quet lich moi.</div>';
      return;
    }
    for (var i = 0; i < matches.length; i++) {
      (function (idx) {
        var m = matches[idx];
        var badge = m.isLive ? '<span class="live">LIVE</span>' : '';
        var row = document.createElement('div');
        row.className = 'match-row';
        row.setAttribute('tabindex', '0');
        row.innerHTML =
          '<div class="match-info">'
          + '<span class="match-time">' + esc(fmtTime(m.kickoffISO)) + '</span>'
          + '<span class="match-title">' + esc(m.home + ' vs ' + m.away) + '</span>'
          + badge + '</div>'
          + '<div class="match-league">' + esc(m.league || '') + '</div>'
          + '<button class="play-btn" data-idx="' + idx + '">&#9654;</button>';
        row.querySelector('.play-btn').addEventListener('click', function (e) {
          e.stopPropagation(); playMatch(idx);
        });
        row.addEventListener('click', function () { playMatch(idx); });
        listEl.appendChild(row);
      })(i);
    }
  }

  function showBLVPanel(idx) {
    currentMatchIdx = idx; blvIdx = 0;
    var m = matches[idx]; if (!m) return;
    blvLinks = m.links || [];
    var bl = document.getElementById('blv-list');
    bl.innerHTML = '';
    for (var i = 0; i < blvLinks.length; i++) {
      (function (i2) {
        var b = document.createElement('button');
        b.className = 'blv-btn' + (i2 === 0 ? ' active' : '');
        b.textContent = blvLinks[i2].label;
        b.setAttribute('tabindex', '0');
        b.addEventListener('click', function () { selectBLV(i2); });
        bl.appendChild(b);
      })(i);
    }
    document.getElementById('blv-panel').style.display = 'block';
    resetBLVTimer();
    var btns = document.getElementById('blv-panel').querySelectorAll('.blv-btn');
    if (btns.length) btns[0].focus();
  }

  function hideBLVPanel() { document.getElementById('blv-panel').style.display = 'none'; clearTimeout(blvHideTimer); }
  function resetBLVTimer() { clearTimeout(blvHideTimer); blvHideTimer = setTimeout(function () { hideBLVPanel(); }, 10000); }

  function selectBLV(i) {
    if (i < 0 || i >= blvLinks.length) return;
    blvIdx = i; resetBLVTimer();
    var btns = document.querySelectorAll('.blv-btn');
    for (var j = 0; j < btns.length; j++) btns[j].className = 'blv-btn' + (j === i ? ' active' : '');
    if (btns[i]) btns[i].focus();
    var link = blvLinks[i];
    if (link.streamUrl) { openPlayer(link.streamUrl); return; }
    if (!link.url) return;
    showLoading('Dang tim stream (' + link.label + ')...');
    var done = false;
    var timer = setTimeout(function () {
      if (!done) { done = true; hideLoading(); setStatus('Timeout - chon BLV khac'); }
    }, 20000);
    request('POST', '/api/sniff', { url: link.url }, function (err, r) {
      if (done) return; done = true; clearTimeout(timer);
      if (!err && r && r.streamUrl) { hideLoading(); openPlayer(r.streamUrl); return; }
      hideLoading(); setStatus('Khong tim thay stream - chon BLV khac');
    });
  }

  function playMatch(idx) {
    var m = matches[idx]; if (!m) return;
    var url = null;
    for (var j = 0; j < (m.links || []).length; j++) {
      if (m.links[j].streamUrl) { url = m.links[j].streamUrl; break; }
    }
    if (url) { openPlayer(url); showBLVPanel(idx); return; }
    showBLVPanel(idx);
  }

  function openPlayer(url) {
    screen = 'player';
    var v = document.getElementById('player'); v.style.display = 'block';
    var listScreen = document.getElementById('list'); if (listScreen) listScreen.style.display = 'none';
    var hdr = document.querySelector('.list-header'); if (hdr) hdr.style.display = 'none';
    document.getElementById('btn-back-play').style.display = 'block';
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      if (hls) { hls.destroy(); hls = null; }
      hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(v);
      hls.on(Hls.Events.MANIFEST_PARSED, function () { v.play().catch(function () {}); });
    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = url; v.play().catch(function () {});
    }
  }

  function stopPlayer() {
    if (hls) { hls.destroy(); hls = null; }
    var v = document.getElementById('player');
    if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {} v.style.display = 'none'; }
    document.getElementById('btn-back-play').style.display = 'none';
    hideBLVPanel();
    if (listEl) listEl.style.display = '';
    var hdr = document.querySelector('.list-header'); if (hdr) hdr.style.display = '';
    screen = 'list';
  }

  function onCrawl() {
    if (polling) return;
    setStatus('Dang quet lich...');
    polling = true;
    var btn = document.getElementById('btn-crawl'); if (btn) btn.disabled = true;
    request('POST', '/api/crawl', undefined, function (err, r) {
      if (err) { polling = false; setStatus('Loi: ' + (err.message || err)); if (btn) btn.disabled = false; return; }
      if (!r || !r.ok) { polling = false; setStatus('Loi crawl: ' + (r && r.error || 'unknown')); if (btn) btn.disabled = false; return; }
      setStatus('Quet xong: ' + (r.count || '?') + ' tran');
      polling = false; if (btn) btn.disabled = false;
      loadMatches();
    });
  }

  function loadMatches() {
    request('GET', '/matches.json', undefined, function (err, data) {
      if (err) { setStatus('Loi tai du lieu'); return; }
      matches = Array.isArray(data) ? data : [];
      buildList();
    });
  }

  function setStatus(t) { if (statusEl) statusEl.textContent = t; }

  function showLoading(msg) {
    var d = document.createElement('div'); d.id = 'loading-overlay';
    d.innerHTML = '<div class="loading-box"><div class="spinner"></div><div class="loading-msg">' + esc(msg) + '</div></div>';
    document.body.appendChild(d);
  }

  function hideLoading() {
    var d = document.getElementById('loading-overlay'); if (d) d.remove();
  }

  function getAllFocusable() {
    var els = [];
    if (screen === 'list') {
      var h = document.querySelectorAll('.list-header button');
      for (var i = 0; i < h.length; i++) els.push(h[i]);
      var r = document.querySelectorAll('.match-row');
      for (var i = 0; i < r.length; i++) els.push(r[i]);
    }
    return els;
  }

  function focusFirst() { var els = getAllFocusable(); if (els.length) els[0].focus(); }

  function moveFocus(d) {
    var els = getAllFocusable(); if (!els.length) return;
    focusIdx = ((focusIdx + d) % els.length + els.length) % els.length;
    els[focusIdx].focus(); els[focusIdx].scrollIntoView(false);
  }

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
    if (key !== 'Backspace' && key !== 'Escape') backCount = 0;

    if (screen === 'player') {
      switch (key) {
        case 'ArrowDown': e.preventDefault();
          if (document.getElementById('blv-panel').style.display === 'block') {
            selectBLV(Math.min(blvIdx + 1, blvLinks.length - 1));
          } else { showBLVPanel(currentMatchIdx); }
          return;
        case 'ArrowUp': e.preventDefault();
          if (document.getElementById('blv-panel').style.display === 'block') selectBLV(Math.max(blvIdx - 1, 0));
          return;
        case 'ArrowLeft': e.preventDefault();
          if (video) video.currentTime = Math.max(0, video.currentTime - 10);
          return;
        case 'ArrowRight': e.preventDefault();
          if (video) video.currentTime = video.duration ? Math.min(video.currentTime + 10, video.duration) : video.currentTime + 10;
          return;
        case ' ': case 'MediaPlayPause': case 'MediaPlay': case 'MediaPause': e.preventDefault();
          if (video) { if (video.paused) video.play().catch(function () {}); else video.pause(); }
          return;
        case 'Backspace': case 'Escape': e.preventDefault();
          if (document.getElementById('blv-panel').style.display === 'block') { hideBLVPanel(); return; }
          stopPlayer(); return;
      }
      return;
    }

    switch (key) {
      case 'ArrowUp': case 'ChannelUp': e.preventDefault(); moveFocus(-1); break;
      case 'ArrowDown': case 'ChannelDown': e.preventDefault(); moveFocus(1); break;
      case 'ArrowLeft': e.preventDefault(); moveFocus(-3); break;
      case 'ArrowRight': e.preventDefault(); moveFocus(3); break;
      case 'Enter': e.preventDefault();
        var el = document.activeElement;
        if (el && (el.tagName === 'BUTTON' || el.classList.contains('match-row'))) el.click();
        break;
      case 'Backspace': case 'Escape': e.preventDefault();
        backCount++;
        if (backCount >= 5) { try { window.close(); } catch (e) {} backCount = 0; }
        else {
          setStatus('Nhan Back ' + backCount + '/5 lan de thoat');
          clearTimeout(backTimer);
          backTimer = setTimeout(function () { backCount = 0; if (statusEl) statusEl.textContent = ''; }, 3000);
        }
        return;
      default:
        if (key && key >= '1' && key <= '9') {
          var rows = document.querySelectorAll('.match-row');
          var n = parseInt(key, 10);
          if (n <= rows.length) { e.preventDefault(); rows[n - 1].focus(); focusIdx = n - 1; }
        }
        break;
    }
  }

  function start() {
    injectCSS();
    initApp();
    registerKeys();
    document.addEventListener('keydown', handleKey);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else { start(); }
})();
