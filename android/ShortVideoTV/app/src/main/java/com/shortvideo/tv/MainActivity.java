package com.shortvideo.tv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.ref.WeakReference;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends Activity {

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        webView.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        webView.setWebViewClient(new WebViewClient());
        webView.loadUrl("file:///android_asset/web/index.html");
        webView.addJavascriptInterface(new VideoBridge(webView), "AndroidBridge");

        setContentView(webView);
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript(
                "(function(){var e=new KeyboardEvent('keydown',{key:'Escape',keyCode:27,which:27,bubbles:true});document.dispatchEvent(e)})()",
                null
            );
        } else {
            super.onBackPressed();
        }
    }

    private static class VideoBridge {
        private final WeakReference<WebView> webViewRef;

        VideoBridge(WebView webView) {
            this.webViewRef = new WeakReference<>(webView);
        }

        @JavascriptInterface
        public void openVideo(String url, String title) {
            WebView wv = webViewRef.get();
            if (wv == null) return;
            Activity activity = (Activity) wv.getContext();
            if (url == null || url.isEmpty()) return;

            Intent intent = new Intent(activity, PlayerActivity.class);
            intent.putExtra("videoUrl", url);
            intent.putExtra("title", title != null ? title : "");
            activity.startActivity(intent);
        }

        @JavascriptInterface
        public void log(String message) {
            WebView wv = webViewRef.get();
            if (wv == null) return;
            final String js = "javascript:console.log('" + escapeJs(message) + "')";
            wv.post(() -> wv.evaluateJavascript(js, null));
        }

        @JavascriptInterface
        public void resolveTikTok(final String pageUrl, final String callbackId) {
            new Thread(() -> {
                try {
                    URL url = new URL(pageUrl);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 10; Android TV) AppleWebKit/537.36");
                    conn.setRequestProperty("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
                    conn.setInstanceFollowRedirects(true);
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(15000);

                    BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
                    StringBuilder html = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        html.append(line).append('\n');
                    }
                    reader.close();

                    String page = html.toString();
                    String videoUrl = extractVideoUrl(page);
                    String title = extractTitle(page);

                    String json = String.format(
                        "{\"videoUrl\":%s,\"title\":%s}",
                        videoUrl != null ? "\"" + escapeJson(videoUrl) + "\"" : "null",
                        title != null ? "\"" + escapeJson(title) + "\"" : "null"
                    );

                    final String js = "javascript:__onTikTokResult('" + escapeJs(callbackId) + "'," + json + ")";
                    WebView wv = webViewRef.get();
                    if (wv != null) {
                        wv.post(() -> wv.evaluateJavascript(js, null));
                    }
                } catch (Exception e) {
                    String err = e.getMessage() != null ? e.getMessage() : "Unknown error";
                    String json = String.format("{\"videoUrl\":null,\"title\":\"%s\"}", escapeJson(err));
                    WebView wv = webViewRef.get();
                    if (wv != null) {
                        final String js = "javascript:__onTikTokResult('" + escapeJs(callbackId) + "'," + json + ")";
                        wv.post(() -> wv.evaluateJavascript(js, null));
                    }
                }
            }).start();
        }

        private String extractVideoUrl(String html) {
            Pattern p = Pattern.compile("\"(?:playAddr|downloadAddr)\"\\s*:\\s*\"([^\"]+)\"");
            Matcher m = p.matcher(html);
            if (m.find()) {
                return decodeUnicode(m.group(1));
            }
            return null;
        }

        private String extractTitle(String html) {
            Pattern p = Pattern.compile("<title[^>]*>([^<]+)</title>");
            Matcher m = p.matcher(html);
            if (m.find()) {
                String t = m.group(1).trim();
                if (t.contains(" - ")) t = t.substring(0, t.indexOf(" - "));
                return t;
            }
            return null;
        }

        private String decodeUnicode(String s) {
            StringBuilder sb = new StringBuilder(s);
            int i = sb.indexOf("\\u");
            while (i >= 0 && i + 5 < sb.length()) {
                String hex = sb.substring(i + 2, i + 6);
                try {
                    char c = (char) Integer.parseInt(hex, 16);
                    sb.replace(i, i + 6, String.valueOf(c));
                } catch (NumberFormatException ignored) {}
                i = sb.indexOf("\\u", i + 1);
            }
            return sb.toString();
        }

        private String escapeJson(String s) {
            return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
        }

        private String escapeJs(String s) {
            return s.replace("\\", "\\\\").replace("'", "\\'");
        }
    }
}
