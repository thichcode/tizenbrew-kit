# TizenBrew IPTV Zap Debounce Design

## Goal

Chặn spam chuyển kênh trên `tizenbrew-iptv`: bấm Up/Down liên tục chỉ di chuyển highlight/preview, không load stream ngay. Chỉ khi dừng bấm đủ 10s mới tự load kênh đang highlight, hoặc bấm Enter để load ngay.

## Scope

- Chỉ sửa `packages/templates/tizenbrew-iptv/dist/inject.js` (bản QR setup đang publish npm `tizenbrew-iptv@0.1.9`).
- Không sửa `iptv-player`, `tizeniptv`, worker QR setup, playlist parsing, fullscreen logic.

## Current Behavior

- `G()` xử lý `ArrowUp/ChannelUp` → `L(-1)`, `ArrowDown/ChannelDown` → `L(1)`.
- `L(delta)` tính `n` (có wrap + menu-item `Change playlist` ở `p == i.length`) rồi gọi `y(n); x();` ngay.
- `y(e)` là `playChannel` thật: set `video.src`, `play()`, đổi `Now Playing`.
- Hệ quả: mỗi lần bấm là 1 lần fetch/decode HLS → giật, spam khi dò kênh.

## Approach Selected: Debounce timer đơn giản (Option A)

Đã loại:
- B (tách playing/pending index): chính xác hơn nhưng chạm nhiều, dễ vỡ menu-item.
- C (throttle cứng khóa phím): UX tệ, bấm nhanh mất kênh.

## Changes

### Architecture

Thêm 2 var global cạnh `setupTimer`, `w`, `b` hiện có:

- `zapTimer = null`
- `ZAP_DELAY = 10000` (ms, hằng số, ES5 `var`)

Không đổi chữ ký `y(e)`, `D(e)`, `x()`, `P()`, `A()`, `X()`, `K()`, `z()`, QR flow.

### Data Flow

1. `L(delta)`:
   - Tính `n` như cũ (wrap, menu-item).
   - Nếu `n == i.length` (menu `Change playlist`): `p = n; D(n); focus menu; g(); return;` — không đặt zap timer.
   - Còn lại: `p = n; D(n); x();` + status preview `d("Preview: " + name + " - Enter de xem ngay")`.
   - `if (zapTimer) clearTimeout(zapTimer);`
   - `zapTimer = setTimeout(function() { zapTimer = null; y(target); }, ZAP_DELAY);` với `target` là snapshot index tại lúc bấm (ví dụ `var target = n;`), không đọc `p` trực tiếp trong callback.
   - Giữ `g()` (fullscreen timer) như cũ.
2. `Enter` trong `G()`:
   - `if (zapTimer) { clearTimeout(zapTimer); zapTimer = null; }` rồi `y(p)` như cũ (hoặc `resetPlaylist()` khi `p == i.length`).
3. `j(e)` (click chuột) và `Y()` (nhập số):
   - Hủy `zapTimer` rồi `y()` ngay — click/số là ý định rõ ràng, không debounce 10s.
4. `resetPlaylist()`, `MediaStop`, `showSetup()`:
   - Hủy `zapTimer` để không auto-play sau khi đã reset/stop.

### ES5 / Tizen 3 Compatibility

- Chỉ `var`, `function`, `setTimeout/clearTimeout`, `parseInt` — đã dùng sẵn trong file.
- Không `let/const/arrow/fetch/optional chaining` (test hiện tại cấm).
- Không thêm dependency, không đổi `package.json` (`packageType: app`, `appPath: index.html` giữ nguyên).

### Error Handling

- Callback timer kiểm tra `p >= 0 && p < i.length` và `i.length > 0` trước khi `y()`.
- Nếu playlist rỗng hoặc đang ở màn setup QR thì không đặt timer.
- Poll QR (`startSetupPolling`) không bị ảnh hưởng.

## Testing

- `vitest` package test cũ phải pass (fullscreen-mode, ChannelUp, group-title, worker URL, localStorage, XMLHttpRequest, cấm fetch/arrow/const/let).
- Thêm assert mới: `dist/inject.js` chứa `ZAP_DELAY`/`zapTimer`/`10000` + `clearTimeout` trong nhánh Up/Down, `Enter` hủy timer rồi play ngay.
- Test tay: mở `index.html`, load playlist, đang phát bấm Up/Down liên tục → video cũ vẫn phát, highlight chạy, status hiện Preview; dừng 10s → tự chuyển; bấm Enter giữa chừng → chuyển ngay; focus menu-item → không tự play.

## Verification Before Publish

- `npm run pack:check` trong `packages/templates/tizenbrew-iptv`.
- Kiểm tra syntax ES5 (không `=>`, `const`, `let`, `?.`, `fetch`).
- Không tăng version npm trong bước này (publish riêng).
