package com.idrok.app.widget;

import android.content.Context;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Ilova -> bosh ekran vidjeti ko'prigi. JS: registerPlugin('IdrokWidget').update({ data }).
 * JSON SharedPreferences ga yoziladi va ACTION_APPWIDGET_UPDATE yuboriladi.
 */
@CapacitorPlugin(name = "IdrokWidget")
public class IdrokWidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            call.reject("data is required");
            return;
        }
        Context context = getContext();
        context.getSharedPreferences(IdrokWidgetProvider.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(IdrokWidgetProvider.KEY_DATA, data)
            .apply();
        IdrokWidgetProvider.refreshAll(context);
        call.resolve();
    }
}
