// Admin panel — MonitoringTab.
import { Loader2, Activity, Flame } from "lucide-react";
import type { AdminPanelState } from "../useAdminPanelState";

export function MonitoringTab({ s }: { s: AdminPanelState }) {
  const { t, monitoring, monitoringLoading, monitoringError, cardStyle } = s;

  return (
    <>
      {monitoringError && (
        <p className="text-xs px-1" style={{ color: "var(--coral-red)" }}>⚠ {monitoringError}</p>
      )}
      <div style={cardStyle} className="flex flex-col">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(74,222,128,0.12)" }}>
          <Activity size={18} style={{ color: "#4ADE80" }} />
        </div>
        {monitoringLoading ? (
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--neon-green)" }} />
        ) : (
          <p className="text-3xl font-bold leading-none" style={{ color: "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>
            {monitoring?.dau ?? 0}
          </p>
        )}
        <p className="text-xs mt-2" style={{ color: "var(--muted-foreground)" }}>
          {t('mon_dau_label')}
        </p>
      </div>

      <div style={cardStyle}>
        <div className="flex items-center gap-2 mb-4">
          <Flame size={18} style={{ color: "#F97316" }} />
          <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t('mon_top_habits')}</h3>
        </div>
        {monitoringLoading ? (
          <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin" style={{ color: "var(--neon-green)" }} /></div>
        ) : !monitoring?.top_habits?.length ? (
          <p className="text-sm text-center py-4" style={{ color: "var(--muted-foreground)" }}>{t('mon_no_data')}</p>
        ) : (
          <div className="space-y-2">
            {monitoring.top_habits.map((h, i) => {
              const maxCompletions = monitoring.top_habits[0].completions || 1;
              return (
                <div key={h.name + i} className="flex items-center gap-3">
                  <span className="text-xs font-bold w-4 text-right" style={{ color: "var(--muted-foreground)" }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm truncate" style={{ color: "var(--foreground)" }}>{h.name}</span>
                      <span className="text-xs shrink-0 ml-2" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                        {h.completions} {t('mon_completions_suffix')}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                      <div className="h-full rounded-full" style={{ width: `${(h.completions / maxCompletions) * 100}%`, background: "#F97316" }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
