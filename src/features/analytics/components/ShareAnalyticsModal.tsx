// Tahlilni ulashish: Story (9:16) yoki Post (1:1) posterini tanlash,
// ko'rish va PNG sifatida ulashish / Telegram / saqlash.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import { Capacitor } from "@capacitor/core";
import { X, Share2, Send, Download, Loader2, Smartphone, Square, Info } from "lucide-react";
import { useScrollLock } from "../../../hooks/useScrollLock";
import { useReferralInfoQuery } from "../../../hooks/queries";
import { MONTHS_FULL } from "../../../utils/i18n";
import { tashkentTodayAnchor } from "../../../utils/date";
import { getPosterFontCSS } from "../../../utils/posterFonts";
import { PUBLIC_SITE_URL } from "../../../config/site";
import { REFERRED_BONUS, referralLink } from "../../../utils/referral";
import { openExternal, saveImage, shareImage, telegramShareUrl } from "../../../utils/share";
import { AnalyticsPoster, POSTER_SIZE, type PosterData, type PosterFormat, type PosterLabels } from "./AnalyticsPoster";
import type { AnalyticsData } from "../useAnalyticsData";

interface ShareAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  s: AnalyticsData;
}

/** Ko'rinish o'lchami (ekranga sig'ishi uchun) */
const PREVIEW_SCALE: Record<PosterFormat, number> = { story: 0.62, post: 0.8 };
const EXPORT_RATIO = 3; // 360 -> 1080 px

function firstSentence(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const m = /^(.+?[.!?])(\s|$)/.exec(clean);
  const s = m && m[1].length >= 20 ? m[1] : clean;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

async function waitImages(node: HTMLElement) {
  const imgs = Array.from(node.querySelectorAll("img"));
  await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))));
}

export function ShareAnalyticsModal({ isOpen, onClose, s }: ShareAnalyticsModalProps) {
  const { t, lang, profile, bestStreak, totalMonth, avgPercent, totalHabits, heatmapData, getHeatColor, lv, coachNote } = s;
  useScrollLock(isOpen);
  const [format, setFormat] = useState<PosterFormat>("story");
  const [busy, setBusy] = useState<null | "share" | "save">(null);
  const posterRef = useRef<HTMLDivElement | null>(null);
  const cache = useRef<Partial<Record<PosterFormat, string>>>({});
  const { data: refInfo } = useReferralInfoQuery(profile.id);
  const code = refInfo?.code ?? null;

  // Shriftlar birinchi eksportdan oldin yuklanib tursin (sekin tarmoqda bir necha soniya)
  useEffect(() => {
    if (isOpen) void getPosterFontCSS();
  }, [isOpen]);

  const data: PosterData = useMemo(() => {
    const ai = coachNote?.summary || coachNote?.strengths?.[0] || null;
    return {
      name: profile.display_name || profile.full_name || profile.username,
      username: profile.username,
      level: lv.level,
      frameId: profile.active_frame ?? null,
      glow: !!profile.username_glow,
      discipline: avgPercent,
      bestStreak,
      totalDone: totalMonth,
      totalHabits,
      aiLine: ai ? firstSentence(ai) : null,
      code,
      monthLabel: `${MONTHS_FULL[lang][tashkentTodayAnchor().getMonth()]} ${tashkentTodayAnchor().getFullYear()}`,
      heat: heatmapData.slice(-30).map((d) => getHeatColor(d.score)),
    };
  }, [profile, lv.level, avgPercent, bestStreak, totalMonth, totalHabits, coachNote, code, lang, heatmapData, getHeatColor]);

  // Ma'lumot o'zgarsa — tayyor PNG'lar eskiradi
  const dataKey = JSON.stringify(data);
  const lastKey = useRef(dataKey);
  if (lastKey.current !== dataKey) {
    lastKey.current = dataKey;
    cache.current = {};
  }

  const labels: PosterLabels = {
    tag: t("poster_tag"),
    discipline: t("poster_discipline"),
    bestStreak: t("poster_best_streak"),
    days: t("poster_days"),
    totalDone: t("poster_total_done"),
    habits: t("poster_habits"),
    aiTitle: t("poster_ai_title"),
    last30: t("poster_last30"),
    code: t("poster_code"),
    cta: t("poster_cta").replace("{b}", String(REFERRED_BONUS)),
  };

  if (!isOpen) return null;

  const link = code ? referralLink(code) : PUBLIC_SITE_URL;
  const shareText = (code ? t("share_text_code") : t("share_text"))
    .replace("{p}", String(avgPercent))
    .replace("{s}", String(bestStreak))
    .replace("{code}", code ?? "")
    .replace("{b}", String(REFERRED_BONUS));
  const fileName = `idrok_${format}_${Date.now()}.png`;

  async function render(): Promise<string> {
    const hit = cache.current[format];
    if (hit) return hit;
    const node = posterRef.current;
    if (!node) throw new Error("poster");
    await waitImages(node);
    const fontEmbedCSS = await getPosterFontCSS();
    const { w, h } = POSTER_SIZE[format];
    const png = await Promise.race([
      toPng(node, {
        width: w,
        height: h,
        pixelRatio: EXPORT_RATIO,
        backgroundColor: "#090d16",
        cacheBust: false,
        ...(fontEmbedCSS ? { fontEmbedCSS } : { skipFonts: true }),
      }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 12000)),
    ]);
    cache.current[format] = png;
    return png;
  }

  async function handleShare() {
    if (busy) return;
    setBusy("share");
    try {
      const png = await render();
      const r = await shareImage(png, { fileName, title: t("share_title"), text: `${shareText}\n${link}`, dialogTitle: t("share_title") });
      if (r === "saved") toast.success(t("share_saved"));
      else if (r === "failed") toast.error(t("share_failed"));
    } catch {
      toast.error(t("share_failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    if (busy) return;
    setBusy("save");
    try {
      const png = await render();
      const r = await saveImage(png, fileName);
      if (r === "saved") {
        toast.success(Capacitor.isNativePlatform() ? t("share_saved_native") : t("share_saved"));
      } else {
        // Ba'zi Android versiyalarida umumiy papkaga yozib bo'lmaydi — ulashish oynasi orqali
        toast.info(t("share_save_fallback"));
        await shareImage(png, { fileName, title: t("share_title"), text: shareText, dialogTitle: t("share_btn_save") });
      }
    } catch {
      toast.error(t("share_failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleTelegram() {
    await openExternal(telegramShareUrl(link, shareText));
  }

  const scale = PREVIEW_SCALE[format];
  const { w, h } = POSTER_SIZE[format];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain touch-none"
      style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(4px)" }}
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92vh] overflow-y-auto overscroll-contain touch-pan-y border border-slate-800/80"
        style={{ background: "#0d121c", paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20">
                <Share2 size={16} className="text-emerald-400" />
              </div>
              <h3 className="text-sm font-bold text-white">{t("share_modal_title")}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              data-modal-close-trigger
              disabled={!!busy}
              aria-label={t("ref_close")}
              className="p-1.5 rounded-lg bg-white/[0.07]"
            >
              <X size={15} className="text-slate-400" />
            </button>
          </div>

          {/* Format tanlovi */}
          <div className="grid grid-cols-2 gap-2">
            {([
              { id: "story" as const, icon: Smartphone, title: t("share_format_story"), hint: t("share_format_story_hint") },
              { id: "post" as const, icon: Square, title: t("share_format_post"), hint: t("share_format_post_hint") },
            ]).map(({ id, icon: Icon, title, hint }) => (
              <button
                key={id}
                type="button"
                onClick={() => setFormat(id)}
                disabled={!!busy}
                className={`rounded-2xl p-3 text-left border transition-all ${
                  format === id ? "bg-emerald-500/10 border-emerald-500/40" : "bg-slate-900/60 border-slate-800/80"
                }`}
              >
                <div className={`flex items-center gap-2 text-xs font-bold ${format === id ? "text-emerald-300" : "text-white"}`}>
                  <Icon size={14} /> {title} <span className="font-mono text-[10px] text-slate-500">{id === "story" ? "9:16" : "1:1"}</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 leading-snug">{hint}</div>
              </button>
            ))}
          </div>

          {/* Ko'rinish (eksport shu DOM'dan, masshtabsiz) */}
          <div className="flex justify-center">
            <div
              className="rounded-2xl overflow-hidden border border-slate-800/80 shadow-2xl"
              style={{ width: w * scale, height: h * scale }}
            >
              <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left" }}>
                <AnalyticsPoster ref={posterRef} format={format} data={data} labels={labels} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleTelegram}
              disabled={!!busy}
              className="flex flex-col items-center justify-center gap-1 py-3 px-1.5 rounded-2xl text-[11px] leading-tight text-center font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 active:scale-[0.98] disabled:opacity-50"
            >
              <Send size={17} /> {t("share_btn_telegram")}
            </button>
            <button
              type="button"
              onClick={handleShare}
              disabled={!!busy}
              className="flex flex-col items-center justify-center gap-1 py-3 px-1.5 rounded-2xl text-[11px] leading-tight text-center font-semibold bg-emerald-500 text-[#05210f] active:scale-[0.98] disabled:opacity-60"
            >
              {busy === "share" ? <Loader2 size={17} className="animate-spin" /> : <Share2 size={17} />} {t("share_btn_share")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!!busy}
              className="flex flex-col items-center justify-center gap-1 py-3 px-1.5 rounded-2xl text-[11px] leading-tight text-center font-semibold bg-slate-800/80 text-slate-200 border border-slate-700/60 active:scale-[0.98] disabled:opacity-50"
            >
              {busy === "save" ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />} {t("share_btn_save")}
            </button>
          </div>

          <p className="flex items-start gap-1.5 text-[10px] text-slate-500 leading-relaxed">
            <Info size={12} className="shrink-0 mt-px" /> {t("share_telegram_hint")}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
