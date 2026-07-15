(function () {
  var DEFAULT_PLAYLIST_URL = 'https://raw.githubusercontent.com/vuminhthanh12/vuminhthanh12/refs/heads/main/vmttv';
  var channels = [];
  var currentIndex = 0;
  var numberBuffer = '';
  var numberTimer = null;
  var AUTO_FULLSCREEN_DELAY = 10000;
  var fullscreenTimer = null;
  var hasStartedPlayback = false;
  var video = null;
  var list = null;
  var statusEl = null;
  var nowEl = null;

  var KEY_CODES = {
    13: 'Enter',
    27: 'Escape',
    32: ' ',
    37: 'ArrowLeft',
    38: 'ArrowUp',
    39: 'ArrowRight',
    40: 'ArrowDown',
    10009: 'Escape',
    10190: 'MediaPlayPause',
    10252: 'MediaPlayPause',
    427: 'ChannelUp',
    428: 'ChannelDown',
    447: 'VolumeUp',
    448: 'VolumeDown'
  };

  function injectStyle() {
    var style = document.createElement('style');
    style.textContent = '*{margin:0;padding:0;box-sizing:border-box}body{background:#1a1a1a;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;height:100vh;overflow:hidden}#app{display:flex;flex-direction:column;height:100vh}header{display:flex;justify-content:space-between;align-items:center;padding:12px 24px;background:#111;border-bottom:1px solid #333}header h1{font-size:28px;font-weight:600}#main{display:flex;flex:1;overflow:hidden}#player-wrap{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;background:#000;min-width:0}#player{width:100%;height:70vh;max-height:70vh;background:#000}#list{width:320px;background:#111;border-left:1px solid #333;overflow-y:auto;padding:8px 0}.grp{padding:8px 16px 4px;font-size:18px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:1px}.ch{display:block;width:100%;padding:12px 16px;border:none;background:none;color:#fff;font-size:24px;text-align:left;cursor:pointer}.ch:hover,.ch:focus{background:#333;outline:none}.ch.on{background:#2a2a2a;border-left:4px solid #ffd600;padding-left:12px}.ch:focus{outline:3px solid #ffd600;outline-offset:-3px}#bar{display:flex;justify-content:space-between;align-items:center;padding:10px 24px;background:#111;border-top:1px solid #333;font-size:20px}#now{color:#ffd600;font-weight:500}#st{color:#888}#list::-webkit-scrollbar{width:8px}#list::-webkit-scrollbar-track{background:#1a1a1a}#list::-webkit-scrollbar-thumb{background:#555;border-radius:4px}#app.fullscreen-mode header,#app.fullscreen-mode #list,#app.fullscreen-mode #bar{display:none}#app.fullscreen-mode #main{display:block;height:100vh}#app.fullscreen-mode #player-wrap{width:100vw;height:100vh}#app.fullscreen-mode #player{width:100vw;height:100vh;max-height:none}';
    document.head.appendChild(style);
  }

  function buildUI() {
    injectStyle();
    document.body.innerHTML = '<div id="app"><header><h1>IPTV Player</h1><span id="cnt"></span></header><div id="main"><div id="player-wrap"><video id="player" playsinline controls></video></div><aside id="list"></aside></div><footer id="bar"><span id="now">No channel selected</span><span id="st">Ready</span></footer></div>';
    video = document.getElementById('player');
    list = document.getElementById('list');
    nowEl = document.getElementById('now');
    statusEl = document.getElementById('st');
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function setNow(text) {
    if (nowEl) nowEl.textContent = text;
  }

  function enterFullscreenMode() {
    var app = document.getElementById('app');
    if (app) app.className = 'fullscreen-mode';
  }

  function exitFullscreenMode() {
    var app = document.getElementById('app');
    if (app) app.className = '';
  }

  function resetFullscreenTimer() {
    if (fullscreenTimer) clearTimeout(fullscreenTimer);
    exitFullscreenMode();
    if (!hasStartedPlayback) return;
    fullscreenTimer = setTimeout(enterFullscreenMode, AUTO_FULLSCREEN_DELAY);
  }

  function loadPlaylist() {
    setStatus('Fetching playlist...');
    var xhr = new XMLHttpRequest();
    xhr.open('GET', DEFAULT_PLAYLIST_URL, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        channels = parsePlaylist(xhr.responseText);
        renderChannels();
        setStatus('Ready - ' + channels.length + ' channels');
        if (channels.length > 0) {
          setNow('Select a channel');
        } else {
          setNow('No channels found');
        }
      } else {
        setStatus('Error: HTTP ' + xhr.status);
      }
    };
    xhr.onerror = function () {
      setStatus('Error: Network failed');
    };
    xhr.send();
  }

  function parsePlaylist(content) {
    var lines = content.split(/\r?\n/);
    var parsed = [];
    var idx = 0;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.indexOf('#EXTINF:') !== 0) continue;
      var match = line.match(/#EXTINF:-?\d+[^,]*,(.*)/);
      if (!match) continue;
      var name = match[1].trim();
      var groupMatch = line.match(/group-title="([^"]*)"/);
      var logoMatch = line.match(/tvg-logo="([^"]*)"/);
      var skip = 1;
      while (lines[i + skip] && lines[i + skip].trim().indexOf('#') === 0) skip++;
      var url = lines[i + skip] ? lines[i + skip].trim() : '';
      if (url && url.indexOf('#') !== 0) {
        parsed.push({
          name: name,
          url: url,
          group: groupMatch ? groupMatch[1] : groupName(name),
          logo: logoMatch ? logoMatch[1] : '',
          index: idx
        });
        idx++;
        i += skip;
      }
    }
    return parsed;
  }

  function groupName(name) {
    var upper = name.toUpperCase();
    if (upper.indexOf('VTV') === 0) return 'VTV';
    if (upper.indexOf('HTVC') === 0) return 'HTVC';
    if (upper.indexOf('HTV') === 0) return 'HTV';
    if (upper.indexOf('SCTV') === 0) return 'SCTV';
    if (upper.indexOf('THVL') === 0) return 'THVL';
    if (upper.indexOf('BTV') === 0) return 'BTV';
    if (upper.indexOf('KTV') === 0) return 'KTV';
    if (upper.indexOf('NTV') === 0) return 'NTV';
    if (upper.indexOf('BBC') === 0) return 'BBC';
    if (upper.indexOf('K+') === 0) return 'K+';
    if (upper.indexOf('CNN') === 0) return 'CNN';
    return 'Other';
  }

  function groupChannels(items) {
    var grouped = {};
    for (var i = 0; i < items.length; i++) {
      var group = items[i].group || groupName(items[i].name);
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(items[i]);
    }
    return grouped;
  }

  function renderChannels() {
    if (!list) return;
    list.innerHTML = '';
    var grouped = groupChannels(channels);
    var flat = 0;
    var groups = Object.keys(grouped).sort();
    for (var i = 0; i < groups.length; i++) {
      var group = groups[i];
      var header = document.createElement('div');
      header.className = 'grp';
      header.textContent = group;
      list.appendChild(header);
      for (var j = 0; j < grouped[group].length; j++) {
        var channel = grouped[group][j];
        var button = document.createElement('button');
        button.className = 'ch';
        button.textContent = flat + 1 + '. ' + channel.name;
        button.setAttribute('data-idx', String(channel.index));
        button.onclick = makeSelectHandler(channel.index);
        button.onfocus = makeFocusHandler(channel.index);
        list.appendChild(button);
        flat++;
      }
    }
    var count = document.getElementById('cnt');
    if (count) count.textContent = channels.length + ' channels';
    focusCurrent();
  }

  function makeSelectHandler(index) {
    return function () {
      playChannel(index);
    };
  }

  function makeFocusHandler(index) {
    return function () {
      currentIndex = index;
      setActive(index);
    };
  }

  function setActive(index) {
    var nodes = document.querySelectorAll('.ch');
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var idx = parseInt(node.getAttribute('data-idx') || '-1', 10);
      if (idx === index) {
        node.className = 'ch on';
        node.scrollIntoView(false);
      } else {
        node.className = 'ch';
      }
    }
  }

  function playChannel(index) {
    if (index < 0 || index >= channels.length || !video) return;
    hasStartedPlayback = true;
    currentIndex = index;
    var channel = channels[index];
    setActive(index);
    setNow('Now Playing: ' + channel.name);
    setStatus('Loading stream...');
    video.src = channel.url;
    video.onerror = function () {
      var error = video.error;
      setStatus('Error: ' + (error ? error.message || 'code ' + error.code : 'unknown'));
    };
    video.oncanplay = function () {
      setStatus('Playing');
    };
    var result = video.play();
    if (result && result.catch) {
      result.catch(function (error) {
        setStatus('Error: ' + (error && error.message ? error.message : 'play failed'));
      });
    }
    resetFullscreenTimer();
  }

  function playAdjacent(delta) {
    if (channels.length === 0) return;
    var next = currentIndex + delta;
    if (next < 0) next = channels.length - 1;
    if (next >= channels.length) next = 0;
    playChannel(next);
    focusCurrent();
  }

  function focusCurrent() {
    var nodes = document.querySelectorAll('.ch');
    for (var i = 0; i < nodes.length; i++) {
      var idx = parseInt(nodes[i].getAttribute('data-idx') || '-1', 10);
      if (idx === currentIndex) {
        nodes[i].focus();
        return;
      }
    }
    if (nodes.length > 0) nodes[0].focus();
  }

  function togglePlay() {
    if (!video) return;
    if (video.paused) {
      var result = video.play();
      if (result && result.catch) result.catch(function () {});
    } else {
      video.pause();
    }
  }

  function seek(delta) {
    if (video) video.currentTime = Math.max(0, video.currentTime + delta);
  }

  function volume(delta) {
    if (video) video.volume = Math.max(0, Math.min(1, video.volume + delta));
  }

  function flushNumberBuffer() {
    if (!numberBuffer) return;
    var number = parseInt(numberBuffer, 10);
    numberBuffer = '';
    if (number >= 1 && number <= channels.length) {
      playChannel(number - 1);
      focusCurrent();
    }
  }

  function handleKey(event) {
    resetFullscreenTimer();
    var key = event.key && event.key !== 'Unidentified' ? event.key : KEY_CODES[event.keyCode];
    switch (key) {
      case 'ArrowUp':
      case 'ChannelUp':
        event.preventDefault();
        playAdjacent(-1);
        break;
      case 'ArrowDown':
      case 'ChannelDown':
        event.preventDefault();
        playAdjacent(1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        seek(-10);
        break;
      case 'ArrowRight':
        event.preventDefault();
        seek(10);
        break;
      case 'Enter':
        event.preventDefault();
        playChannel(currentIndex);
        break;
      case ' ':
      case 'MediaPlayPause':
      case 'MediaPlay':
      case 'MediaPause':
        event.preventDefault();
        togglePlay();
        break;
      case 'VolumeUp':
        event.preventDefault();
        volume(0.1);
        break;
      case 'VolumeDown':
        event.preventDefault();
        volume(-0.1);
        break;
      case 'Backspace':
      case 'Escape':
        event.preventDefault();
        focusCurrent();
        break;
      default:
        if (key && key >= '0' && key <= '9') {
          event.preventDefault();
          numberBuffer += key;
          if (numberTimer) clearTimeout(numberTimer);
          numberTimer = setTimeout(flushNumberBuffer, 1000);
        }
        break;
    }
  }

  function registerKeys() {
    try {
      var api = window.tizen && window.tizen.tvinputdevice;
      if (!api) return;
      var keys = ['MediaPlay', 'MediaPause', 'MediaStop', 'ChannelUp', 'ChannelDown'];
      for (var i = 0; i < keys.length; i++) api.registerKey(keys[i]);
    } catch (error) {
    }
  }

  function start() {
    buildUI();
    registerKeys();
    document.addEventListener('keydown', handleKey);
    document.addEventListener('click', resetFullscreenTimer);
    document.addEventListener('mousemove', resetFullscreenTimer);
    loadPlaylist();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
