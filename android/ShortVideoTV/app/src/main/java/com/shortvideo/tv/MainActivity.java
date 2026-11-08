package com.shortvideo.tv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.File;
import java.io.FileInputStream;
import java.lang.ref.WeakReference;

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
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (request != null && request.getUrl() != null) {
                    String path = request.getUrl().getPath();
                    if (path != null && path.endsWith("inject.js")) {
                        File customBundle = UpdateManager.getCustomWebInjectFile(MainActivity.this);
                        if (customBundle != null) {
                            try {
                                return new WebResourceResponse(
                                    "application/javascript",
                                    "UTF-8",
                                    new FileInputStream(customBundle)
                                );
                            } catch (Exception ignored) {}
                        }
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }
        });
        // Register the JS bridge BEFORE loading the page, otherwise the web app
        // can boot before window.AndroidBridge exists and falls back to the
        // HTML5 <video> player, which cannot play Facebook CDN streams.
        webView.addJavascriptInterface(new VideoBridge(webView), "AndroidBridge");

        setContentView(webView);
        webView.loadUrl("file:///android_asset/web/index.html");

        // Trigger background update check (Web bundle OTA + Native APK)
        UpdateManager.checkAndUpdate(this);
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
    }
}
