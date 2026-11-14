// Admin panel — HabitsTab.
import { Loader2, Search, Download } from "lucide-react";
import { DATE_LOCALE } from "../adminShared";
import type { AdminPanelState } from "../useAdminPanelState";

export function HabitsTab({ s }: { s: AdminPanelState }) {
  const { t, lang, habitsAdmin, habitsAdminLoading, habitsAdminError, habitsSearchQuery, setHabitsSearchQuery, exportHabitsCsv, cardStyle } = s;

  return (
    <div style={cardStyle}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
            {t('admin_tab_habits')}
            <span className="ml-2 text-xs font-normal" style={{ color: "var(--muted-foreground)" }}>({habitsAdmin.length})</span>
          </h3>
          <button
            onClick={exportHabitsCsv}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 transition-all"
            style={{ background: "rgba(96,165,250,0.12)", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.25)" }}
          >
            <Download size={12} /> {t('admin_export_csv')}
          </button>
        </div>
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder={t('admin_search_ph')}
            value={habitsSearchQuery}
            onChange={(e) => setHabitsSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-xs outline-none transition-colors min-h-[44px]"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: `1px solid rgba(255,255,255,0.1)`,
              color: "var(--foreground)"
            }}
          />
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
        </div>
      </div>

      {habitsAdminError && (
        <p className="text-xs px-1 mb-3" style={{ color: "var(--coral-red)" }}>⚠ {habitsAdminError}</p>
      )}

      {habitsAdminLoading ? (
        <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin" style={{ color: "var(--neon-green)" }} /></div>
      ) : habitsAdmin.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: "var(--muted-foreground)" }}>{t('admin_habits_empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 720 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
                {[t('admin_col_habit_name'), t('admin_col_creator'), t('admin_col_category'), t('admin_col_frequency'), t('admin_col_date')].map((h, i) => (
                  <th key={i} className="text-left pb-2 pr-3" style={{ fontSize: 10, color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace", textTransform: "uppercase" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {habitsAdmin
                .filter((h) =>
                  h.name.toLowerCase().includes(habitsSearchQuery.toLowerCase()) ||
                  (h.profiles?.display_name || "").toLowerCase().includes(habitsSearchQuery.toLowerCase()) ||
                  (h.profiles?.username || "").toLowerCase().includes(habitsSearchQuery.toLowerCase())
                )
                .slice(0, habitsSearchQuery ? 200 : 50)
                .map((h) => (
                  <tr key={h.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
                    <td className="py-2.5 pr-3">
                      <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{h.emoji} {h.name}</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <p className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>{h.profiles?.display_name || "—"}</p>
                      <p className="text-[10px] truncate" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>@{h.profiles?.username || "—"}</p>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                        style={h.type === "negative"
                          ? { background: "rgba(248,113,113,0.12)", color: "#F87171" }
                          : { background: "rgba(74,222,128,0.12)", color: "#4ADE80" }}>
                        {h.type === "negative" ? t('an_habits_negative') : t('an_habits_positive')}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                      {h.target_value ? `${h.target_value}${h.unit ? " " + h.unit : ""}` : t('admin_freq_daily')}
                    </td>
                    <td className="py-2.5 pr-3 text-xs" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                      {new Date(h.created_at).toLocaleDateString(DATE_LOCALE[lang] || "uz-UZ")}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
