# TizenBrew IPTV Zap Debounce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Up/Down chuyển kênh debounce 10s (preview trước, Enter chuyển ngay) trong `tizenbrew-iptv`.

**Architecture:** Thêm `zapTimer` + `ZAP_DELAY=10000` vào `dist/inject.js`, đổi `L()` từ play-ngay sang preview + hẹn giờ, Enter/click/số hủy timer và play ngay. Giữ ES5, giữ nguyên QR flow và fullscreen.

**Tech Stack:** ES5 JavaScript (Tizen 3), XMLHttpRequest sẵn có, vitest package-format tests, npm pack dry-run.

---

## File Structure

- Modify: `packages/templates/tizenbrew-iptv/dist/inject.js` — thêm vars, sửa `L()`, `G()`, `j()`, `Y()`, `resetPlaylist()`, nhánh `MediaStop`.
- Modify: `packages/templates/tizenbrew-iptv/test/package.test.ts` — thêm asserts debounce (TDD, viết trước).
- Spec ref: `docs/superpowers/specs/2026-09-27-tizenbrew-iptv-zap-debounce-design.md` — không sửa trong plan này.
- No new files, no package.json change.

### Task 1: Thêm failing test cho debounce

**Files:**
- Modify: `packages/templates/tizenbrew-iptv/test/package.test.ts`
- Test: `packages/templates/tizenbrew-iptv/test/package.test.ts`

- [ ] **Step 1: Write the failing test**

Thêm block mới cuối file (giữ nguyên 3 test cũ):

```typescript
it('debounces Up/Down 10s: preview first, Enter plays immediately', () => {
  const inject = readFileSync(resolve(root, 'dist/inject.js'), 'utf8');

  // hằng số + timer tồn tại
  expect(inject).toContain('ZAP_DELAY');
  expect(inject).toContain('zapTimer');
  expect(inject).toContain('10000');
  // Up/Down dùng clearTimeout + setTimeout, không gọi y( play ) đồng bộ trong L
  expect(inject).toMatch(/clearTimeout\(zapTimer\)/);
  expect(inject).toMatch(/zapTimer\s*=\s*setTimeout/);
  // Enter hủy timer
  expect(inject).toMatch(/clearTimeout\(zapTimer\)[\s\S]{0,200}y\(p\)/);
  // vẫn giữ ES5
  expect(inject).not.toMatch(/\bconst\b|\blet\b|=>/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter tizenbrew-iptv test 2>&1 | head -n 80`
Expected: FAIL — `expected ... to contain 'ZAP_DELAY'` (vì `dist/inject.js` chưa có).

- [ ] **Step 3: Commit test only (red)**

```bash
git add packages/templates/tizenbrew-iptv/test/package.test.ts
git commit -m "test: failing zap debounce 10s for tizenbrew-iptv"
```

### Task 2: Thêm zapTimer + ZAP_DELAY vars

**Files:**
- Modify: `packages/templates/tizenbrew-iptv/dist/inject.js:7`
- Test: `packages/templates/tizenbrew-iptv/test/package.test.ts`

- [ ] **Step 1: Implement minimal vars**

Tìm dòng 7 hiện tại:

```js
var i = [], p = 0, v = "", w = null, S = 1e4, b = null, V = !1, a = null, h = null, k = null, T = null, B = {
```

Đổi thành (thêm 2 var ES5, giữ nguyên còn lại):

```js
var i = [], p = 0, v = "", w = null, S = 1e4, b = null, V = !1, a = null, h = null, k = null, T = null, zapTimer = null, ZAP_DELAY = 10000, B = {
```

- [ ] **Step 2: Run test (vẫn fail, mới pass 1 assert)**

Run: `pnpm --filter tizenbrew-iptv test 2>&1 | head -n 80`
Expected: vẫn FAIL ở `clearTimeout(zapTimer)` / `setTimeout`.

- [ ] **Step 3: Commit**

```bash
git add packages/templates/tizenbrew-iptv/dist/inject.js
git commit -m "feat: add zapTimer vars for tizenbrew-iptv"
```

### Task 3: Đổi L() sang preview + debounce 10s (core)

**Files:**
- Modify: `packages/templates/tizenbrew-iptv/dist/inject.js:640-655`
- Test: `packages/templates/tizenbrew-iptv/test/package.test.ts`

- [ ] **Step 1: Replace L() implementation**

Code cũ (dòng ~640):

```js
function L(e) {
  if (i.length !== 0) {
    var n = p + e;
    if (n >= i.length) {
      if (p === i.length) { n = 0; }
      else {
        var menuEl = document.querySelector(".menu-item");
        if (menuEl) { p = i.length; D(p); menuEl.focus(); g(); return; }
        n = 0;
      }
    } else if (n < 0) {
      n = i.length - 1;
    }
    y(n); x();
  }
}
```

Code mới:

```js
function L(e) {
  if (i.length !== 0) {
    var n = p + e;
    if (n >= i.length) {
      if (p === i.length) { n = 0; }
      else {
        var menuEl = document.querySelector(".menu-item");
        if (menuEl) { p = i.length; D(p); menuEl.focus(); g(); return; }
        n = 0;
      }
    } else if (n < 0) {
      n = i.length - 1;
    }
    if (n === i.length) { p = n; D(n); x(); g(); return; }
    p = n;
    D(n);
    x();
    var ch = i[n];
    if (ch) { E("Preview: " + ch.name + " - Enter de xem ngay"); d("Preview - tu chuyen sau 10s"); }
    if (zapTimer) { clearTimeout(zapTimer); zapTimer = null; }
    var target = n;
    zapTimer = setTimeout(function() { zapTimer = null; if (target >= 0 && target < i.length) { y(target); } }, ZAP_DELAY);
    g();
  }
}
```

Lưu ý: giữ `var` (không let/const/arrow), giữ nhánh menu-item không đặt timer.

- [ ] **Step 2: Run test**

Run: `pnpm --filter tizenbrew-iptv test 2>&1 | head -n 80`
Expected: gần PASS, chỉ còn FAIL ở Enter-clear assert nếu chưa sửa G().

- [ ] **Step 3: Commit**

```bash
git add packages/templates/tizenbrew-iptv/dist/inject.js
git commit -m "feat: debounce Up/Down 10s preview in tizenbrew-iptv"
```

### Task 4: Enter / click / số / reset / stop hủy timer và play ngay

**Files:**
- Modify: `packages/templates/tizenbrew-iptv/dist/inject.js:616,677-688,721-770`
- Test: `packages/templates/tizenbrew-iptv/test/package.test.ts`

- [ ] **Step 1: Sửa j() (click) hủy timer**

Cũ: `function j(e) { return function() { y(e); }; }`

Mới:

```js
function j(e) { return function() { if (zapTimer) { clearTimeout(zapTimer); zapTimer = null; } y(e); }; }
```

- [ ] **Step 2: Sửa Y() (nhập số) hủy timer**

Cũ:

```js
function Y() {
  if (v) {
    var e = parseInt(v, 10);
    v = "", e >= 1 && e <= i.length && (y(e - 1), x());
  }
}
```

Mới:

```js
function Y() {
  if (v) {
    var e = parseInt(v, 10);
    v = "", e >= 1 && e <= i.length && (zapTimer && (clearTimeout(zapTimer), zapTimer = null), y(e - 1), x());
  }
}
```

- [ ] **Step 3: Sửa resetPlaylist() hủy timer**

Cũ:

```js
function resetPlaylist() {
  try { localStorage.removeItem(LS); } catch (r) {}
  I = "";
  showSetup();
}
```

Mới:

```js
function resetPlaylist() {
  if (zapTimer) { clearTimeout(zapTimer); zapTimer = null; }
  try { localStorage.removeItem(LS); } catch (r) {}
  I = "";
  showSetup();
}
```

- [ ] **Step 4: Sửa G() Enter + MediaStop**

Enter cũ:

```js
case "Enter":
  e.preventDefault();
  if (p === i.length) { resetPlaylist(); } else { y(p); }
  break;
```

Enter mới:

```js
case "Enter":
  e.preventDefault();
  if (zapTimer) { clearTimeout(zapTimer); zapTimer = null; }
  if (p === i.length) { resetPlaylist(); } else { y(p); }
  break;
```

MediaStop cũ:

```js
case "MediaStop":
  e.preventDefault();
  if (a) { a.pause(); a.src = ""; }
  break;
```

MediaStop mới:

```js
case "MediaStop":
  e.preventDefault();
  if (zapTimer) { clearTimeout(zapTimer); zapTimer = null; }
  if (a) { a.pause(); try { a.removeAttribute("src"); a.load(); } catch (err) {} }
  break;
```

Giữ nguyên `a.src = ""` cũng được nếu sợ hồi quy — chọn `removeAttribute+load` để stop sạch hơn nhưng vẫn ES5. Nếu muốn an toàn tuyệt đối thì giữ `a.src = ""`.

- [ ] **Step 5: Run full tests**

Run: `pnpm --filter tizenbrew-iptv test 2>&1 | head -n 100`
Expected: PASS all (3 cũ + 1 mới).

- [ ] **Step 6: Pack + syntax check**

Run: `pnpm --filter tizenbrew-iptv exec npm run pack:check 2>&1 | head -n 40`
Expected: tarball list `index.html`, `dist/inject.js`, không lỗi.

- [ ] **Step 7: Commit**

```bash
git add packages/templates/tizenbrew-iptv/dist/inject.js packages/templates/tizenbrew-iptv/test/package.test.ts
git commit -m "feat: Enter/click/number cancel zap timer, stop clears pending"
```
