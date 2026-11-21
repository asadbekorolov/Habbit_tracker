// Ulashish posteri: Story (9:16, 360x640) va Post (1:1, 360x360).
// PNG eksportda pixelRatio 3 -> 1080x1920 / 1080x1080.
// Faqat inline uslublar va oddiy gradientlar (blur filtrlar PNG'da buziladi).
import { forwardRef } from "react";
import { ShieldCheck, Flame, CheckCircle2, Sparkles, Zap } from "lucide-react";
import { CHARACTER_POSTER_SRC } from "../../../components/CharacterVideo";
import { getFrameStyle, getUsernameGlowStyle } from "../../../utils/cosmetics";
import { PUBLIC_SITE_HOST } from "../../../utils/referral";

export type PosterFormat = "story" | "post";

export interface PosterData {
  name: string;
  username: string;
  level: number;
  frameId: string | null;
  glow: boolean;
  discipline: number;
  bestStreak: number;
  totalDone: number;
  totalHabits: number;
  aiLine: string | null;
  code: string | null;
  monthLabel: string;
  heat: string[];
}

export interface PosterLabels {
  tag: string;
  discipline: string;
  bestStreak: string;
  days: string;
  totalDone: string;
  habits: string;
  aiTitle: string;
  last30: string;
  code: string;
  cta: string;
}

const BG = "#090d16";
const EMERALD = "#10b981";
const MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const SANS = "'Inter', system-ui, sans-serif";
export const POSTER_SIZE: Record<PosterFormat, { w: number; h: number }> = {
  story: { w: 360, h: 640 },
  post: { w: 360, h: 360 },
};

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.035)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 24,
};

function Logo({ size = 26 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <img src="/icon-192.png" alt="" width={size} height={size} style={{ borderRadius: size * 0.3, display: "block" }} />
      <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: size * 0.58, letterSpacing: "0.22em", color: "#fff" }}>IDROK</span>
    </div>
  );
}

function Character({ data, height, radius }: { data: PosterData; height: number; radius: number }) {
  const frame = getFrameStyle(data.frameId);
  return (
    <div
      style={{
        position: "relative",
        height,
        borderRadius: radius,
        overflow: "hidden",
        background: "#cdad84",
        border: frame?.border ?? "1px solid rgba(16,185,129,0.35)",
        boxShadow: frame?.boxShadow ?? "0 0 32px rgba(16,185,129,0.18)",
      }}
    >
      <img
        src={CHARACTER_POSTER_SRC}
        alt=""
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 30%", display: "block" }}
      />
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, ${BG} 0%, rgba(9,13,22,0.15) 45%, rgba(9,13,22,0) 70%)` }} />
    </div>
  );
}

function Identity({ data, align = "left", nameSize = 22 }: { data: PosterData; align?: "left" | "center"; nameSize?: number }) {
  return (
    <div style={{ textAlign: align }}>
      <div
        style={{
          fontFamily: SANS, fontWeight: 700, fontSize: nameSize, lineHeight: 1.15, color: "#fff",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          ...(data.glow ? getUsernameGlowStyle() : {}),
        }}
      >
        {data.name}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, justifyContent: align === "center" ? "center" : "flex-start" }}>
        <span style={{ fontFamily: MONO, fontSize: 11, color: "#94a3b8" }}>@{data.username}</span>
        <span
          style={{
            fontFamily: MONO, fontWeight: 700, fontSize: 10, letterSpacing: "0.08em", color: EMERALD, whiteSpace: "nowrap", flexShrink: 0,
            padding: "3px 8px", borderRadius: 999, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.35)",
          }}
        >
          LVL {data.level}
        </span>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, value, label, color }: { icon: typeof Flame; value: string; label: string; color: string }) {
  return (
    <div style={{ ...card, padding: "12px 14px", flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6, color: "#94a3b8", fontFamily: SANS, fontSize: 9.5, fontWeight: 600, letterSpacing: "0.05em", lineHeight: 1.25, textTransform: "uppercase", minHeight: 24 }}>
        <Icon size={12} color={color} style={{ flexShrink: 0 }} /> <span>{label}</span>
      </div>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, color: "#fff", marginTop: 6 }}>{value}</div>
    </div>
  );
}

function Footer({ data, labels }: { data: PosterData; labels: PosterLabels }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <Logo size={24} />
      <div style={{ textAlign: "right", minWidth: 0 }}>
        {data.code && (
          <div
            style={{
              display: "inline-block", fontFamily: MONO, fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", color: "#fff", whiteSpace: "nowrap",
              padding: "4px 10px", borderRadius: 10, background: "rgba(16,185,129,0.14)", border: "1px solid rgba(16,185,129,0.4)",
            }}
          >
            {labels.code}: {data.code}
          </div>
        )}
        <div style={{ fontFamily: MONO, fontSize: 9.5, color: "#64748b", marginTop: 4 }}>{PUBLIC_SITE_HOST}</div>
      </div>
    </div>
  );
}

function Glow() {
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(120% 60% at 50% 0%, rgba(16,185,129,0.22) 0%, rgba(16,185,129,0) 60%)` }} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(90% 50% at 100% 100%, rgba(16,185,129,0.10) 0%, rgba(16,185,129,0) 60%)` }} />
    </>
  );
}

export const AnalyticsPoster = forwardRef<HTMLDivElement, { format: PosterFormat; data: PosterData; labels: PosterLabels }>(
  function AnalyticsPoster({ format, data, labels }, ref) {
    const { w, h } = POSTER_SIZE[format];
    const root: React.CSSProperties = {
      width: w, height: h, position: "relative", overflow: "hidden", background: BG, color: "#fff", fontFamily: SANS, boxSizing: "border-box",
    };

    if (format === "post") {
      return (
        <div ref={ref} style={root}>
          <Glow />
          <div style={{ position: "relative", height: "100%", padding: 20, display: "flex", flexDirection: "column", gap: 12, boxSizing: "border-box" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ width: 92, flexShrink: 0 }}><Character data={data} height={92} radius={24} /></div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: MONO, fontSize: 9.5, color: EMERALD, letterSpacing: "0.14em", marginBottom: 6 }}>{labels.tag} · {data.monthLabel}</div>
                <Identity data={data} nameSize={19} />
              </div>
            </div>
            <div style={{ ...card, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid rgba(16,185,129,0.35)", background: "rgba(16,185,129,0.07)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 600, color: "#cbd5e1", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                <ShieldCheck size={16} color={EMERALD} /> {labels.discipline}
              </div>
              <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 38, color: EMERALD, lineHeight: 1 }}>{data.discipline}%</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Stat icon={Flame} value={`${data.bestStreak} ${labels.days}`} label={labels.bestStreak} color="#f59e0b" />
              <Stat icon={CheckCircle2} value={String(data.totalDone)} label={labels.totalDone} color={EMERALD} />
            </div>
            <div style={{ marginTop: "auto" }}><Footer data={data} labels={labels} /></div>
          </div>
        </div>
      );
    }

    return (
      <div ref={ref} style={root}>
        <Glow />
        <div style={{ position: "relative", height: "100%", padding: "22px 20px 20px", display: "flex", flexDirection: "column", gap: 14, boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 9.5, color: EMERALD, letterSpacing: "0.14em", whiteSpace: "nowrap", padding: "5px 10px", borderRadius: 999, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)" }}>
              <Zap size={11} color={EMERALD} /> {labels.tag}
            </div>
            <span style={{ fontFamily: MONO, fontSize: 10, color: "#94a3b8" }}>{data.monthLabel}</span>
          </div>

          <Character data={data} height={190} radius={28} />
          <div style={{ marginTop: -46, padding: "0 6px", position: "relative" }}>
            <Identity data={data} />
          </div>

          <div style={{ ...card, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid rgba(16,185,129,0.35)", background: "rgba(16,185,129,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: "#cbd5e1", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              <ShieldCheck size={18} color={EMERALD} /> {labels.discipline}
            </div>
            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 46, color: EMERALD, lineHeight: 1 }}>{data.discipline}%</div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Stat icon={Flame} value={`${data.bestStreak} ${labels.days}`} label={labels.bestStreak} color="#f59e0b" />
            <Stat icon={CheckCircle2} value={String(data.totalDone)} label={labels.totalDone} color={EMERALD} />
          </div>

          {data.aiLine ? (
            <div style={{ ...card, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9.5, fontWeight: 600, color: EMERALD, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
                <Sparkles size={12} color={EMERALD} /> {labels.aiTitle}
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.45, color: "#e2e8f0", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {data.aiLine}
              </div>
            </div>
          ) : (
            <div style={{ ...card, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, fontWeight: 600, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                <span>{labels.last30}</span>
                <span style={{ fontFamily: MONO, color: "#cbd5e1" }}>{data.totalHabits} {labels.habits}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(15, 1fr)", gap: 4 }}>
                {data.heat.slice(-30).map((c, i) => (
                  <div key={i} style={{ height: 12, borderRadius: 4, background: c }} />
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            {data.code && (
              <div style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "#cbd5e1" }}>{labels.cta}</div>
            )}
            <Footer data={data} labels={labels} />
          </div>
        </div>
      </div>
    );
  },
);
