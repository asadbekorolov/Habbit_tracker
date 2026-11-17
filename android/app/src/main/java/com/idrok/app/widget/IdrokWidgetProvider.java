package com.idrok.app.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

import com.idrok.app.MainActivity;
import com.idrok.app.R;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * "IDROK — Bugungi odatlar" bosh ekran vidjeti (4x2).
 * Ma'lumot ilovadan (src/services/widgetSync.ts -> IdrokWidgetPlugin) JSON
 * ko'rinishida SharedPreferences ga yoziladi; shakli src/utils/widgetData.ts.
 */
public class IdrokWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "idrok_widget";
    static final String KEY_DATA = "data";

    private static final int[] HABIT_ROWS = {
        R.id.widget_habit_1, R.id.widget_habit_2, R.id.widget_habit_3, R.id.widget_habit_4
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            manager.updateAppWidget(id, buildViews(context));
        }
    }

    /** Ilovadan yangi ma'lumot kelganda — barcha vidjetlarni yangilash (broadcast). */
    public static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, IdrokWidgetProvider.class));
        if (ids == null || ids.length == 0) return;
        Intent intent = new Intent(context, IdrokWidgetProvider.class);
        intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        context.sendBroadcast(intent);
    }

    private static String tashkentToday() {
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        fmt.setTimeZone(TimeZone.getTimeZone("Asia/Tashkent"));
        return fmt.format(new Date());
    }

    static RemoteViews buildViews(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.idrok_widget);

        // Vidjet bosilganda — ilova
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
            context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pending);

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String raw = prefs.getString(KEY_DATA, null);

        int done = 0, total = 0, pct = 0, streak = 0;
        String daysLabel = context.getString(R.string.widget_days);
        String emptyLabel = context.getString(R.string.widget_empty);
        String staleLabel = context.getString(R.string.widget_stale);
        JSONArray habits = null;
        boolean stale = true;

        if (raw != null) {
            try {
                JSONObject data = new JSONObject(raw);
                JSONObject labels = data.optJSONObject("labels");
                if (labels != null) {
                    daysLabel = labels.optString("days", daysLabel);
                    emptyLabel = labels.optString("empty", emptyLabel);
                    staleLabel = labels.optString("stale", staleLabel);
                }
                streak = data.optInt("streak", 0);
                stale = !tashkentToday().equals(data.optString("date", ""));
                if (!stale) {
                    done = data.optInt("done", 0);
                    total = data.optInt("total", 0);
                    pct = data.optInt("pct", 0);
                    habits = data.optJSONArray("habits");
                }
            } catch (Exception ignored) {
                stale = true;
            }
        }

        views.setTextViewText(R.id.widget_streak, streak + " " + daysLabel);

        if (stale) {
            views.setTextViewText(R.id.widget_progress_text, "—");
            views.setProgressBar(R.id.widget_progress, 100, 0, false);
        } else {
            views.setTextViewText(R.id.widget_progress_text, done + "/" + total + " • " + pct + "%");
            views.setProgressBar(R.id.widget_progress, 100, pct, false);
        }

        int shown = 0;
        if (habits != null) {
            for (int i = 0; i < HABIT_ROWS.length && i < habits.length(); i++) {
                JSONObject h = habits.optJSONObject(i);
                if (h == null) continue;
                boolean isDone = h.optBoolean("done", false);
                int row = HABIT_ROWS[shown]; // qatorlar bo'shliqsiz to'ldiriladi
                views.setViewVisibility(row, View.VISIBLE);
                views.setTextViewText(row, h.optString("name", ""));
                views.setTextViewCompoundDrawablesRelative(row,
                    isDone ? R.drawable.ic_widget_check : R.drawable.ic_widget_circle, 0, 0, 0);
                views.setTextColor(row, isDone ? 0xFF6EE7B7 : 0xFFE2E8F0);
                shown++;
            }
        }
        for (int i = shown; i < HABIT_ROWS.length; i++) {
            views.setViewVisibility(HABIT_ROWS[i], View.GONE);
        }

        if (shown == 0) {
            views.setViewVisibility(R.id.widget_message, View.VISIBLE);
            views.setTextViewText(R.id.widget_message, stale ? staleLabel : emptyLabel);
        } else {
            views.setViewVisibility(R.id.widget_message, View.GONE);
        }
        return views;
    }
}
