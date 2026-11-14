// Guruh tafsilotlari — MembersTab.
import { Crown, Loader2, CheckCircle2, UserPlus, Clock, UserMinus, Shield, ArrowRightLeft } from "lucide-react";
import { isStarActive } from "../../../../services/db";
import { UserBadge } from "../../../../components/UserBadge";
import type { GroupDetailState } from "../useGroupDetail";

export function MembersTab({ s }: { s: GroupDetailState }) {
  const { profile, group, card, onUserClick, t, members, isOwner, isAdmin, memberActionId, transferTargetId, setTransferTargetId, handleKickMember, handleToggleCoAdmin, handleTransferOwnership, memberStatsMap } = s;

  return (
    <div className="flex flex-col gap-3">
      {members.length === 0 ? (
        <div style={card} className="p-8 flex flex-col items-center gap-2">
          <UserPlus size={28} style={{ color: "var(--muted-foreground)" }} />
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t('groups_no_members')}</p>
        </div>
      ) : (
        members.map((m: any, i) => {
          const p = m.profiles;
          if (!p) return null;
          const initials = (p.display_name || "??").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
          const mStats = memberStatsMap[m.user_id];
          const isThisOwner = m.user_id === group.admin_id;
          const isSelf = m.user_id === profile.id;
          const busy = memberActionId === m.user_id;
          const showTransferConfirm = transferTargetId === m.user_id;
          return (
            <div key={m.id || i} className="flex items-center gap-3 p-3.5 rounded-2xl transition-colors"
              style={card}>
              <div onClick={() => onUserClick?.(m.user_id)} className="flex items-center gap-3 flex-1 min-w-0"
                style={{ cursor: onUserClick ? "pointer" : "default" }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden"
                  style={{ background: p.avatar_color || "#4ADE80", color: "#0E1117" }}>
                  {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-10 h-10 object-cover" /> : initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                      {p.display_name}
                    </p>
                    <UserBadge active={isStarActive(p)} size={12} />
                    {isThisOwner ? (
                      <Crown size={12} style={{ color: "#FBBF24" }} />
                    ) : m.role === "admin" ? (
                      <Shield size={12} style={{ color: "#38BDF8" }} />
                    ) : null}
                  </div>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>@{p.username}</p>
                  {mStats && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10B981" }}>
                        <CheckCircle2 size={10} /> {mStats.approved}
                      </span>
                      {mStats.pending > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "rgba(251, 191, 36, 0.1)", color: "#FBBF24" }}>
                          <Clock size={10} /> {mStats.pending}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {!isSelf && !isThisOwner && (isOwner || isAdmin) && (
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {busy ? (
                    <Loader2 size={14} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
                  ) : showTransferConfirm ? (
                    <>
                      <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{t('groups_transfer_confirm')}</span>
                      <button type="button" onClick={() => handleTransferOwnership(m.user_id)}
                        className="text-[10px] font-semibold px-2 py-1 rounded-lg"
                        style={{ background: "rgba(74,222,128,0.15)", color: "#4ADE80" }}>
                        {t('groups_confirm_yes')}
                      </button>
                      <button type="button" onClick={() => setTransferTargetId(null)}
                        className="text-[10px] font-semibold px-2 py-1 rounded-lg"
                        style={{ color: "var(--muted-foreground)" }}>
                        {t('cancel_short')}
                      </button>
                    </>
                  ) : (
                    <>
                      {isOwner && (
                        <>
                          <button type="button" title={m.role === "admin" ? t('groups_demote') : t('groups_promote')}
                            onClick={() => handleToggleCoAdmin(m.user_id, m.role === "admin" ? "member" : "admin")}
                            className="p-1.5 rounded-lg" style={{ color: m.role === "admin" ? "#38BDF8" : "var(--muted-foreground)" }}>
                            <Shield size={13} />
                          </button>
                          <button type="button" title={t('groups_transfer_ownership')}
                            onClick={() => setTransferTargetId(m.user_id)}
                            className="p-1.5 rounded-lg" style={{ color: "var(--muted-foreground)" }}>
                            <ArrowRightLeft size={13} />
                          </button>
                        </>
                      )}
                      <button type="button" title={t('groups_kick')}
                        onClick={() => handleKickMember(m.user_id)}
                        className="p-1.5 rounded-lg" style={{ color: "#F87171" }}>
                        <UserMinus size={13} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
