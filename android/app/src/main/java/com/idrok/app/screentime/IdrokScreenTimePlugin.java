package com.idrok.app.screentime;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Calendar;

/**
 * Ekran vaqti (UsageStatsManager). JS: registerPlugin('IdrokScreenTime').
 *  - getTodayScreenTime({ startMs? })  -> { granted, minutes }
 *  - getScreenTime({ startMs, endMs }) -> { granted, minutes }
 *  - requestPermission()               -> "Foydalanish ma'lumotlariga ruxsat" sozlamasini ochadi
 * Hisob: oraliqdagi ilovalarning oldingi plandagi vaqti yig'indisi (bosh ekran — launcher — hisobga olinmaydi).
 */
@CapacitorPlugin(name = "IdrokScreenTime")
public class IdrokScreenTimePlugin extends Plugin {

    @PluginMethod
    public void getTodayScreenTime(PluginCall call) {
        long now = System.currentTimeMillis();
        Long startArg = call.getLong("startMs");
        long start;
        if (startArg != null && startArg > 0 && startArg < now) {
            start = startArg;
        } else {
            Calendar c = Calendar.getInstance();
            c.set(Calendar.HOUR_OF_DAY, 0);
            c.set(Calendar.MINUTE, 0);
            c.set(Calendar.SECOND, 0);
            c.set(Calendar.MILLISECOND, 0);
            start = c.getTimeInMillis();
        }
        resolveRange(call, start, now);
    }

    @PluginMethod
    public void getScreenTime(PluginCall call) {
        long now = System.currentTimeMillis();
        Long startArg = call.getLong("startMs");
        Long endArg = call.getLong("endMs");
        if (startArg == null || startArg <= 0) {
            call.reject("startMs is required");
            return;
        }
        long end = (endArg == null || endArg <= 0 || endArg > now) ? now : endArg;
        if (end <= startArg) {
            call.reject("invalid range");
            return;
        }
        resolveRange(call, startArg, end);
    }

    @PluginMethod
    public void isGranted(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasUsageAccess());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        Context context = getContext();
        Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            // Ba'zi qurilmalarda to'g'ridan-to'g'ri shu ilova sahifasi ochiladi
            Intent direct = new Intent(intent);
            direct.setData(Uri.parse("package:" + context.getPackageName()));
            if (direct.resolveActivity(context.getPackageManager()) != null) {
                context.startActivity(direct);
            } else {
                context.startActivity(intent);
            }
        } catch (Exception e) {
            try {
                context.startActivity(intent);
            } catch (Exception e2) {
                call.reject("settings_unavailable");
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("granted", hasUsageAccess());
        call.resolve(ret);
    }

    private void resolveRange(PluginCall call, long start, long end) {
        JSObject ret = new JSObject();
        if (!hasUsageAccess()) {
            ret.put("granted", false);
            ret.put("minutes", 0);
            call.resolve(ret);
            return;
        }
        try {
            long ms = foregroundMillis(start, end);
            ret.put("granted", true);
            ret.put("minutes", (int) Math.round(ms / 60000.0));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("usage_query_failed", e);
        }
    }

    private boolean hasUsageAccess() {
        Context context = getContext();
        try {
            AppOpsManager ops = (AppOpsManager) context.getSystemService(Context.APP_OPS_SERVICE);
            int mode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                mode = ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.getPackageName());
            } else {
                mode = ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.getPackageName());
            }
            if (mode == AppOpsManager.MODE_DEFAULT) {
                return context.checkCallingOrSelfPermission(android.Manifest.permission.PACKAGE_USAGE_STATS)
                    == PackageManager.PERMISSION_GRANTED;
            }
            return mode == AppOpsManager.MODE_ALLOWED;
        } catch (Exception e) {
            return false;
        }
    }

    private String launcherPackage() {
        try {
            Intent home = new Intent(Intent.ACTION_MAIN);
            home.addCategory(Intent.CATEGORY_HOME);
            ResolveInfo info = getContext().getPackageManager().resolveActivity(home, PackageManager.MATCH_DEFAULT_ONLY);
            return info != null && info.activityInfo != null ? info.activityInfo.packageName : null;
        } catch (Exception e) {
            return null;
        }
    }

    /** Oraliqdagi oldingi plan vaqti (ms): RESUMED/PAUSED hodisalari juftligi bo'yicha. */
    private long foregroundMillis(long start, long end) {
        UsageStatsManager usm = (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) return 0;
        String launcher = launcherPackage();
        // Oraliq boshlanishidan oldin ochilgan ilovani ham ushlash uchun biroz oldindan o'qiymiz
        long lookback = 3L * 60 * 60 * 1000;
        UsageEvents events = usm.queryEvents(Math.max(0, start - lookback), end);
        UsageEvents.Event ev = new UsageEvents.Event();

        long total = 0;
        String current = null; // hozir oldingi plandagi paket
        long currentSince = 0;

        while (events.hasNextEvent()) {
            events.getNextEvent(ev);
            int type = ev.getEventType();
            String pkg = ev.getPackageName();
            long ts = ev.getTimeStamp();
            if (pkg == null) continue;

            if (type == UsageEvents.Event.MOVE_TO_FOREGROUND) { // = ACTIVITY_RESUMED
                if (current != null && !current.equals(pkg)) {
                    total += overlap(currentSince, ts, start, end);
                }
                if (pkg.equals(launcher)) {
                    current = null;
                } else if (!pkg.equals(current)) {
                    current = pkg;
                    currentSince = ts;
                }
            } else if (type == UsageEvents.Event.MOVE_TO_BACKGROUND) { // = ACTIVITY_PAUSED
                if (pkg.equals(current)) {
                    total += overlap(currentSince, ts, start, end);
                    current = null;
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                && (type == UsageEvents.Event.SCREEN_NON_INTERACTIVE || type == UsageEvents.Event.DEVICE_SHUTDOWN)) {
                if (current != null) {
                    total += overlap(currentSince, ts, start, end);
                    current = null;
                }
            }
        }
        if (current != null) {
            total += overlap(currentSince, end, start, end);
        }
        return total;
    }

    private static long overlap(long a, long b, long start, long end) {
        long s = Math.max(a, start);
        long e = Math.min(b, end);
        return e > s ? e - s : 0;
    }
}
