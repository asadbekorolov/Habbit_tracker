package com.tracker.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.capacitorjs.plugins.localnotifications.LocalNotificationsPlugin;
import com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocalNotificationsPlugin.class);
        registerPlugin(GoogleAuth.class);
        super.onCreate(savedInstanceState);
        // Clear cache on startup for development to avoid stale asset issues
        WebView webView = this.bridge.getWebView();
        webView.clearCache(true);
    }
}
