package com.idrok.app;

import android.content.pm.ApplicationInfo;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.capacitorjs.plugins.localnotifications.LocalNotificationsPlugin;
import com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth;
import com.idrok.app.widget.IdrokWidgetPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocalNotificationsPlugin.class);
        registerPlugin(GoogleAuth.class);
        registerPlugin(IdrokWidgetPlugin.class); // bosh ekran vidjeti ko'prigi (widgetSync.ts)
        super.onCreate(savedInstanceState);
        
        boolean isDebug = (0 != (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE));
        if (isDebug) {
            WebView webView = this.bridge.getWebView();
            if (webView != null) {
                webView.clearCache(true);
            }
        }
    }
}
