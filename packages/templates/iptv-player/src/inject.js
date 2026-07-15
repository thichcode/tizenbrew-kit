(function () {
  'use strict';

  var PLAYLIST_URL = 'https://raw.githubusercontent.com/thichcode/thichcode/main/filtered_playlist.m3u';

  var channels = [];
  var currentIndex = 0;
  var video = null;
  var channelListEl = null;
  var nowPlayingEl = null;
  var statusEl = null;
  var numberBuffer = '';
  var numberTimer = null;

  function addStyles() {
    var style = document.createElement('style');
    style.textContent =
      '*{margin:0;padding:0;box-sizing:border-box}' +
      'body{background:#1a1a1a;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;height:100vh;overflow:hidden}' +
      '#app{display:flex;flex-direction:column;height:100vh}' +
      'header{display:flex;justify-content:space-between;align-items:center;padding:12px 24px;background:#111;border-bottom:1px solid #333}' +
      'header h1{font-size:28px;font-weight:600}' +
      '#main{display:flex;flex:1;overflow:hidden}' +
      '#player-wrap{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;background:#000;min-width:0}' +
      '#player{width:100%;height:70vh;max-height:70vh;background:#000}' +
      '#list{width:320px;background:#111;border-left:1px solid #333;overflow-y:auto;padding:8px 0}' +
      '.grp{padding:8px 16px 4px;font-size:18px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:1px}' +
      '.ch{display:block;width:100%;padding:12px 16px;border:none;background:none;color:#fff;font-size:24px;text-align:left;cursor:pointer}' +
      '.ch:hover,.ch:focus{background:#333;outline:none}' +
      '.ch.on{background:#2a2a2a;border-left:4px solid #ffd600;padding-left:12px}' +
      '.ch:focus{outline:3px solid #ffd600;outline-offset:-3px}' +
      '#bar{display:flex;justify-content:space-between;align-items:center;padding:10px 24px;background:#111;border-top:1px solid #333;font-size:20px}' +
      '#now{color:#ffd600;font-weight:500}' +
      '#st{color:#888}' +
      '#list::-webkit-scrollbar{width:8px}' +
      '#list::-webkit-scrollbar-track{background:#1a1a1a}' +
      '#list::-webkit-scrollbar-thumb{background:#555;border-radius:4px}';
    document.head.appendChild(style);
  }

  function createUI() {
    addStyles();
    var body = document.body;
    body.innerHTML =
      '<div id="app">' +
        '<header><h1>IPTV Player</h1><span id="cnt"></span></header>' +
        '<div id="main">' +
          '<div id="player-wrap">' +
            '<video id="player" playsinline controls></video>' +
          '</div>' +
          '<aside id="list"></aside>' +
        '</div>' +
        '<footer id="bar">' +
          '<span id="now">No channel selected</span>' +
          '<span id="st">Ready</span>' +
        '</footer>' +
      '</div>';
    video = document.getElementById('player');
    channelListEl = document.getElementById('list');
    nowPlayingEl = document.getElementById('now');
    statusEl = document.getElementById('st');
  }

  function updateStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function setPlaying(name) {
    if (nowPlayingEl) nowPlayingEl.textContent = 'Now Playing: ' + name;
  }

  function fetchPlaylist(callback) {
    updateStatus('Fetching playlist...');
    var xhr = new XMLHttpRequest();
    xhr.open('GET', PLAYLIST_URL, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          var parsed = parseM3U(xhr.responseText);
          channels = parsed;
          renderList();
          updateStatus('Ready - ' + channels.length + ' channels');
          if (callback) callback(null, parsed);
        } else {
          updateStatus('Error: HTTP ' + xhr.status);
          if (callback) callback(new Error('HTTP ' + xhr.status));
        }
      }
    };
    xhr.onerror = function () {
      updateStatus('Error: Network failed');
      if (callback) callback(new Error('Network failed'));
    };
    xhr.send();
  }

  function parseM3U(text) {
    var lines = text.split(/\r?\n/);
    var result = [];
    var idx = 0;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.indexOf('#EXTINF:') === 0) {
        var match = line.match(/#EXTINF:-?\d+,(.*)/);
        if (!match) continue;
        var name = match[1].trim();
        var urlLine = lines[i + 1] ? lines[i + 1].trim() : '';
        if (urlLine && urlLine.indexOf('#') !== 0) {
          result.push({ name: name, url: urlLine, index: idx });
          idx++;
          i++;
        }
      }
    }
    return result;
  }

  function getGroup(name) {
    var u = name.toUpperCase();
    if (u.indexOf('VTV') === 0) return 'VTV';
    if (u.indexOf('HTV') === 0) return 'HTV';
    if (u.indexOf('THVL') === 0) return 'THVL';
    if (u.indexOf('BBC') === 0) return 'BBC';
    if (u.indexOf('K+') === 0) return 'K+';
    if (u.indexOf('CNN') === 0) return 'CNN';
    if (u.indexOf('SCTV') === 0) return 'SCTV';
    return 'Other';
  }

  function groupChannels(list) {
    var map = {};
    for (var i = 0; i < list.length; i++) {
      var g = getGroup(list[i].name);
      if (!map[g]) map[g] = [];
      map[g].push(list[i]);
    }
    return map;
  }

  function renderList() {
    if (!channelListEl) return;
    channelListEl.innerHTML = '';
    var grouped = groupChannels(channels);
    var flatIndex = 0;
    var groups = Object.keys(grouped).sort();
    for (var g = 0; g < groups.length; g++) {
      var groupName = groups[g];
      var header = document.createElement('div');
      header.className = 'grp';
      header.textContent = groupName;
      channelListEl.appendChild(header);
      var groupChs = grouped[groupName];
      for (var c = 0; c < groupChs.length; c++) {
        var ch = groupChs[c];
        var btn = document.createElement('button');
        btn.className = 'ch';
        btn.textContent = (flatIndex + 1) + '. ' + ch.name;
        btn.setAttribute('data-idx', ch.index);
        btn.addEventListener('click', function (idx) {
          return function () { selectChannel(idx); };
        }(ch.index));
        btn.addEventListener('focus', function (idx) {
          return function () { currentIndex = idx; highlight(idx); };
        }(ch.index));
        channelListEl.appendChild(btn);
        flatIndex++;
      }
    }
    var cnt = document.getElementById('cnt');
    if (cnt) cnt.textContent = channels.length + ' channels';
    if (channels.length > 0) {
      var firstBtn = channelListEl.querySelector('.ch');
      if (firstBtn) firstBtn.focus();
    }
  }

  function highlight(idx) {
    var items = channelListEl.querySelectorAll('.ch');
    for (var i = 0; i < items.length; i++) {
      var btn = items[i];
      var chIdx = parseInt(btn.getAttribute('data-idx'), 10);
      if (chIdx === idx) {
        btn.className = 'ch on';
        btn.scrollIntoView({ block: 'nearest' });
      } else {
        btn.className = 'ch';
      }
    }
  }

  function selectChannel(idx) {
    if (idx < 0 || idx >= channels.length) return;
    currentIndex = idx;
    var ch = channels[idx];
    highlight(idx);
    setPlaying(ch.name);
    updateStatus('Loading stream...');
    if (video) {
      video.src = ch.url;
      video.play().catch(function (err) {
        updateStatus('Error: ' + err.message);
      });
      video.onerror = function () {
        var err = video.error;
        updateStatus('Error: ' + (err ? err.message : 'unknown'));
      };
      video.oncanplay = function () {
        updateStatus('Playing');
      };
    }
  }

  function nextChannel() {
    if (channels.length === 0) return;
    var next = currentIndex + 1;
    if (next >= channels.length) next = 0;
    selectChannel(next);
  }

  function prevChannel() {
    if (channels.length === 0) return;
    var prev = currentIndex - 1;
    if (prev < 0) prev = channels.length - 1;
    selectChannel(prev);
  }

  function togglePlay() {
    if (!video) return;
    if (video.paused) {
      video.play().catch(function () {});
    } else {
      video.pause();
    }
  }

  function seek(delta) {
    if (video) video.currentTime = Math.max(0, video.currentTime + delta);
  }

  function setVolume(delta) {
    if (video) video.volume = Math.max(0, Math.min(1, video.volume + delta));
  }

  function focusList() {
    var items = channelListEl.querySelectorAll('.ch');
    for (var i = 0; i < items.length; i++) {
      var idx = parseInt(items[i].getAttribute('data-idx'), 10);
      if (idx === currentIndex) {
        items[i].focus();
        return;
      }
    }
    if (items.length > 0) items[0].focus();
  }

  function handleKey(e) {
    var key = e.key;
    switch (key) {
      case 'ArrowUp':
        e.preventDefault();
        prevChannel();
        break;
      case 'ArrowDown':
        e.preventDefault();
        nextChannel();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        seek(-10);
        break;
      case 'ArrowRight':
        e.preventDefault();
        seek(10);
        break;
      case 'Enter':
        e.preventDefault();
        selectChannel(currentIndex);
        break;
      case ' ':
        e.preventDefault();
        togglePlay();
        break;
      case 'Backspace':
      case 'Escape':
        e.preventDefault();
        focusList();
        break;
      case 'MediaPlayPause':
        e.preventDefault();
        togglePlay();
        break;
      case 'VolumeUp':
        e.preventDefault();
        setVolume(0.1);
        break;
      case 'VolumeDown':
        e.preventDefault();
        setVolume(-0.1);
        break;
      default:
        if (key >= '0' && key <= '9') {
          e.preventDefault();
          numberBuffer += key;
          if (numberTimer) clearTimeout(numberTimer);
          numberTimer = setTimeout(function () {
            var num = parseInt(numberBuffer, 10);
            numberBuffer = '';
            if (num >= 1 && num <= channels.length) {
              selectChannel(num - 1);
            }
          }, 1000);
        }
        break;
    }
  }

  function init() {
    createUI();
    document.addEventListener('keydown', handleKey);
    fetchPlaylist();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
