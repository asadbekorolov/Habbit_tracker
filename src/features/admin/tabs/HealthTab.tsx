// Admin panel — HealthTab.
import { Loader2, Trash2, HeartPulse } from "lucide-react";
import { DATE_LOCALE } from "../adminShared";
import type { AdminPanelState } from "../useAdminPanelState";

export function HealthTab({ s }: { s: AdminPanelState }) {
  const { t, lang, inactiveGroups, healthLoading, deletingGroupId, handleDeleteGroup, cardStyle } = s;

  return (
    <div style={cardStyle}>
      <div className="flex items-center gap-2 mb-4">
        <HeartPulse size={18} style={{ color: "#F87171" }} />
        <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t('health_inactive_groups')}</h3>
      </div>
      {healthLoading ? (
        <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin" style={{ color: "var(--neon-green)" }} /></div>
      ) : inactiveGroups.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: "var(--muted-foreground)" }}>{t('health_no_inactive')}</p>
      ) : (
        <div className="space-y-3">
          {inactiveGroups.map((g) => (
            <div key={g.group_id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.03)" }}>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>{g.group_name}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  {t('health_leader_label')} {g.leader_name || "—"}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  {t('health_last_log')} {g.last_log_date ? new Date(g.last_log_date).toLocaleDateString(DATE_LOCALE[lang]) : t('health_never')}
                </p>
              </div>
              <button
                onClick={() => handleDeleteGroup(g.group_id)}
                disabled={deletingGroupId === g.group_id}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold shrink-0 min-h-[44px] w-full sm:w-auto"
                style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444" }}
              >
                {deletingGroupId === g.group_id ? <Loader2 size={13} className="animate-spin" /> : <><Trash2 size={13} /> {t('health_delete_group')}</>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
