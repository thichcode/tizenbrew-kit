# video-proxy (Cloudflare Worker)

Proxy stream video qua Cloudflare để TV ở VN không phải kéo thẳng từ CDN Mỹ.

## Vấn đề

Facebook gán CDN edge theo **IP của request**. Render (datacenter Mỹ) hỏi Facebook →
nhận `video-den2-x.fbcdn.net` (Denver). TV VN kéo thẳng từ Denver là đường dài bị nghẽn.

## Worker này làm gì / không làm gì

| | |
|---|---|
| ✅ Rút ngắn chặng của TV | `TV(VN) → Cloudflare PoP (Hà Nội/SG) → Denver`, thay vì `TV(VN) → Denver` xuyên quốc tế qua ISP |
| ❌ Không đổi edge Facebook chọn | Facebook gán edge theo IP của *người request*. Worker egress toàn cầu, không phải VN → vẫn có thể là `den2` |

Muốn đổi edge thật sự thì phải đổi IP egress (VPN/proxy VN), không làm được bằng Worker.

## Deploy

```bash
npm install
npx wrangler deploy
```

Sau đó URL có dạng:

```
https://video-proxy.<account>.workers.dev/?url=<urlencode(videoUrl)>
```

## Dùng trong client

```js
// thay vì
video.src = streamUrl;
// dùng
video.src = 'https://video-proxy.<account>.workers.dev/?url=' + encodeURIComponent(streamUrl);
```

HLS thì proxy từng segment: `hls.js` tự thêm query, dễ nhất là bật
`hls.config.xhrSetup`/`fLoader` để prefix URL, hoặc đổi `manifestUrl`.

## Bảo mật

Chỉ proxy được host trong `ALLOWED_HOSTS` (`src/index.ts`). Nếu nới lỏng thành open
proxy thì Worker sẽ bị dùng để đánh traffic vào mạng khác → Cloudflare khoá.

**CDN mới xuất hiện** (vd socolive đổi domain) → bị 403. Thêm host vào `ALLOWED_HOSTS`
rồi `npx wrangler deploy`. Không nên nới theo đuôi file: `evil.com/x.m3u8` sẽ lọt
và biến Worker thành open proxy.

`ALLOW_ANY_HOST=true` trong `[vars]` chỉ dùng để debug local, không bật production.

## Giới hạn Workers

- Free: 100k request/ngày, CPU 10ms/request
- **Không cache video**: live stream cache vô nghĩa, chỉ tốn băng thông
- Worker không nâng được băng thông so với kéo trực tiếp — nó *cộng* thêm 1 chặng.
  Chỉ đáng dùng khi đường ISP đi xuyên quốc tế tệ hơn đường qua Cloudflare.
