package com.shortvideo.tv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;

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
    }
}
