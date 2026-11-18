// Guruh tafsilotlari — TeamsTab.
import { Users, Plus, Check, Loader2, Trash2, Pencil, AlertTriangle } from "lucide-react";
import type { GroupDetailState } from "../useGroupDetail";
import { publicName, nameInitials } from "../../../../utils/publicName";

export function TeamsTab({ s }: { s: GroupDetailState }) {
  const { profile, card, inputStyle, onUserClick, t, members, subteams, error, setError, showCreateTeam, setShowCreateTeam, newTeamName, setNewTeamName, newTeamEmoji, setNewTeamEmoji, creatingTeam, managingTeam, setManagingTeam, managingSelected, setManagingSelected, savingTeamMembers, deletingTeam, isAdmin, handleCreateTeam, openManageTeam, handleSaveTeamMembers, handleDeleteTeam, EMOJI_MAP, TEAM_ICON_NAMES } = s;

  return (
    <div className="flex flex-col gap-3">
      {error && !showCreateTeam && !managingTeam && (
        <p className="text-xs px-1" style={{ color: "var(--coral-red)" }}><AlertTriangle size={12} className="inline-block shrink-0 align-[-2px] mr-1" />{error}</p>
      )}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {t('groups_create_teams_desc')}
        </p>
        {isAdmin && (
          <button
            onClick={() => { setShowCreateTeam(true); setError(""); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
            style={{ background: "var(--neon-green)", color: "#0E1117" }}
          >
            <Plus size={12} /> {t('groups_team_btn')}
          </button>
        )}
      </div>

      {subteams.length === 0 ? (
        <div style={card} className="p-10 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
            style={{ background: "rgba(255,255,255,0.05)" }}>
            <Users size={28} style={{ color: "var(--muted-foreground)" }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('groups_no_teams')}</p>
          <p className="text-xs text-center" style={{ color: "var(--muted-foreground)" }}>
            {isAdmin ? t('groups_split_into_teams') : t('groups_leader_no_teams')}
          </p>
        </div>
      ) : (
        subteams.map((team) => {
          const teamMembers: any[] = team.group_subteam_members || [];
          const myTeam = teamMembers.some((m: any) => m.user_id === profile.id);
          return (
            <div key={team.id} style={{ ...card, ...(myTeam ? { border: "1px solid rgba(74,222,128,0.3)" } : {}) }}
              className="p-4 rounded-2xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ background: "rgba(255,255,255,0.07)" }}>
                  {(() => {
                     const TeamIcon = EMOJI_MAP[team.emoji] || Users;
                     const colorClass = (team.emoji === 'Flame' || team.emoji === '\u{1F525}') ? 'text-orange-500'
                                      : (team.emoji === 'Trophy' || team.emoji === '\u{1F3C6}') ? 'text-amber-400'
                                      : 'text-emerald-400';
                     return <TeamIcon size={20} className={colorClass} />
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold" style={{ color: myTeam ? "#4ADE80" : "var(--foreground)" }}>
                      {team.name}
                    </p>
                    {myTeam && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                        style={{ background: "rgba(74,222,128,0.15)", color: "#4ADE80" }}>
                        {t('groups_your_team')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                    {teamMembers.length} {t('groups_member')}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openManageTeam(team)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium"
                      style={{ background: "rgba(255,255,255,0.07)", color: "var(--muted-foreground)" }}
                    >
                      <Pencil size={11} /> {t('groups_manage')}
                    </button>
                    <button
                      onClick={() => handleDeleteTeam(team.id)}
                      disabled={deletingTeam === team.id}
                      className="p-1.5 rounded-lg"
                      style={{ color: "var(--coral-red)", opacity: deletingTeam === team.id ? 0.4 : 0.6 }}
                    >
                      {deletingTeam === team.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                )}
              </div>
              {teamMembers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {teamMembers.map((m: any) => {
                    const p = m.profiles;
                    if (!p) return null;
                    const initials = nameInitials(publicName(p));
                    return (
                      <div key={m.user_id}
                        onClick={() => onUserClick?.(m.user_id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl cursor-pointer"
                        style={{ background: "rgba(255,255,255,0.05)", border: `1px solid rgba(255,255,255,0.08)` }}>
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 overflow-hidden"
                          style={{ background: p.avatar_color || "#4ADE80", color: "#0E1117" }}>
                          {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-5 h-5 object-cover" /> : initials}
                        </div>
                        <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{publicName(p)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {t('groups_no_members_team')}
                </p>
              )}
            </div>
          );
        })
      )}

      {/* Create team modal */}
      {showCreateTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowCreateTeam(false)}>
          <div className="w-full max-w-sm p-5 rounded-2xl"
            style={{ background: "#161B22", border: `1px solid rgba(255,255,255,0.1)` }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--foreground)" }}>
              {t('groups_new_team')}
            </h3>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {TEAM_ICON_NAMES.map((em) => {
                const PickIcon = EMOJI_MAP[em] || Users;
                return (
                <button key={em} type="button" onClick={() => setNewTeamEmoji(em)}
                  className="w-9 h-9 rounded-lg text-lg"
                  style={{
                    background: newTeamEmoji === em ? ("rgba(74,222,128,0.2)") : ("rgba(255,255,255,0.05)"),
                    border: newTeamEmoji === em ? "1px solid rgba(74,222,128,0.5)" : "1px solid transparent",
                  }}><PickIcon size={16} className="mx-auto text-emerald-400" /></button>
                );
              })}
            </div>
            <input
              style={inputStyle}
              placeholder={t('groups_team_name_ph')}
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateTeam()}
              autoFocus
              maxLength={30}
            />
            {error && <p className="text-xs mt-2" style={{ color: "var(--coral-red)" }}><AlertTriangle size={12} className="inline-block shrink-0 align-[-2px] mr-1" />{error}</p>}
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setShowCreateTeam(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted-foreground)" }}>
                {t('cancel_short')}
              </button>
              <button type="button" onClick={handleCreateTeam} disabled={creatingTeam || !newTeamName.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--neon-green)", color: "#0E1117", opacity: (creatingTeam || !newTeamName.trim()) ? 0.5 : 1 }}>
                {creatingTeam ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                {t('create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage team members modal */}
      {managingTeam && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setManagingTeam(null)}>
          <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl overflow-hidden"
            style={{ background: "#161B22", border: `1px solid rgba(255,255,255,0.1)`, maxHeight: "80vh" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4" style={{ borderBottom: `1px solid rgba(255,255,255,0.07)` }}>
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                {managingTeam.emoji} {managingTeam.name} — {t('groups_manage_members_suffix')}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                {t('groups_select_members')}
              </p>
            </div>
            <div className="overflow-y-auto p-4 space-y-2" style={{ maxHeight: "50vh" }}>
              {members.map((m: any) => {
                const p = m.profiles;
                if (!p) return null;
                const initials = nameInitials(publicName(p));
                const isChecked = managingSelected.has(m.user_id);
                return (
                  <button
                    key={m.user_id || m.id}
                    type="button"
                    onClick={() => setManagingSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(m.user_id)) next.delete(m.user_id);
                      else next.add(m.user_id);
                      return next;
                    })}
                    className="w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left"
                    style={{
                      background: isChecked ? ("rgba(74,222,128,0.1)") : ("rgba(255,255,255,0.03)"),
                      border: `1px solid ${isChecked ? "rgba(74,222,128,0.3)" : ("rgba(255,255,255,0.06)")}`,
                    }}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden"
                      style={{ background: p.avatar_color || "#4ADE80", color: "#0E1117" }}>
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-8 h-8 object-cover" /> : initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{publicName(p)}</p>
                      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>@{p.username}</p>
                    </div>
                    <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                      style={{ background: isChecked ? "#4ADE80" : ("rgba(255,255,255,0.08)") }}>
                      {isChecked && <Check size={12} style={{ color: "#0E1117" }} />}
                    </div>
                  </button>
                );
              })}
            </div>
            {error && (
              <p className="text-xs px-4 pt-2" style={{ color: "var(--coral-red)" }}><AlertTriangle size={12} className="inline-block shrink-0 align-[-2px] mr-1" />{error}</p>
            )}
            <div className="px-4 py-3 flex gap-2"
              style={{ borderTop: `1px solid rgba(255,255,255,0.07)`, paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
              <button type="button" onClick={() => { setManagingTeam(null); setError(""); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted-foreground)" }}>
                {t('cancel_short')}
              </button>
              <button type="button" onClick={handleSaveTeamMembers} disabled={savingTeamMembers}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--neon-green)", color: "#0E1117", opacity: savingTeamMembers ? 0.6 : 1 }}>
                {savingTeamMembers ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                {`${t('groups_save_team').replace('{n}', String(managingSelected.size))}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
