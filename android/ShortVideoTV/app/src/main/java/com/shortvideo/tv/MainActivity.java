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
        webView.setWebViewClient(new WebViewClient());
        webView.loadUrl("file:///android_asset/web/index.html");
        webView.addJavascriptInterface(new VideoBridge(this), "AndroidBridge");

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
        private final WeakReference<Activity> activityRef;

        VideoBridge(Activity activity) {
            this.activityRef = new WeakReference<>(activity);
        }

        @JavascriptInterface
        public void openVideo(String url, String title) {
            Activity activity = activityRef.get();
            if (activity == null || url == null || url.isEmpty()) return;

            Intent intent = new Intent(activity, PlayerActivity.class);
            intent.putExtra("videoUrl", url);
            intent.putExtra("title", title != null ? title : "");
            activity.startActivity(intent);
        }
    }
}
