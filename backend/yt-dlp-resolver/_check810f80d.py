# Verify: thu tu uu tien SD truoc HD trong scrape_facebook_og + UA moi + proxy mac dinh.
import re, subprocess, sys, os, json

# --- 1. UU TIEN SD TRUOC HD (parse HTML Facebook gia lap) ---
sys.path.insert(0, r'D:\pupeteer\find_football\tizenbrew-kit\backend\yt-dlp-resolver')
import app as A

HTML = r'''
<meta property="og:video:secure_url" content="https://video-den2-1.xx.fbcdn.net/HD_AV1.mp4">
<script>{"browser_native_hd_url":"https:\u002F\u002Fvideo-den2-1.xx.fbcdn.net\/HD_H264.mp4",
"browser_native_sd_url":"https:\u002F\u002Fvideo-den2-1.xx.fbcdn.net\/SD_H264.mp4"}</script>
'''

# goi extract_json_url qua closure: tai lai ham bang cach dung regex trucc tiep
def extract_json_url(html, key):
    m = re.search(rf'\\?"{key}\\?"\s*:\s*\\?"([^"\\]*(?:\\.[^"\\]*)*)\\?"', html, re.I)
    if not m:
        return None
    u = m.group(1).replace(r"\u0025", "%").replace(r"\u0026", "&").replace(r"\u002F", "/").replace("\\", "")
    return u if u.startswith("http") else None

sd = extract_json_url(HTML, "browser_native_sd_url")
hd = extract_json_url(HTML, "browser_native_hd_url")
print("=== extract_json_url ===")
print("  SD url:", sd)
print("  HD url:", hd)
print("  giai ma \u002F chuan:", bool(sd and sd.startswith("https://") and "//" not in sd[8:]))

# thu tu uu tien trong source
src = open(A.__file__, encoding="utf-8").read()
blk = src[src.index("video_url = ("):src.index("if not video_url")]
order = re.findall(r'extract_(?:json_url|meta)\("([^"]+)"\)', blk)
print("  thu tu uu tien:", order)
sd_pos = min(order.index(k) for k in order if k in ("browser_native_sd_url", "playable_url", "sd_src"))
hd_pos = max(order.index(k) for k in order if k in ("browser_native_hd_url", "playable_url_quality_hd", "hd_src"))
print(f"  SD index {sd_pos} < HD index {hd_pos} ->", sd_pos < hd_pos)

# --- 2. UA moi la Tizen TV ---
print("\n=== UA ===")
print(" ", A.UA)
print("  co 'Tizen':", "Tizen" in A.UA)
print("  KHONG con Chrome desktop:", "Chrome/131" not in A.UA)

# --- 3. Proxy mac dinh: khong env -> None (khong doi hanh vi) ---
print("\n=== proxy ===")
for v in ("PROXY_URL", "HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "PROXY_USER", "PROXY_PASS", "PROXY_HOST", "PROXY_PORT", "ENABLE_PROXY"):
    os.environ.pop(v, None)
print("  get_proxy_url() =", A.get_proxy_url(), "(phai None)")
print("  version:", A.app.version)