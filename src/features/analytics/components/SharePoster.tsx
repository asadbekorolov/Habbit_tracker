// Tahlil (Analytics) — SharePoster.
import { Trophy, Zap, Flame, BarChart2, ShieldCheck } from "lucide-react";
import type { AnalyticsData } from "../useAnalyticsData";

export function SharePoster({ s }: { s: AnalyticsData }) {
  const { totalHabits, profile, posterRef, bestStreak, totalMonth, avgPercent, heatmapData, getHeatColor, lv, now, monthName } = s;

  return (
    <div
      style={{
        position: "fixed",
        left: "-9999px",
        top: 0,
        pointerEvents: "none",
      }}
    >
      <div
        ref={posterRef}
        className="w-[540px] h-[960px] bg-[#0a0f1d] text-white p-8 flex flex-col justify-between relative overflow-hidden font-sans"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {/* Blurred Orb Backgrounds */}
        <div className="absolute top-10 -left-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-20 -right-20 w-80 h-80 bg-amber-500/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Top Header */}
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] font-black uppercase tracking-widest shadow-sm">
              <Zap size={14} className="fill-emerald-400" />
              <span>IDROK · INTIZOM VA STATISTIKA</span>
            </div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              {monthName} {now.getFullYear()}
            </span>
          </div>

          {/* User Identity */}
          <div className="flex items-center gap-4 p-5 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400/40 flex items-center justify-center text-emerald-400 font-bold text-2xl shrink-0 shadow-lg">
              {(profile.display_name || "A")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-black truncate leading-snug">{profile.display_name}</h2>
              <p className="text-xs font-semibold text-slate-400 mb-1.5">@{profile.username}</p>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-black uppercase tracking-wider">
                Lv.{lv.level} · {lv.label}
              </span>
            </div>
          </div>
        </div>

        {/* Core Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 relative z-10 my-auto">
          {/* Stat Card 1: Intizom Foizi */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-500/15 to-emerald-950/20 border border-emerald-500/30 flex flex-col justify-between">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
              <ShieldCheck size={22} />
            </div>
            <div>
              <span className="text-4xl font-black text-emerald-400 tracking-tight leading-none block mb-1">
                {avgPercent}%
              </span>
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Oylik Barqarorlik</p>
            </div>
          </div>

          {/* Stat Card 2: Maksimal Streak */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-500/15 to-amber-950/20 border border-amber-500/30 flex flex-col justify-between">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
              <Flame size={22} className="fill-amber-400" />
            </div>
            <div>
              <span className="text-4xl font-black text-amber-400 tracking-tight leading-none block mb-1">
                {bestStreak} Kun
              </span>
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Uzluksiz Seriya</p>
            </div>
          </div>

          {/* Stat Card 3: Bajarilgan Odatlar */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-500/15 to-indigo-950/20 border border-indigo-500/30 flex flex-col justify-between">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4">
              <Trophy size={22} />
            </div>
            <div>
              <span className="text-4xl font-black text-indigo-400 tracking-tight leading-none block mb-1">
                {totalMonth}+
              </span>
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Bajarilgan Odatlar</p>
            </div>
          </div>

          {/* Stat Card 4: Faol Odatlar */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-purple-500/15 to-purple-950/20 border border-purple-500/30 flex flex-col justify-between">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4">
              <BarChart2 size={22} />
            </div>
            <div>
              <span className="text-4xl font-black text-purple-400 tracking-tight leading-none block mb-1">
                {totalHabits} Ta
              </span>
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Kuzatilayotgan Odatlar</p>
            </div>
          </div>
        </div>

        {/* Sparkline / Trend Dot Matrix */}
        <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 relative z-10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
              30 Kunlik Faollik Tendensiyasi
            </span>
            <span className="text-xs font-black text-emerald-400">{avgPercent}% O'rtacha</span>
          </div>
          <div className="grid grid-cols-10 gap-2">
            {heatmapData.slice(-30).map((d, idx) => (
              <div
                key={idx}
                className="h-6 rounded-lg transition-all"
                style={{
                  background: getHeatColor(d.score),
                  boxShadow: d.score > 2 ? "0 0 8px rgba(74,222,128,0.3)" : "none",
                }}
              />
            ))}
          </div>
        </div>

        {/* Footer Watermark */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-emerald-500 flex items-center justify-center text-black font-black text-xs">
              I
            </div>
            <span className="text-xs font-bold text-slate-300 tracking-widest">IDROK</span>
          </div>
          <span className="text-[11px] font-medium text-slate-400 italic">
            Kichik odatlar, buyuk natijalar
          </span>
        </div>
      </div>
    </div>
  );
}
