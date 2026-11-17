// Odat tafsilotlari — karta bosilganda ochiladi.
// Sarlavha (ikonka, nom, yo'nalish, tur, Tahrirlash/O'chirish/Yopish),
// 3 ta KPI, oylik bajarilish matritsasi (ochiq kunni shu yerda o'zgartirish),
// bugungi ijro, zanjirni muzlatish, eslatma, takrorlanish jadvali.
import { lazy, Suspense, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Edit3, Trash2, Flame, Trophy, CalendarCheck, ChevronLeft, ChevronRight, Check, X,
  Minus, Plus, Shield, ShieldCheck, Bell, Clock, Repeat,
} from "lucide-react";
import { Modal } from "../../components/Modal";
import { resolveHabitIcon, habitToneClass } from "./components/HabitItem";
import { cleanHabitName } from "../../components/HabitIcon";
import { useHabitDay, markHabitOnDate, doneValue } from "../../hooks/useHabitDay";
import { useAllTimeLogsQuery, useFreezeInfoQuery, useLogsRangeQuery } from "../../hooks/queries";
import { useHabitMutations, getHabitReminder, setHabitReminder, type HabitFormData } from "../../hooks/useHabitMutations";
import { applyStreakFreeze, FREE_FREEZES_PER_MONTH } from "../../services/db";
import { addDays, getTashkentToday, isTashkentDateOpen } from "../../utils/date";
import { getHabitDomain, type HabitDomain } from "../../utils/habitCategory";
import {
  buildMonthCalendar, isMeasurable, longestStreak, monthResult, progressPct, valueStep, type DayStatus,
} from "../../utils/habitMetrics";
import { MONTHS_FULL, DAYS_SHORT } from "../../utils/i18n";
import { useLang } from "../../store/LangContext";
import { useHaptics } from "../../hooks/useHaptics";
import type { Habit } from "../../services/supabase";

const AddHabitModal = lazy(() => import("../../components/AddHabitModal").then((m) => ({ default: m.AddHabitModal })));

const DOMAIN_KEY: Record<HabitDomain, "domain_growth" | "domain_health" | "domain_mind" | "domain_work"> = {
  Rivojlanish: "domain_growth",
  "Sog'lik": "domain_health",
  Ruhiyat: "domain_mind",
  Mehnat: "domain_work",
};
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];
const pad = (n: number) => String(n).padStart(2, "0");

const CELL_CLS: Record<DayStatus, string> = {
  done: "bg-emerald-500 text-slate-950 font-bold border border-emerald-400",
  fail: "bg-rose-500/80 text-white border border-rose-400/60",
  freeze: "bg-sky-500/25 border border-sky-400/50 text-sky-300",
  empty: "bg-slate-800/40 border border-slate-800 text-slate-400",
  future: "bg-slate-900/30 border border-slate-800/40 text-slate-600",
};

interface HabitDetailModalProps {
  habit: Habit;
  userId: string;
  onClose: () => void;
}

export function HabitDetailModal({ habit, userId, onClose }: HabitDetailModalProps) {
  const { t, lang } = useLang();
  const haptics = useHaptics();
  const queryClient = useQueryClient();
  const today = getTashkentToday();
  const yesterday = addDays(today, -1);

  const day = useHabitDay(userId, today);
  // Kesh yangilangach (tahrirlashdan keyin) odatning eng so'nggi ko'rinishi
  const live = day.habits.find((h) => h.id === habit.id) ?? habit;
  const negative = live.type === "negative";
  const measurable = !negative && isMeasurable(live);
  const target = live.target_value || 1;
  const Icon = resolveHabitIcon(live.emoji, live.name);
  const todayEntry = day.entryOf(live.id);

  const { update, remove } = useHabitMutations(userId);
  const freezeQ = useFreezeInfoQuery(userId);
  const allTimeQ = useAllTimeLogsQuery(userId);

  // ── Oy tanlash ──────────────────────────────────────────────────
  const [ym, setYm] = useState(() => ({ y: +today.slice(0, 4), m: +today.slice(5, 7) }));
  const mFirst = `${ym.y}-${pad(ym.m)}-01`;
  const mLast = `${ym.y}-${pad(ym.m)}-${pad(new Date(Date.UTC(ym.y, ym.m, 0)).getUTCDate())}`;
  const isCurrentMonth = today.slice(0, 7) === mFirst.slice(0, 7);
  const createdDay = live.created_at ? getTashkentToday(new Date(live.created_at)) : null;
  const canGoBack = !createdDay || createdDay.slice(0, 7) < mFirst.slice(0, 7);
  const monthLogsQ = useLogsRangeQuery(userId, mFirst, mLast < today ? mLast : today, { keepPrevious: true });

  // Kalendarda bosilgan kunlar — server javobigacha darhol ko'rinadi
  const [overrides, setOverrides] = useState<Record<string, "done" | "fail" | "none">>({});

  const frozen = useMemo(() => new Set<string>(freezeQ.data?.dates || []), [freezeQ.data?.dates]);

  const { doneSet, failSet } = useMemo(() => {
    const done = new Set<string>();
    const fail = new Set<string>();
    for (const l of monthLogsQ.data || []) {
      if (l.habit_id !== live.id) continue;
      (l.completed ? done : fail).add(l.log_date);
    }
    // Bugun — har bosishda yangilanadigan kunlik keshdan
    if (isCurrentMonth) {
      done.delete(today); fail.delete(today);
      if (todayEntry.status === "done") done.add(today);
      else if (todayEntry.status === "fail" && !(measurable && todayEntry.value > 0)) fail.add(today);
    }
    for (const [d, s] of Object.entries(overrides)) {
      if (d === today) continue;
      done.delete(d); fail.delete(d);
      if (s === "done") done.add(d);
      else if (s === "fail") fail.add(d);
    }
    return { doneSet: done, failSet: fail };
  }, [monthLogsQ.data, live.id, isCurrentMonth, today, todayEntry, overrides, measurable]);

  const cells = buildMonthCalendar(ym.y, ym.m, today, doneSet, failSet, frozen);
  const month = monthResult(ym.y, ym.m, today, createdDay, doneSet, frozen);

  // ── KPI ─────────────────────────────────────────────────────────
  const currentStreak = day.streaks[live.id] ?? 0;
  const recordStreak = useMemo(() => {
    const dates = (allTimeQ.data || []).filter((l: any) => l.habit_id === live.id).map((l: any) => l.log_date as string);
    if (todayEntry.status === "done") dates.push(today);
    return Math.max(longestStreak(dates, frozen), currentStreak);
  }, [allTimeQ.data, live.id, todayEntry.status, today, frozen, currentStreak]);

  // ── Kalendar kuni bosilganda ─────────────────────────────────────
  const onDayPress = (date: string, status: DayStatus) => {
    if (status === "future") return;
    if (!isTashkentDateOpen(date)) {
      toast.info(t("hd_day_locked"));
      return;
    }
    haptics.impactLight();
    if (date === today) {
      day.toggleDone(live);
      return;
    }
    const next = status === "done" ? "none" : "done";
    markHabitOnDate(userId, live, date, next, next === "done" ? doneValue(live) : 0);
    setOverrides((o) => ({ ...o, [date]: next }));
  };

  const shiftMonth = (delta: number) => {
    setYm(({ y, m }) => {
      const idx = y * 12 + (m - 1) + delta;
      return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
    });
  };

  // ── Muzlatish ───────────────────────────────────────────────────
  const freezeLeft = Math.max(
    0,
    FREE_FREEZES_PER_MONTH + (freezeQ.data?.extra ?? 0) - (freezeQ.data?.monthly ?? 0)
  );
  const freezeTarget = !frozen.has(yesterday) ? yesterday : !frozen.has(today) ? today : null;
  const [freezing, setFreezing] = useState(false);
  const handleFreeze = async () => {
    if (!freezeTarget) return;
    if (freezeLeft <= 0) { toast.info(t("hd_freeze_none_left")); return; }
    setFreezing(true);
    try {
      const { remaining } = await applyStreakFreeze(freezeTarget);
      haptics.notificationSuccess();
      toast.success(t("hd_freeze_done").replace("{n}", String(remaining)));
      queryClient.invalidateQueries({ queryKey: ["freezes", userId] });
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("no_freezes_left")) toast.info(t("hd_freeze_none_left"));
      else if (msg.includes("use_streak_freeze") || e?.code === "PGRST202") toast.error(t("hd_freeze_server_old"));
      else toast.error(t("hd_freeze_error"), { description: msg });
      queryClient.invalidateQueries({ queryKey: ["freezes", userId] });
    } finally {
      setFreezing(false);
    }
  };

  // ── Eslatma ─────────────────────────────────────────────────────
  const [reminder, setReminder] = useState<string | null>(() => getHabitReminder(live.id));
  const saveReminder = async (time: string | null) => {
    setReminder(time);
    try {
      await setHabitReminder(live.id, cleanHabitName(live.name), time);
      if (time) toast.success(t("hd_reminder_saved"));
    } catch (e) {
      console.error(e);
    }
  };

  // ── Tahrirlash / o'chirish ──────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const handleEditSave = async (data: HabitFormData) => {
    await update(live.id, data);
    setReminder(data.reminder || null);
    setEditing(false);
  };
  const handleDelete = async () => {
    try {
      await remove(live.id);
      toast.success(t("hd_deleted"));
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Error");
    }
  };

  const domain = getHabitDomain(live.name, live.emoji);

  const header = (
    <div className="flex items-center gap-3 min-w-0">
      <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${habitToneClass(live)}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-bold text-white truncate">{cleanHabitName(live.name)}</h2>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{t(DOMAIN_KEY[domain])}</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${negative ? "bg-rose-500/10 text-rose-300" : "bg-emerald-500/10 text-emerald-300"}`}>
            {t(negative ? "hd_type_negative" : "hd_type_positive")}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button type="button" onClick={() => setEditing(true)} aria-label={t("hd_edit")} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer">
          <Edit3 className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => setConfirmDelete(true)} aria-label={t("hd_delete")} className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 cursor-pointer">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <Modal isOpen onClose={onClose} title={header}>
        {confirmDelete && (
          <div className="p-3 rounded-2xl border border-rose-500/30 bg-rose-950/30 space-y-2.5">
            <p className="text-xs text-rose-200">{t("hd_delete_confirm")}</p>
            <div className="flex gap-2">
              <button type="button" onClick={handleDelete} className="flex-1 py-2 rounded-xl bg-rose-500 text-white text-xs font-bold cursor-pointer">
                {t("hd_delete_yes")}
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold cursor-pointer">
                {t("hd_cancel")}
              </button>
            </div>
          </div>
        )}

        {/* KPI */}
        <div className="grid grid-cols-3 gap-2">
          <Kpi icon={Flame} color="text-orange-400" label={t("hd_kpi_current")} value={t("hd_days").replace("{n}", String(currentStreak))} />
          <Kpi icon={Trophy} color="text-amber-400" label={t("hd_kpi_record")} value={t("hd_days").replace("{n}", String(recordStreak))} />
          <Kpi icon={CalendarCheck} color="text-emerald-400" label={t("hd_kpi_month")} value={`${month.pct}%`} sub={`${month.done}/${month.eligible}`} />
        </div>

        {/* Oylik matritsa */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200">{t("hd_calendar")}</h3>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => shiftMonth(-1)} disabled={!canGoBack} aria-label="prev" className="p-1 rounded-lg bg-slate-800/70 text-slate-300 disabled:opacity-30 cursor-pointer">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono text-[11px] text-slate-200 w-24 text-center">{MONTHS_FULL[lang][ym.m - 1]} {ym.y}</span>
              <button type="button" onClick={() => shiftMonth(1)} disabled={isCurrentMonth} aria-label="next" className="p-1 rounded-lg bg-slate-800/70 text-slate-300 disabled:opacity-30 cursor-pointer">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {MON_FIRST.map((d) => (
              <span key={d} className="text-center text-[10px] font-mono text-slate-500">{DAYS_SHORT[lang][d]}</span>
            ))}
            {cells.map((c, i) =>
              c ? (
                <button
                  key={c.date}
                  type="button"
                  onClick={() => onDayPress(c.date, c.status)}
                  disabled={c.status === "future"}
                  className={`aspect-square rounded-lg text-[11px] font-mono flex items-center justify-center transition-all active:scale-90 cursor-pointer disabled:cursor-default ${CELL_CLS[c.status]} ${c.isToday ? "ring-2 ring-emerald-400" : ""}`}
                >
                  {c.day}
                </button>
              ) : (
                <span key={`e${i}`} />
              )
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <Legend cls="bg-emerald-500" label={t("hd_legend_done")} />
            <Legend cls="bg-rose-500/80" label={t("hd_legend_fail")} />
            <Legend cls="bg-sky-500/40 border border-sky-400/50" label={t("hd_legend_freeze")} />
          </div>
        </section>

        {/* Bugungi ijro */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-200">{t("hd_today")}</h3>
          {negative ? (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => day.toggleDone(live)} className={`py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border ${todayEntry.status === "done" ? "bg-emerald-500 text-slate-950 border-emerald-400" : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"}`}>
                <Check className="w-4 h-4" /> {t("hd_kept_today")}
              </button>
              <button type="button" onClick={() => day.toggleFail(live)} className={`py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border ${todayEntry.status === "fail" ? "bg-rose-500 text-white border-rose-400" : "bg-rose-500/10 text-rose-300 border-rose-500/30"}`}>
                <X className="w-4 h-4" /> {t("hd_broke_today")}
              </button>
            </div>
          ) : measurable ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => day.setValue(live, todayEntry.value - valueStep(target))} disabled={todayEntry.value <= 0} aria-label="minus" className="w-11 h-11 rounded-xl bg-slate-800 text-slate-200 flex items-center justify-center disabled:opacity-30 cursor-pointer active:scale-90">
                  <Minus className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <p className="font-mono text-2xl font-bold text-white">
                    {todayEntry.value}<span className="text-sm text-slate-400"> / {target}</span>
                  </p>
                  <p className="text-[11px] text-slate-400">{live.unit || t("minutes")}</p>
                </div>
                <button type="button" onClick={() => day.setValue(live, todayEntry.value + valueStep(target))} aria-label="plus" className="w-11 h-11 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center cursor-pointer active:scale-90">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progressPct(todayEntry.value, target)}%` }} />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => day.toggleDone(live)}
              className={`w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer border transition-all active:scale-[0.99] ${todayEntry.status === "done" ? "bg-emerald-500 text-slate-950 border-emerald-400" : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"}`}
            >
              <Check className="w-4 h-4" />
              {todayEntry.status === "done" ? t("hd_marked_done") : t("hd_mark_done")}
            </button>
          )}
        </section>

        {/* Muzlatish */}
        <section className="rounded-2xl border border-sky-500/25 bg-sky-950/20 p-3 space-y-2">
          <div className="flex items-center gap-2">
            {freezeTarget ? <Shield className="w-4 h-4 text-sky-300" /> : <ShieldCheck className="w-4 h-4 text-sky-300" />}
            <h3 className="text-xs font-bold text-sky-100">{t("hd_freeze_title")}</h3>
          </div>
          <p className="text-[11px] text-sky-200/80">{t("hd_freeze_hint").replace("{n}", String(freezeLeft))}</p>
          {freezeTarget ? (
            <button
              type="button"
              onClick={handleFreeze}
              disabled={freezing || freezeQ.isPending}
              className="w-full py-2.5 rounded-xl bg-sky-500/20 border border-sky-400/40 text-sky-200 text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {freezeTarget === yesterday ? t("hd_freeze_yesterday") : t("hd_freeze_today")}
            </button>
          ) : (
            <p className="text-[11px] font-semibold text-sky-300">{t("hd_freeze_active")}</p>
          )}
        </section>

        {/* Eslatma */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Bell className={`w-4 h-4 ${reminder ? "text-emerald-400" : "text-slate-500"}`} />
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-200">{t("hd_reminder")}</h3>
                <p className="text-[11px] text-slate-400 truncate">
                  {reminder ? t("hd_reminder_on").replace("{time}", reminder) : t("hd_reminder_off")}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!reminder}
              aria-label={t("hd_reminder")}
              onClick={() => saveReminder(reminder ? null : "09:00")}
              className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer shrink-0 ${reminder ? "bg-emerald-500" : "bg-slate-700"}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${reminder ? "left-7" : "left-1"}`} />
            </button>
          </div>
          {reminder && (
            <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800">
              <span className="flex items-center gap-2 text-xs text-slate-300">
                <Clock className="w-4 h-4 text-emerald-400" /> {t("hd_reminder")}
              </span>
              <input
                type="time"
                value={reminder}
                onChange={(e) => e.target.value && saveReminder(e.target.value)}
                className="bg-transparent font-mono text-sm text-white outline-none"
              />
            </label>
          )}
        </section>

        {/* Takrorlanish jadvali */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <Repeat className="w-4 h-4 text-slate-400" /> {t("hd_schedule")}
            </h3>
            <span className="text-[11px] text-emerald-400">{t("hd_schedule_daily")}</span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {MON_FIRST.map((d) => (
              <span key={d} className="py-1.5 rounded-lg text-center text-[11px] font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                {DAYS_SHORT[lang][d]}
              </span>
            ))}
          </div>
          {measurable && (
            <p className="text-[11px] text-slate-400">
              {t("hd_target").replace("{n}", String(target)).replace("{unit}", live.unit || t("minutes"))}
            </p>
          )}
        </section>
      </Modal>

      {editing && (
        <Suspense fallback={null}>
          <AddHabitModal
            isOpen={editing}
            onClose={() => setEditing(false)}
            onAdd={handleEditSave}
            initialData={{ ...live, reminder: reminder || undefined }}
          />
        </Suspense>
      )}
    </>
  );
}

function Kpi({ icon: Icon, color, label, value, sub }: { icon: React.ElementType; color: string; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-2.5 text-center">
      <Icon className={`w-4 h-4 mx-auto ${color}`} />
      <p className="font-mono text-base font-bold text-white mt-1 leading-tight">{value}</p>
      {sub && <p className="font-mono text-[10px] text-slate-400">{sub}</p>}
      <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`w-2.5 h-2.5 rounded-sm ${cls}`} />
      {label}
    </span>
  );
}
