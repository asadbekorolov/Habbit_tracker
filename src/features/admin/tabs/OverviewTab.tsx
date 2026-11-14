// Admin panel — OverviewTab.
import { Users, ListChecks, Loader2, AlertTriangle, Trash2, Megaphone, Check, X, ClipboardCheck } from "lucide-react";
import type { AdminPanelState } from "../useAdminPanelState";

export function OverviewTab({ s }: { s: AdminPanelState }) {
  const { t, setActiveTab, stats, statHover, setStatHover, resetting, pushTitle, setPushTitle, pushBody, setPushBody, pushSending, pendingApprovals, moderationLoading, actioningId, rejectLogId, setRejectLogId, rejectReason, setRejectReason, handleApproveLog, handleRejectSubmit, handleResetData, handleSendGlobalPush, cardStyle } = s;

  return (
    <>
      {/* Global Ko'rsatkichlar */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        {[
          { label: t('admin_stat_users'), value: stats.users, icon: Users, color: "#3B82F6", bg: "rgba(59,130,246,0.12)", onClick: () => setActiveTab("users") },
          { label: t('admin_stat_habits'), value: stats.habits, icon: ListChecks, color: "#4ADE80", bg: "rgba(74,222,128,0.12)" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              ...cardStyle,
              padding: 14,
              cursor: stat.onClick ? "pointer" : "default",
              transition: "transform 0.15s, border-color 0.15s",
              ...(stat.onClick && statHover === stat.label
                ? { transform: "scale(1.02)", borderColor: "var(--neon-green)" }
                : {}),
            }}
            className="flex flex-col"
            onClick={stat.onClick}
            onMouseEnter={stat.onClick ? () => setStatHover(stat.label) : undefined}
            onMouseLeave={stat.onClick ? () => setStatHover(null) : undefined}
            role={stat.onClick ? "button" : undefined}
            tabIndex={stat.onClick ? 0 : undefined}
            onKeyDown={stat.onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); stat.onClick!(); } } : undefined}
            title={stat.onClick ? t('admin_stat_view_users') : undefined}
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center mb-2 sm:mb-3" style={{ background: stat.bg }}>
              <stat.icon size={16} style={{ color: stat.color }} />
            </div>
            <p className="text-xl sm:text-3xl font-bold leading-none truncate" style={{ color: "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>
              {stat.value}
            </p>
            <p className="text-[10px] sm:text-xs mt-1.5 sm:mt-2 truncate" style={{ color: "var(--muted-foreground)" }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Moderatsiya — barcha guruhlar bo'yicha kutilayotgan isbotlar */}
      <div style={cardStyle}>
        <div className="flex items-center gap-2 mb-4">
          <ClipboardCheck size={18} style={{ color: "#4ADE80" }} />
          <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t('mod_title')}</h3>
        </div>
        {moderationLoading ? (
          <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin" style={{ color: "var(--neon-green)" }} /></div>
        ) : pendingApprovals.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: "var(--muted-foreground)" }}>{t('mod_empty')}</p>
        ) : (
          <div className="space-y-3">
            {pendingApprovals.map((item) => (
              <div key={item.id} className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: item.profiles?.avatar_color || "#4ADE80", color: "#000" }}>
                    {(item.profiles?.display_name || "?").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      {item.profiles?.display_name} <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>· {item.groups?.name}</span>
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                      {item.group_habits?.emoji} {item.group_habits?.name}
                    </p>
                    {item.proof_note && (
                      <p className="text-xs mt-1 italic" style={{ color: "var(--muted-foreground)" }}>"{item.proof_note}"</p>
                    )}
                  </div>
                </div>
                {rejectLogId === item.id ? (
                  <div className="flex gap-2 mt-2.5">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder={t('mod_reject_placeholder')}
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: `1px solid rgba(255,255,255,0.1)`, color: "var(--foreground)" }}
                    />
                    <button onClick={handleRejectSubmit} disabled={actioningId === item.id}
                      className="px-3 py-2.5 rounded-lg text-xs font-semibold min-h-[44px]" style={{ background: "rgba(248,113,113,0.15)", color: "#F87171" }}>
                      {actioningId === item.id ? <Loader2 size={13} className="animate-spin" /> : t('reject')}
                    </button>
                    <button onClick={() => { setRejectLogId(null); setRejectReason(""); }}
                      className="px-3 py-2.5 rounded-lg text-xs min-h-[44px]" style={{ color: "var(--muted-foreground)" }}>
                      {t('cancel_short')}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-2.5">
                    <button onClick={() => handleApproveLog(item.id)} disabled={actioningId === item.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold min-h-[44px]"
                      style={{ background: "rgba(74,222,128,0.15)", color: "#4ADE80" }}>
                      {actioningId === item.id ? <Loader2 size={13} className="animate-spin" /> : <><Check size={13} /> {t('groups_approve_btn')}</>}
                    </button>
                    <button onClick={() => setRejectLogId(item.id)} disabled={actioningId === item.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold min-h-[44px]"
                      style={{ background: "rgba(248,113,113,0.1)", color: "#F87171" }}>
                      <X size={13} /> {t('reject')}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ommaviy Xabar (Global Push) */}
      <div style={{ ...cardStyle, border: `1px solid rgba(59,130,246,0.2)` }}>
        <div className="flex items-center gap-2 mb-4">
          <Megaphone size={18} style={{ color: "#3B82F6" }} />
          <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t('admin_broadcast_title')}</h3>
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
          {t('admin_broadcast_desc')}
        </p>
        <div className="space-y-3 mb-4">
          <input
            type="text"
            placeholder={t('admin_broadcast_title_ph')}
            value={pushTitle}
            onChange={(e) => setPushTitle(e.target.value)}
            className="w-full px-4 py-2 rounded-xl text-sm outline-none transition-colors"
            style={{ background: "rgba(255,255,255,0.05)", border: `1px solid rgba(255,255,255,0.1)`, color: "var(--foreground)" }}
          />
          <textarea
            placeholder={t('admin_broadcast_body_ph')}
            value={pushBody}
            onChange={(e) => setPushBody(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 rounded-xl text-sm outline-none transition-colors resize-none"
            style={{ background: "rgba(255,255,255,0.05)", border: `1px solid rgba(255,255,255,0.1)`, color: "var(--foreground)" }}
          />
        </div>
        <button
          onClick={handleSendGlobalPush}
          disabled={pushSending || !pushTitle.trim() || !pushBody.trim()}
          className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: "rgba(59,130,246,0.1)",
            color: "#3B82F6",
            border: "1px solid rgba(59,130,246,0.2)",
            opacity: (pushSending || !pushTitle.trim() || !pushBody.trim()) ? 0.7 : 1,
          }}
        >
          {pushSending ? <Loader2 size={16} className="animate-spin" /> : <Megaphone size={16} />}
          {pushSending ? t('admin_broadcast_sending') : t('admin_broadcast_send')}
        </button>
      </div>

      {/* Xavfli Hudud */}
      <div style={{ ...cardStyle, border: `1px solid rgba(239,68,68,0.2)` }}>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} style={{ color: "#EF4444" }} />
          <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t('admin_danger_zone')}</h3>
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
          {t('admin_danger_desc')}
        </p>
        <button
          onClick={handleResetData}
          disabled={resetting}
          className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: "rgba(239,68,68,0.1)",
            color: "#EF4444",
            border: "1px solid rgba(239,68,68,0.2)",
            opacity: resetting ? 0.7 : 1,
          }}
        >
          {resetting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          {resetting ? t('admin_resetting') : t('admin_reset_btn')}
        </button>
      </div>
    </>
  );
}
