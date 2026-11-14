// Admin panel — UsersTab.
import { Loader2, Ban, ShieldCheck, Search, Download, Gift, Eye, Crown } from "lucide-react";
import { AvatarFrame } from "../../../components/AvatarFrame";
import { DATE_LOCALE } from "../adminShared";
import type { AdminPanelState } from "../useAdminPanelState";

export function UsersTab({ s }: { s: AdminPanelState }) {
  const { profile, t, lang, users, banningId, searchQuery, setSearchQuery, efficiencyMap, exportUsersCsv, handleToggleBan, openBonusModal, openDetailsModal, cardStyle } = s;

  return (
    <div style={cardStyle}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
            {searchQuery ? t('admin_search_results') : t('admin_tab_users')}
            <span className="ml-2 text-xs font-normal" style={{ color: "var(--muted-foreground)" }}>({users.length})</span>
          </h3>
          <button
            onClick={exportUsersCsv}
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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

      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 860 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
              {[t('admin_col_name'), t('admin_col_status'), t('admin_col_role'), t('admin_col_balance'), t('admin_col_efficiency'), t('admin_col_joined'), ""].map((h, i) => (
                <th key={i} className="text-left pb-2 pr-3" style={{ fontSize: 10, color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace", textTransform: "uppercase" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users
              .filter((u) =>
                u.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.username.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .slice()
              .reverse()
              .slice(0, searchQuery ? 100 : 25)
              .map((u) => (
                <tr
                  key={u.id}
                  className={u.is_banned ? "opacity-50" : ""}
                  style={{ borderBottom: `1px solid rgba(255,255,255,0.05)` }}
                >
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <AvatarFrame frameId={u.active_frame} radius={9999}>
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden"
                          style={{ background: u.avatar_color || "#4ADE80", color: "#000" }}
                        >
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="w-7 h-7 object-cover" />
                          ) : (
                            u.display_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                          )}
                        </div>
                      </AvatarFrame>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>{u.display_name}</p>
                        <p className="text-[10px] truncate" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                      style={u.is_banned
                        ? { background: "rgba(248,113,113,0.12)", color: "#F87171" }
                        : { background: "rgba(74,222,128,0.12)", color: "#4ADE80" }}>
                      {u.is_banned ? t('admin_status_banned') : t('admin_status_active')}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    {u.is_admin ? (
                      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold w-fit" style={{ background: "rgba(251,191,36,0.12)", color: "#FBBF24" }}>
                        <Crown size={10} /> {t('admin_role_admin')}
                      </span>
                    ) : (
                      <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{t('admin_role_user')}</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-xs" style={{ color: "var(--foreground)", fontFamily: "'Geist Mono', monospace" }}>
                    🪙{u.coins || 0} · ⭐{u.score || 0}
                  </td>
                  <td className="py-2.5 pr-3 text-xs font-semibold" style={{ color: (efficiencyMap[u.id] ?? 0) >= 50 ? "#4ADE80" : "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                    {efficiencyMap[u.id] ?? 0}%
                  </td>
                  <td className="py-2.5 pr-3 text-xs" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                    {new Date(u.created_at).toLocaleDateString(DATE_LOCALE[lang] || "uz-UZ")}
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openDetailsModal(u.id)}
                        className="min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-800 shrink-0"
                        title={t('admin_view_details')}
                      >
                        <Eye size={14} style={{ color: "#60A5FA" }} />
                      </button>
                      <button
                        onClick={() => openBonusModal(u.id)}
                        className="min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-800 shrink-0"
                        title={t('admin_grant_bonus')}
                      >
                        <Gift size={14} style={{ color: "#A78BFA" }} />
                      </button>
                      {u.id !== profile.id && (
                        <button
                          onClick={() => handleToggleBan(u.id, !!u.is_banned)}
                          disabled={banningId === u.id}
                          className="min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-800 shrink-0"
                          title={u.is_banned ? t('admin_unban') : t('admin_ban')}
                        >
                          {banningId === u.id ? <Loader2 size={14} className="animate-spin text-gray-500" /> : u.is_banned ? <ShieldCheck size={14} className="text-green-500" /> : <Ban size={14} className="text-red-500" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
