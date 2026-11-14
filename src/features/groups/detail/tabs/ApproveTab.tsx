// Guruh tafsilotlari — ApproveTab.
import { Check, X, ShieldCheck, MessageSquare } from "lucide-react";
import type { GroupDetailState } from "../useGroupDetail";

export function ApproveTab({ s }: { s: GroupDetailState }) {
  const { card, t, pendingApprovals, error, setRejectLogId, setRejectReason, handleApprove } = s;

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-xs px-1" style={{ color: "var(--coral-red)" }}>⚠ {error}</p>}
      {pendingApprovals.length === 0 ? (
        <div style={card} className="p-10 flex flex-col items-center gap-3">
          <ShieldCheck size={32} style={{ color: "#4ADE80" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t('groups_all_checked')}</p>
          <p className="text-xs text-center" style={{ color: "var(--muted-foreground)" }}>
            {t('groups_no_pending')}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs px-1" style={{ color: "var(--muted-foreground)" }}>
            {`${t('groups_pending_count').replace('{n}', String(pendingApprovals.length))}`}
          </p>
          {pendingApprovals.map((item) => {
            const p = item.profiles;
            const h = item.group_habits;
            if (!p || !h) return null;
            const initials = (p.display_name || "?").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
            return (
              <div key={item.id} style={{ ...card, border: "1px solid rgba(251,191,36,0.2)" }} className="p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden"
                    style={{ background: p.avatar_color || "#4ADE80", color: "#0E1117" }}>
                    {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-9 h-9 object-cover" /> : initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{p.display_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span>{h.emoji}</span>
                      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{h.name}</span>
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)", fontFamily: "'Geist Mono', monospace" }}>
                      {item.log_date}
                    </p>
                  </div>
                  <div className="px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                    style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24" }}>
                    {t('pending')}
                  </div>
                </div>

                {item.proof_note && (
                  <div className="mb-3 p-2.5 rounded-xl flex items-start gap-2"
                    style={{ background: "rgba(255,255,255,0.04)" }}>
                    <MessageSquare size={13} style={{ color: "var(--muted-foreground)", flexShrink: 0, marginTop: 1 }} />
                    <p className="text-xs leading-relaxed" style={{ color: "var(--foreground)" }}>{item.proof_note}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={() => { setRejectLogId(item.id); setRejectReason(""); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: "rgba(248,113,113,0.1)", color: "#F87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                    <X size={13} /> {t('reject')}
                  </button>
                  <button onClick={() => handleApprove(item.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: "rgba(74,222,128,0.15)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.3)" }}>
                    <Check size={13} /> {t('groups_approve_btn')}
                  </button>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
