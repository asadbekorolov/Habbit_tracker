// Android bosh ekran vidjeti bilan sinxronizatsiya.
// JSON native IdrokWidget plagini orqali SharedPreferences ga yoziladi va
// AppWidgetManager.ACTION_APPWIDGET_UPDATE yuborilib vidjet darhol yangilanadi.
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { WidgetData } from '../utils/widgetData';

interface IdrokWidgetPlugin {
  update(options: { data: string }): Promise<void>;
}

const IdrokWidget = registerPlugin<IdrokWidgetPlugin>('IdrokWidget');

let lastSent = '';

export async function syncHomeWidget(data: WidgetData): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
  const json = JSON.stringify(data);
  if (json === lastSent) return; // o'zgarish bo'lmasa — native chaqiruv yo'q
  try {
    await IdrokWidget.update({ data: json });
    lastSent = json;
  } catch (e) {
    console.warn('Home widget sync failed', e);
  }
}
