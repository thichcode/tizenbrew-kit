export function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

export function escapeJs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function renderSetupPage(code: string, workerUrl: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ShortVideo TV Setup</title>
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#070707;color:#f4f4f4;font-family:Arial,sans-serif}
    main{width:min(92vw,540px);background:#121212;border:1px solid #2a2a2a;border-radius:14px;padding:24px}
    h1{margin:0 0 4px;font-size:26px;letter-spacing:-.03em}
    .sub{color:#8a8a8a;font-size:14px;margin-bottom:20px}
    .code{font-size:28px;color:#e94560;font-weight:700;letter-spacing:4px;margin-bottom:20px;text-align:center}
    label{display:block;margin:14px 0 6px;color:#a7a7a7;font-size:14px}
    input,button{width:100%;border-radius:10px;border:1px solid #333;background:#0d0d0d;color:#f4f4f4;padding:0 12px;font-size:16px;box-sizing:border-box}
    input{height:46px}
    button{margin-top:10px;height:48px;cursor:pointer;font-weight:700;font-size:17px}
    .btn-primary{background:#e94560;border-color:#e94560;color:#fff}
    .btn-primary:hover{background:#d63c55}
    .btn-secondary{background:#1f6feb;border-color:#2f81f7;color:#fff}
    .btn-secondary:hover{background:#1a5fc9}
    .msg{margin-top:14px;color:#8a8a8a;font-size:14px;min-height:22px}
    .info{color:#6a6a6a;font-size:13px;margin-top:18px;line-height:1.5;border-top:1px solid #222;padding-top:16px}
    .badge{display:inline-block;background:#222;padding:2px 10px;border-radius:6px;font-size:12px;margin-right:6px}
    .badge-facebook{color:#1877f2}
    .badge-direct{color:#8a8a8a}
    .badge-suggest{color:#4caf50}
    #suggestions{margin-top:14px}
    #suggestions .sg-item{padding:4px 0;border-bottom:1px solid #1a1a1a;font-size:13px;color:#8a8a8a}
    #suggestions .sg-item a{color:#4caf50;text-decoration:none}
    hr{border:0;border-top:1px solid #222;margin:18px 0}
    #list .item{padding:4px 0;border-bottom:1px solid #1a1a1a}
    #list .idx{color:#555}
    #list .src{color:#8a8a8a;font-size:12px}
    #list .ttl{color:#ccc}
  </style>
</head>
<body>
  <main>
    <h1>ShortVideo TV</h1>
    <div class="sub">Send videos to your TV</div>
    <div class="code">${escapeHtml(code)}</div>

    <form id="formFacebook">
      <label>Facebook Reel URL <span class="badge badge-facebook">resolved on TV</span></label>
      <input id="facebookUrl" type="url" placeholder="https://www.facebook.com/reel/123456" autofocus>
      <button class="btn-secondary" type="submit">Send to TV</button>
    </form>

    <hr>

    <form id="formDirect">
      <label>Direct video URL <span class="badge badge-direct">manual</span></label>
      <input id="directUrl" type="url" placeholder="https://example.com/video.mp4">
      <label>Title (optional)</label>
      <input id="directTitle" type="text" placeholder="My video">
      <button class="btn-primary" type="submit">Send to TV</button>
    </form>

    <hr>
    <button id="clearBtn" style="background:#c62828;border-color:#c62828;color:#fff">Clear Feed</button>
    <div id="suggestions"></div>
    <div style="margin-top:16px">
      <label style="color:#a7a7a7;font-size:14px;margin-bottom:8px;display:block">Current feed:</label>
      <div id="list" style="font-size:14px;color:#ccc;line-height:1.8"></div>
    </div>

    <div id="msg" class="msg"></div>
    <div class="info">Send as many videos as you like. They appear on the TV within seconds.</div>
  </main>
  <script>
    var baseUrl = '${escapeJs(workerUrl)}';
    var deviceCode = '${escapeJs(code)}';
    var msgEl = document.getElementById('msg');

    function setMsg(text, ok) {
      msgEl.textContent = text;
      msgEl.style.color = ok ? '#4caf50' : '#e94560';
    }

    function send(body) {
      setMsg('Sending...');
      return fetch(baseUrl + '/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) { return r.json(); });
    }

    document.getElementById('formFacebook').addEventListener('submit', function (e) {
      e.preventDefault();
      var url = document.getElementById('facebookUrl').value.trim();
      if (!url) return;
      setMsg('Sending Facebook Reel...');
      send({ code: deviceCode, url: url }).then(function (data) {
        setMsg(data.ok ? 'Sent! Video added to TV.' : 'Failed: ' + (data.error || 'unknown'), !!data.ok);
        if (data.ok) { loadList(); loadSuggestions(); }
      });
    });

    document.getElementById('formDirect').addEventListener('submit', function (e) {
      e.preventDefault();
      var videoUrl = document.getElementById('directUrl').value.trim();
      if (!videoUrl) return;
      setMsg('Sending...');
      send({
        code: deviceCode,
        videoUrl: videoUrl,
        title: document.getElementById('directTitle').value.trim() || undefined
      }).then(function (data) {
        setMsg(data.ok ? 'Sent! Video added to TV.' : 'Failed: ' + (data.error || 'unknown'), !!data.ok);
      });
    });

    document.getElementById('clearBtn').addEventListener('click', function () {
      if (!confirm('Clear all videos from TV feed?')) return;
      setMsg('Clearing...');
      fetch(baseUrl + '/feed?code=' + deviceCode, { method: 'DELETE' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          setMsg(data.ok ? 'Feed cleared!' : 'Failed', !!data.ok);
          loadList();
        });
    });

    function loadList() {
      fetch(baseUrl + '/feed?code=' + deviceCode)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var el = document.getElementById('list');
          if (!data.items || !data.items.length) {
            el.innerHTML = '<em>Feed is empty.</em>';
            return;
          }
          el.innerHTML = data.items.filter(function (it) {
            return it && it.source !== 'TikTok';
          }).map(function (it, i) {
            return '<div class="item">' +
              '<span class="idx">' + (i + 1) + '.</span> ' +
              '<span class="src">[' + it.source + ']</span> ' +
              '<span class="ttl">' + (it.title || it.sourceUrl) + '</span>' +
            '</div>';
          }).join('');
          if (!el.innerHTML) el.innerHTML = '<em>Feed is empty.</em>';
        });
    }

    function loadSuggestions() {
      fetch(baseUrl + '/suggestions?code=' + deviceCode)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var el = document.getElementById('suggestions');
          if (!data.items || !data.items.length) {
            el.innerHTML = '';
            return;
          }
          el.innerHTML = '<hr><label style="color:#4caf50;font-size:14px;margin-bottom:8px;display:block"><span class="badge badge-suggest">' + data.items.length + ' suggestions</span></label>' +
            data.items.map(function (it, i) {
              return '<div class="sg-item">' + (i + 1) + '. <a href="' + it.sourceUrl + '" target="_blank">' + (it.title || it.sourceUrl.slice(0, 60)) + '</a></div>';
            }).join('');
        });
    }

    loadList();
    loadSuggestions();
  </script>
</body>
</html>`;
}
