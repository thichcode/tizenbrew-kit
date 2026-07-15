package com.shortvideo.tv;

import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.widget.FrameLayout;

import androidx.appcompat.app.AppCompatActivity;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;

public class PlayerActivity extends AppCompatActivity {

    private ExoPlayer player;
    private PlayerView playerView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        String videoUrl = getIntent().getStringExtra("videoUrl");
        boolean showLoading = getIntent().getBooleanExtra("showLoading", false);

        playerView = new PlayerView(this);
        playerView.setUseController(true);
        playerView.setKeepScreenOn(true);

        FrameLayout root = new FrameLayout(this);
        root.addView(playerView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));
        setContentView(root);

        player = new ExoPlayer.Builder(this).build();
        playerView.setPlayer(player);

        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int playbackState) {
                if (playbackState == Player.STATE_READY && showLoading) {
                    View loading = getWindow().getDecorView().findViewWithTag("loading");
                    if (loading != null) loading.setVisibility(View.GONE);
                }
            }
        });

        if (videoUrl != null) {
            MediaItem mediaItem = MediaItem.fromUri(videoUrl);
            player.setMediaItem(mediaItem);
            player.prepare();
            player.play();
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            finish();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (player != null) {
            player.stop();
        }
    }

    @Override
    protected void onDestroy() {
        if (player != null) {
            player.release();
            player = null;
        }
        super.onDestroy();
    }
}
