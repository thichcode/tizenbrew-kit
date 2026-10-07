export function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

export function escapeJs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function renderSetupPage(code: string, workerUrl: string): string {
  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ShortVideo TV Setup - ${escapeHtml(code)}</title>
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#070707;color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding:16px 0;box-sizing:border-box}
    main{width:min(92vw,560px);background:#121212;border:1px solid #2a2a2a;border-radius:16px;padding:24px;box-sizing:border-box}
    h1{margin:0 0 4px;font-size:26px;letter-spacing:-.03em}
    .sub{color:#8a8a8a;font-size:14px;margin-bottom:18px}
    .code-box{background:#181818;border:1px dashed #e94560;border-radius:12px;padding:12px;text-align:center;margin-bottom:20px}
    .code-label{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px}
    .code{font-size:32px;color:#e94560;font-weight:800;letter-spacing:6px;margin-top:4px}
    label{display:block;margin:14px 0 6px;color:#a7a7a7;font-size:14px}
    input,button,textarea{width:100%;border-radius:10px;border:1px solid #333;background:#0d0d0d;color:#f4f4f4;padding:0 12px;font-size:15px;box-sizing:border-box}
    input{height:46px}
    textarea{padding:10px 12px;font-family:monospace;font-size:13px;resize:vertical}
    button{margin-top:10px;height:48px;cursor:pointer;font-weight:700;font-size:16px;border:none;transition:0.15s ease}
    .btn-primary{background:#e94560;color:#fff}
    .btn-primary:hover{background:#d63c55}
    .btn-secondary{background:#1f6feb;color:#fff}
    .btn-secondary:hover{background:#1a5fc9}
    .btn-ios{background:#30d158;color:#000;font-weight:700}
    .btn-ios:hover{background:#28b84c}
    .btn-copy{display:inline-block;width:auto;height:auto;padding:4px 10px;font-size:12px;background:#242424;color:#58a6ff;border:1px solid #333;border-radius:6px;cursor:pointer;margin-left:8px;font-weight:normal}
    .btn-copy:hover{background:#333}
    .card-ios{background:linear-gradient(180deg, #161b22 0%, #0d1117 100%);border:1px solid #30363d;border-radius:12px;padding:16px;margin-bottom:20px}
    .ios-header{display:flex;align-items:center;gap:10px;margin-bottom:12px}
    .ios-tag{background:#238636;color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;text-transform:uppercase}
    .ios-title{font-size:16px;font-weight:700;color:#fff}
    .ios-step{font-size:13px;color:#c9d1d9;line-height:1.6;margin-bottom:10px;padding-left:4px}
    .ios-step strong{color:#58a6ff}
    .ios-code{background:#000;padding:4px 8px;border-radius:6px;font-family:monospace;font-size:12px;color:#7ee787;word-break:break-all;display:inline-block;margin-top:4px}
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
    #list .item{padding:6px 0;border-bottom:1px solid #1a1a1a}
    #list .idx{color:#555}
    #list .src{color:#8a8a8a;font-size:12px}
    #list .ttl{color:#ccc}
    details summary{cursor:pointer;color:#58a6ff;font-size:14px;margin-bottom:8px}
  </style>
</head>
<body>
  <main>
    <h1>ShortVideo TV</h1>
    <div class="sub">Gửi video Facebook / Reels lên TV</div>
    <div class="code-box">
      <div class="code-label">Mã kết nối TV của bạn</div>
      <div class="code">${escapeHtml(code)}</div>
    </div>

    <!-- IPHONE SHORTCUT SECTION -->
    <div class="card-ios">
      <div class="ios-header">
        <span class="ios-tag">Tốc độ cao 190 Mbps</span>
        <span class="ios-title">⚡ Dành cho iPhone: Phím tắt 1-chạm</span>
      </div>
      <div class="ios-step" style="color:#aaa;font-size:13px">
        Facebook cấp CDN riêng theo vị trí của người gửi. Khi gửi trực tiếp từ iPhone tại VN, video sẽ kéo từ <strong>CDN Hà Nội / Sài Gòn (190 Mbps)</strong> thay vì server Mỹ (1 Mbps), loại bỏ 100% tình trạng giật lag xoay vòng!
      </div>

      <div style="display:flex;gap:10px;margin:14px 0">
        <a href="${workerUrl}/download-shortcut?code=${escapeHtml(code)}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;background:#30d158;color:#000;text-decoration:none;font-weight:700;font-size:15px;height:46px;border-radius:10px">
          <span>📥</span> Tải Phím tắt (.shortcut)
        </a>
        <a href="shortcuts://create-shortcut" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;background:#242424;color:#58a6ff;border:1px solid #333;text-decoration:none;font-weight:600;font-size:14px;height:46px;border-radius:10px">
          <span>🚀</span> Mở app Phím tắt
        </a>
      </div>
      <div style="font-size:12px;color:#8b949e;margin-bottom:12px">
        💡 <strong>Cách 1:</strong> Bấm <em>Tải Phím tắt</em> $\rightarrow$ mở file trong mục Tải về của iPhone để thêm tự động.<br>
        💡 <strong>Cách 2:</strong> Nếu iOS hỏi quyền hoặc chưa quen nhập file, bấm vào hướng dẫn bên dưới để tự tạo trong 30 giây!
      </div>
      
      <details>
        <summary>👉 Hướng dẫn tự tạo Phím tắt thủ công (30 giây)</summary>
        <div style="margin-top:10px;background:#0d1117;border-radius:8px;padding:12px">
          <div class="ios-step">
            <strong>Bước 1:</strong> Mở app <strong>Phím tắt (Shortcuts)</strong> trên iPhone -> bấm dấu <strong>+</strong> -> đặt tên là <code>Gửi lên TV</code>.
          </div>
          <div class="ios-step">
            <strong>Bước 2:</strong> Bấm biểu tượng <strong>(i)</strong> ở thanh dưới cùng -> bật <strong>Hiện trong Bảng chia sẻ</strong> (Nhận: URL, Văn bản).
          </div>
          <div class="ios-step">
            <strong>Bước 3:</strong> Thêm tác vụ: <strong>Nhận nội dung của URL</strong> (Get Contents of URL):<br>
            - URL: chọn biến <code>Đầu vào của phím tắt</code> (Shortcut Input).<br>
            - <strong>BẮT BUỘC:</strong> mở rộng tác vụ -&gt; mục <strong>Tiêu đề (Headers)</strong> -&gt; thêm tiêu đề mới:<br>
            &nbsp;&bull; Tên (Key): <code>User-Agent</code><br>
            &nbsp;&bull; Giá trị (Value): <span class="ios-code">Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1</span> <button class="btn-copy" onclick="copyText('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1')">Sao chép</button><br>
            &nbsp;&nbsp;<em>Không có header này Facebook chỉ trả trang rỗng (không có link video), TV sẽ phải kéo từ server Mỹ rất chậm.</em>
          </div>
          <div class="ios-step">
            <strong>Bước 4:</strong> Thêm tác vụ: <strong>Nhận nội dung của URL</strong>:<br>
            - URL: <span class="ios-code">${escapeHtml(workerUrl)}/submit-html</span> <button class="btn-copy" onclick="copyText('${escapeJs(workerUrl)}/submit-html')">Sao chép</button><br>
            - Phương thức (Method): <strong>POST</strong><br>
            - Nội dung yêu cầu (Body): <strong>JSON</strong><br>
            - Thêm 3 trường (Khóa):<br>
              &nbsp;&bull; <code>code</code> (Văn bản) = <strong>${escapeHtml(code)}</strong> <button class="btn-copy" onclick="copyText('${escapeJs(code)}')">Sao chép</button><br>
              &nbsp;&bull; <code>url</code> (Văn bản) = <code>Đầu vào của phím tắt</code><br>
              &nbsp;&bull; <code>html</code> (Văn bản) = <code>Nội dung của URL</code> (kết quả từ Bước 3)
          </div>
          <div class="ios-step">
            <strong>Bước 3b (khuyên dùng):</strong> Thêm tác vụ <strong>Nếu (If)</strong> ngay sau Bước 3, điều kiện: <code>Nội dung của URL</code> <strong>chứa</strong> <code>og:video</code>. Nhánh <em>Nếu không</em>: thêm <strong>Hiển thị cảnh báo</strong> nội dung <code>Không lấy được link video (thiếu User-Agent hoặc sai URL), dừng!</code> rồi thêm <strong>Dừng phím tắt</strong>. Cách này chặn submit rác (link Mỹ/404) ngay từ iPhone thay vì để TV phát link chậm.
          </div>
          <div class="ios-step">
            <strong>Bước 5:</strong> Thay vì hiển thị cả JSON dài, thêm tác vụ <strong>Lấy giá trị từ điển</strong>: Khóa = <code>ketluan</code>, Từ điển = <code>Nội dung của URL</code> (kết quả POST), rồi <strong>Hiển thị</strong> giá trị đó. Màn hình sẽ chỉ hiện 1 dòng: <code>LINK VN (...) - nguon html</code> là xong, <code>LINK MY...</code> là còn lỗi.
          </div>
          <div class="ios-step" style="color:#7ee787;margin-top:8px">
            ✨ Xong! Khi xem Facebook, chỉ cần bấm <strong>Chia sẻ -> Thêm -> Gửi lên TV</strong> là TV phát tức thì!
          </div>
        </div>
      </details>
    </div>

    <!-- QUICK FB URL FORM -->
    <form id="formFacebook">
      <label>Facebook Reel URL <span class="badge badge-facebook">tự động bóc link</span></label>
      <input id="facebookUrl" type="url" placeholder="https://www.facebook.com/reel/123456" autofocus>
      <button class="btn-secondary" type="submit">Gửi lên TV</button>
    </form>

    <hr>

    <!-- DIRECT VIDEO URL -->
    <form id="formDirect">
      <label>Direct video URL (.mp4) <span class="badge badge-direct">thủ công</span></label>
      <input id="directUrl" type="url" placeholder="https://example.com/video.mp4">
      <label>Tiêu đề (tùy chọn)</label>
      <input id="directTitle" type="text" placeholder="Tên video...">
      <button class="btn-primary" type="submit">Gửi lên TV</button>
    </form>

    <hr>
    <button id="clearBtn" style="background:#c62828;color:#fff">Xóa danh sách phát trên TV</button>
    <div id="suggestions"></div>
    <div style="margin-top:16px">
      <label style="color:#a7a7a7;font-size:14px;margin-bottom:8px;display:block">Danh sách đang phát trên TV:</label>
      <div id="list" style="font-size:14px;color:#ccc;line-height:1.8"></div>
    </div>

    <div id="msg" class="msg"></div>
    <div class="info">Video bạn gửi sẽ xuất hiện trên TV trong vòng vài giây.</div>
  </main>
  <script>
    var baseUrl = '${escapeJs(workerUrl)}';
    var deviceCode = '${escapeJs(code)}';
    var msgEl = document.getElementById('msg');

    function copyText(text) {
      navigator.clipboard.writeText(text).then(function () {
        setMsg('Đã sao chép vào bộ nhớ tạm!', true);
      }).catch(function () {
        setMsg('Không thể sao chép tự động', false);
      });
    }

    function setMsg(text, ok) {
      msgEl.textContent = text;
      msgEl.style.color = ok ? '#4caf50' : '#e94560';
    }

    function send(body) {
      setMsg('Đang gửi...');
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
      setMsg('Đang gửi Facebook Reel...');
      send({ code: deviceCode, url: url }).then(function (data) {
        setMsg(data.ok ? 'Đã gửi thành công lên TV!' : 'Lỗi: ' + (data.error || 'không rõ'), !!data.ok);
        if (data.ok) { loadList(); loadSuggestions(); }
      });
    });

    document.getElementById('formDirect').addEventListener('submit', function (e) {
      e.preventDefault();
      var videoUrl = document.getElementById('directUrl').value.trim();
      if (!videoUrl) return;
      setMsg('Đang gửi...');
      send({
        code: deviceCode,
        videoUrl: videoUrl,
        title: document.getElementById('directTitle').value.trim() || undefined
      }).then(function (data) {
        setMsg(data.ok ? 'Đã gửi thành công lên TV!' : 'Lỗi: ' + (data.error || 'không rõ'), !!data.ok);
      });
    });

    document.getElementById('clearBtn').addEventListener('click', function () {
      if (!confirm('Bạn có chắc muốn xóa tất cả video trên TV?')) return;
      setMsg('Đang xóa...');
      fetch(baseUrl + '/feed?code=' + deviceCode, { method: 'DELETE' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          setMsg(data.ok ? 'Đã xóa sạch danh sách!' : 'Lỗi', !!data.ok);
          loadList();
        });
    });

    function loadList() {
      fetch(baseUrl + '/feed?code=' + deviceCode)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var el = document.getElementById('list');
          if (!data.items || !data.items.length) {
            el.innerHTML = '<em>Danh sách trống.</em>';
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
          if (!el.innerHTML) el.innerHTML = '<em>Danh sách trống.</em>';
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
          el.innerHTML = '<hr><label style="color:#4caf50;font-size:14px;margin-bottom:8px;display:block"><span class="badge badge-suggest">' + data.items.length + ' gợi ý</span></label>' +
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

