// Guruh tafsilotlari.
import { Plus, ArrowLeft, Copy, Check, Crown, Loader2, Trash2, X, Send, Pencil, Settings, LogOut } from "lucide-react";
import { addGroupHabit, updateGroupHabit } from "../../../services/db";
import type { Profile } from "../../../services/supabase";
import { AddGroupHabitModal } from "../../../components/AddGroupHabitModal";
import { useGroupDetail } from "./useGroupDetail";
import { HabitsTab } from "./tabs/HabitsTab";
import { MembersTab } from "./tabs/MembersTab";
import { LeaderboardTab } from "./tabs/LeaderboardTab";
import { StatsTab } from "./tabs/StatsTab";
import { TeamsTab } from "./tabs/TeamsTab";
import { ApproveTab } from "./tabs/ApproveTab";

export function GroupDetail(props: { profile: Profile; group: any; onBack: () => void;
  onGroupRemoved: (groupId: string) => void;
  card: React.CSSProperties; inputStyle: React.CSSProperties;
  onUserClick?: (userId: string) => void;
}) {
  const s = useGroupDetail(props);
  const { group, onBack, inputStyle, t, activeTab, setActiveTab, members, habits, setHabits, pendingApprovals, loading, error, setError, loadError, copied, tgLink, showTgEdit, setShowTgEdit, tgInput, setTgInput, savingTg, proofHabitId, setProofHabitId, proofNote, setProofNote, proofCount, setProofCount, submitting, rejectLogId, setRejectLogId, rejectReason, setRejectReason, rejecting, showAddHabit, setShowAddHabit, editingHabitId, setEditingHabitId, isOwner, isAdmin, showSettings, setShowSettings, leaveError, setLeaveError, leaving, confirmDelete, setConfirmDelete, deletingGroup, submitHabit, handleRejectSubmit, resetHabitForm, handleLeaveGroup, handleDeleteGroup, copyInviteCode, handleSaveTgLink, tabs } = s;


  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="p-2 rounded-xl"
          style={{ background: "rgba(255,255,255,0.06)" }}>
          <ArrowLeft size={16} style={{ color: "var(--foreground)" }} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold truncate" style={{ color: "var(--foreground)" }}>{group.name}</h2>
            {isAdmin && <Crown size={14} style={{ color: "#FBBF24" }} />}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{members.length} {t('groups_member')}</span>
            {isAdmin && group.invite_code && (
              <button onClick={copyInviteCode}
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg"
                style={{ background: "rgba(74,222,128,0.1)", color: "#4ADE80", fontFamily: "'Geist Mono', monospace" }}>
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? t('copied') : t('groups_code_label').replace('{code}', group.invite_code)}
              </button>
            )}
          </div>
          {/* Telegram group link */}
          <div className="flex items-center gap-1.5 mt-0.5">
            {tgLink ? (
              <a href={tgLink.startsWith("http") ? tgLink : `https://t.me/${tgLink.replace("@", "")}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg"
                style={{ background: "rgba(56,189,248,0.12)", color: "#38BDF8", border: "1px solid rgba(56,189,248,0.25)" }}>
                <Send size={10} /> {t('groups_open_tg_group')}
              </a>
            ) : isAdmin ? (
              <button type="button" onClick={() => { setTgInput(""); setShowTgEdit(true); }}
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg"
                style={{ background: "rgba(56,189,248,0.08)", color: "#38BDF8", border: "1px solid rgba(56,189,248,0.2)" }}>
                <Plus size={10} /> {t('groups_add_tg_link')}
              </button>
            ) : null}
            {isAdmin && tgLink && (
              <button type="button" onClick={() => { setTgInput(tgLink); setShowTgEdit(true); }}
                className="flex items-center p-0.5 rounded"
                style={{ color: "var(--muted-foreground)" }}>
                <Pencil size={11} />
              </button>
            )}
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditingHabitId(null); setShowAddHabit(true); setError(""); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
            style={{ background: "var(--neon-green)", color: "#0E1117" }}>
            <Plus size={13} /> {t('groups_add_habit_btn')}
          </button>
        )}
        <button onClick={() => { setShowSettings(true); setLeaveError(""); setConfirmDelete(false); }}
          className="p-2 rounded-xl shrink-0"
          style={{ background: "rgba(255,255,255,0.06)" }}>
          <Settings size={16} style={{ color: "var(--foreground)" }} />
        </button>
      </div>

      {/* Tabs — scrollable on mobile */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style={{
              background: activeTab === t.id
                ? (t.id === "approve" ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.12)")
                : "transparent",
              color: activeTab === t.id
                ? (t.id === "approve" ? "#4ADE80" : "var(--foreground)")
                : "var(--muted-foreground)",
              border: activeTab === t.id
                ? (t.id === "approve" ? "1px solid rgba(74,222,128,0.3)" : `1px solid rgba(255,255,255,0.1)`)
                : "1px solid transparent",
              fontWeight: t.id === "approve" && pendingApprovals.length > 0 ? 700 : undefined,
            }}>
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {loadError && (
        <p className="text-xs px-1 mb-3" style={{ color: "var(--coral-red)" }}>⚠ {loadError}</p>
      )}

      {/* Proof note modal */}
      {proofHabitId && (() => {
        const proofHabit = habits.find(h => h.id === proofHabitId);
        const needsCount = !!proofHabit && (proofHabit.target_value > 1 || !!proofHabit.unit);
        return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => { setProofHabitId(null); setProofNote(""); setProofCount(1); }}>
          <div className="w-full max-w-sm p-5 rounded-2xl"
            style={{ background: "#161B22", border: `1px solid rgba(255,255,255,0.1)` }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>
              {proofHabit?.emoji} {proofHabit?.name}
            </h3>
            <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>
              {t('groups_proof_ph')}
            </p>
            {needsCount && (
              <div className="mb-3">
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--muted-foreground)" }}>
                  {t('groups_how_many')} {proofHabit?.unit ? `(${proofHabit.unit})` : ""}
                </label>
                <input
                  type="number" min={1} max={9999}
                  style={{ ...inputStyle, textAlign: "center", fontFamily: "'Geist Mono', monospace" }}
                  value={proofCount === 0 ? "" : proofCount}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") { setProofCount(0); return; }
                    setProofCount(Math.max(0, Math.min(9999, parseInt(raw) || 0)));
                  }}
                  onBlur={() => setProofCount((v) => Math.max(1, v))}
                />
              </div>
            )}
            <textarea
              style={{ ...inputStyle, resize: "none", minHeight: 72, lineHeight: 1.5, fontSize: 13 }}
              placeholder={t('groups_proof_hint')}
              value={proofNote}
              onChange={(e) => setProofNote(e.target.value)}
              maxLength={200}
              rows={3}
              autoFocus
            />
            <p className="text-[11px] text-right mb-3" style={{ color: "var(--muted-foreground)" }}>{proofNote.length}/200</p>
            {error && <p className="text-xs mb-3" style={{ color: "var(--coral-red)" }}>⚠ {error}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setProofHabitId(null); setProofNote(""); setProofCount(1); }}
                data-modal-close-trigger
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted-foreground)" }}>
                {t('cancel_short')}
              </button>
              <button onClick={submitHabit} disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--neon-green)", color: "#0E1117", opacity: submitting ? 0.6 : 1 }}>
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                {t('done_mark')}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Reject modal */}
      {/* Guruh sozlamalari modal */}
      {showSettings && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-sm p-5 rounded-2xl"
            style={{ background: "#161B22", border: `1px solid rgba(255,255,255,0.1)` }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>{t('groups_settings_title')}</h3>

            {leaveError && (
              <p className="text-xs mb-3" style={{ color: "var(--coral-red)" }}>⚠ {leaveError}</p>
            )}

            <button type="button" onClick={handleLeaveGroup} disabled={leaving || deletingGroup}
              className="w-full flex items-center gap-2.5 p-3 rounded-xl text-sm font-medium mb-2"
              style={{ background: "rgba(255,255,255,0.05)", color: "var(--foreground)", opacity: leaving ? 0.6 : 1 }}>
              {leaving ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
              {t('groups_leave')}
            </button>

            {isOwner && (
              <button type="button" onClick={handleDeleteGroup} disabled={leaving || deletingGroup}
                className="w-full flex items-center gap-2.5 p-3 rounded-xl text-sm font-medium"
                style={{
                  background: confirmDelete ? "rgba(248,113,113,0.15)" : "rgba(248,113,113,0.08)",
                  color: "#F87171", border: `1px solid rgba(248,113,113,${confirmDelete ? 0.4 : 0.2})`,
                  opacity: deletingGroup ? 0.6 : 1,
                }}>
                {deletingGroup ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {confirmDelete ? t('groups_delete_confirm') : t('groups_delete')}
              </button>
            )}

            <button type="button" onClick={() => setShowSettings(false)}
              data-modal-close-trigger
              className="w-full py-2.5 rounded-xl text-sm font-medium mt-3"
              style={{ color: "var(--muted-foreground)" }}>
              {t('close')}
            </button>
          </div>
        </div>
      )}

      {rejectLogId && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => { setRejectLogId(null); setRejectReason(""); }}>
          <div className="w-full max-w-sm p-5 rounded-2xl"
            style={{ background: "#161B22", border: `1px solid rgba(248,113,113,0.3)` }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>{t('groups_reject_reason')}</h3>
            <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>{t('groups_reject_hint')}</p>
            <textarea
              style={{ ...inputStyle, resize: "none", minHeight: 72, fontSize: 13 }}
              placeholder={t('groups_reject_ph')}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3} autoFocus
            />
            {error && <p className="text-xs mt-2" style={{ color: "var(--coral-red)" }}>⚠ {error}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => { setRejectLogId(null); setRejectReason(""); setError(""); }}
                data-modal-close-trigger
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted-foreground)" }}>
                {t('cancel_short')}
              </button>
              <button onClick={handleRejectSubmit} disabled={rejecting || !rejectReason.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(248,113,113,0.15)", color: "#F87171", opacity: rejecting ? 0.6 : 1 }}>
                {rejecting ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
                {t('reject')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Telegram link edit modal */}
      {showTgEdit && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowTgEdit(false)}>
          <div className="w-full max-w-sm p-5 rounded-2xl"
            style={{ background: "#161B22", border: `1px solid rgba(255,255,255,0.1)` }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <Send size={15} style={{ color: "#38BDF8" }} />
              <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('groups_tg_link')}</h3>
            </div>
            <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>{t('groups_tg_hint')}</p>
            <input
              style={inputStyle}
              placeholder={t('groups_tg_ph')}
              value={tgInput}
              onChange={(e) => setTgInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveTgLink()}
              autoFocus
            />
            {error && <p className="text-xs mt-2" style={{ color: "var(--coral-red)" }}>⚠ {error}</p>}
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => { setShowTgEdit(false); setError(""); }}
                data-modal-close-trigger
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted-foreground)" }}>
                {t('cancel_short')}
              </button>
              <button type="button" onClick={handleSaveTgLink} disabled={savingTg}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(56,189,248,0.15)", color: "#38BDF8", border: "1px solid rgba(56,189,248,0.3)", opacity: savingTg ? 0.6 : 1 }}>
                {savingTg ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      <AddGroupHabitModal
        isOpen={showAddHabit}
        onClose={resetHabitForm}
        initialData={editingHabitId ? habits.find(h => h.id === editingHabitId) : undefined}
        onAdd={async (habitData) => {
          if (editingHabitId) {
            const h = await updateGroupHabit(editingHabitId, {
              name: habitData.name,
              emoji: habitData.emoji,
              type: habitData.type,
              target_value: habitData.target_value,
              unit: habitData.unit
            });
            setHabits((prev) => prev.map((x) => x.id === editingHabitId ? h : x));
          } else {
            const h = await addGroupHabit(group.id, habitData.name, habitData.emoji, habitData.type, habitData.target_value, habitData.unit);
            setHabits((prev) => [...prev, h]);
          }
        }}
      />

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={22} className="animate-spin" style={{ color: "var(--neon-green)" }} />
        </div>
      ) : (
        <>
          {/* ── HABITS TAB ── */}
          {activeTab === "habits" && <HabitsTab s={s} />}

          {/* ── MEMBERS TAB ── */}
          {activeTab === "members" && <MembersTab s={s} />}

          {/* ── LEADERBOARD TAB ── */}
          {activeTab === "leaderboard" && <LeaderboardTab s={s} />}

          {/* ── STATS TAB ── */}
          {activeTab === "stats" && <StatsTab s={s} />}

          {/* ── TEAMS TAB ── */}
          {activeTab === "teams" && <TeamsTab s={s} />}

          {/* ── APPROVE TAB (admin only) ── */}
          {activeTab === "approve" && isAdmin && <ApproveTab s={s} />}
        </>
      )}
    </div>
  );
}
