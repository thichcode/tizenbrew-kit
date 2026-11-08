package com.shortvideo.tv;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class UpdateManager {

    private static final String TAG = "UpdateManager";
    private static final String VERSION_ENDPOINT = "https://shortvideo-feed.dvt-kisu.workers.dev/api/app-version";
    private static final String PREF_NAME = "shortvideo_update_prefs";
    private static final String PREF_WEB_VERSION = "local_web_version";
    private static final ExecutorService executor = Executors.newSingleThreadExecutor();

    public static File getCustomWebInjectFile(Context context) {
        File webFile = new File(context.getFilesDir(), "web/inject.js");
        if (webFile.exists() && webFile.length() > 500) {
            return webFile;
        }
        return null;
    }

    public static void checkAndUpdate(Activity activity) {
        executor.execute(() -> {
            try {
                String jsonStr = fetchString(VERSION_ENDPOINT);
                if (jsonStr == null || jsonStr.isEmpty()) return;

                JSONObject obj = new JSONObject(jsonStr);
                if (!obj.optBoolean("ok", false)) return;

                // 1. Web Bundle OTA Check & Download
                checkWebBundleUpdate(activity, obj);

                // 2. Native APK Check & Download
                checkApkUpdate(activity, obj);

            } catch (Exception e) {
                Log.w(TAG, "Update check failed: " + e.getMessage());
            }
        });
    }

    private static void checkWebBundleUpdate(Activity activity, JSONObject obj) {
        try {
            String remoteWebVersion = obj.optString("webVersion", "");
            String webBundleUrl = obj.optString("webBundleUrl", "");
            String fallbackUrl = obj.optString("webBundleFallbackUrl", "");
            if (remoteWebVersion.isEmpty() || webBundleUrl.isEmpty()) return;

            SharedPreferences prefs = activity.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            String localWebVersion = prefs.getString(PREF_WEB_VERSION, "");

            File activeFile = new File(activity.getFilesDir(), "web/inject.js");
            if (remoteWebVersion.equals(localWebVersion) && activeFile.exists() && activeFile.length() > 500) {
                return;
            }

            File webDir = new File(activity.getFilesDir(), "web");
            if (!webDir.exists()) webDir.mkdirs();

            File tmpFile = new File(webDir, "inject.js.tmp");
            boolean downloaded = downloadFile(webBundleUrl, tmpFile);
            if (!downloaded && !fallbackUrl.isEmpty()) {
                downloaded = downloadFile(fallbackUrl, tmpFile);
            }

            if (downloaded && tmpFile.length() > 500) {
                if (activeFile.exists()) activeFile.delete();
                if (tmpFile.renameTo(activeFile)) {
                    prefs.edit().putString(PREF_WEB_VERSION, remoteWebVersion).apply();
                    Log.i(TAG, "OTA Web bundle updated silently to " + remoteWebVersion);
                }
            } else {
                tmpFile.delete();
            }
        } catch (Exception e) {
            Log.w(TAG, "Web bundle OTA check failed: " + e.getMessage());
        }
    }

    private static void checkApkUpdate(Activity activity, JSONObject obj) {
        try {
            int remoteVersionCode = obj.optInt("apkVersionCode", 0);
            String remoteVersionName = obj.optString("apkVersion", "");
            String apkUrl = obj.optString("apkUrl", "");
            String changelog = obj.optString("changelog", "Bản cập nhật mới với nhiều cải tiến và sửa lỗi.");

            if (apkUrl.isEmpty() || remoteVersionCode <= 0) return;

            PackageInfo pInfo = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
            int currentVersionCode = pInfo.versionCode;

            if (remoteVersionCode <= currentVersionCode) return;

            File cacheDir = activity.getExternalCacheDir() != null ? activity.getExternalCacheDir() : activity.getCacheDir();
            File apkFile = new File(cacheDir, "ShortVideoTV_v" + remoteVersionCode + ".apk");

            // Download APK in background if not already present
            if (!apkFile.exists() || apkFile.length() < 100000) {
                File tmpApk = new File(cacheDir, "update.apk.tmp");
                boolean downloaded = downloadFile(apkUrl, tmpApk);
                if (downloaded && tmpApk.length() > 100000) {
                    if (apkFile.exists()) apkFile.delete();
                    tmpApk.renameTo(apkFile);
                } else {
                    tmpApk.delete();
                    return;
                }
            }

            if (apkFile.exists() && apkFile.length() > 100000) {
                activity.runOnUiThread(() -> showUpdatePrompt(activity, apkFile, remoteVersionName, changelog));
            }
        } catch (Exception e) {
            Log.w(TAG, "Native APK update check failed: " + e.getMessage());
        }
    }

    private static void showUpdatePrompt(Activity activity, File apkFile, String versionName, String changelog) {
        if (activity.isFinishing() || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1 && activity.isDestroyed())) {
            return;
        }

        AlertDialog dialog = new AlertDialog.Builder(activity)
            .setTitle("Có bản cập nhật mới (" + versionName + ")")
            .setMessage(changelog + "\n\nBấm 'Cập nhật' để cài đặt ngay.")
            .setPositiveButton("Cập nhật", (d, which) -> installApk(activity, apkFile))
            .setNegativeButton("Để sau", (d, which) -> d.dismiss())
            .setCancelable(true)
            .create();

        dialog.show();
    }

    private static void installApk(Activity activity, File apkFile) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            Uri apkUri = FileProvider.getUriForFile(
                activity,
                activity.getPackageName() + ".fileprovider",
                apkFile
            );
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "Failed to launch package installer: " + e.getMessage());
        }
    }

    private static String fetchString(String endpoint) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(endpoint);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(10000);
            conn.setRequestProperty("User-Agent", "ShortVideoTV-Android");
            if (conn.getResponseCode() == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                reader.close();
                return sb.toString();
            }
        } catch (Exception e) {
            Log.w(TAG, "fetchString failed: " + e.getMessage());
        } finally {
            if (conn != null) conn.disconnect();
        }
        return null;
    }

    private static boolean downloadFile(String fileUrl, File destFile) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(fileUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setInstanceFollowRedirects(true);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);
            conn.setRequestProperty("User-Agent", "ShortVideoTV-Android");

            int responseCode = conn.getResponseCode();
            if (responseCode == HttpURLConnection.HTTP_MOVED_PERM || responseCode == HttpURLConnection.HTTP_MOVED_TEMP || responseCode == 307 || responseCode == 308) {
                String newUrl = conn.getHeaderField("Location");
                conn.disconnect();
                conn = (HttpURLConnection) new URL(newUrl).openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(30000);
                conn.setRequestProperty("User-Agent", "ShortVideoTV-Android");
            }

            if (conn.getResponseCode() != 200) return false;

            try (InputStream in = conn.getInputStream();
                 FileOutputStream out = new FileOutputStream(destFile)) {
                byte[] buffer = new byte[8192];
                int bytesRead;
                while ((bytesRead = in.read(buffer)) != -1) {
                    out.write(buffer, 0, bytesRead);
                }
                out.flush();
            }
            return true;
        } catch (Exception e) {
            Log.w(TAG, "downloadFile failed from " + fileUrl + ": " + e.getMessage());
            return false;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }
}
