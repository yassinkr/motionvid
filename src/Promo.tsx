import React, { createContext, useContext } from "react";
import {
  AbsoluteFill, Sequence, Audio, staticFile, interpolate, interpolateColors, spring,
  random, Easing, useCurrentFrame, useVideoConfig, Composition, CalculateMetadataFunction,
} from "remotion";
import { loadFont as loadSans } from "@remotion/google-fonts/IBMPlexSans";
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono";
import { interpolateColors } from "remotion";

// npm i @remotion/google-fonts   (fonts are embedded at render time)
const SANS = loadSans("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] }).fontFamily;
const MONO = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;

// ================= CONFIG =================
const HAS_VOICE = false; // public/vo/01.mp3 ... 07.mp3
const HAS_MUSIC = false; // public/music.mp3
const HAS_SFX = false; // public/sfx/glitch.mp3, public/sfx/whoosh.mp3
const SHOW_SUBS = true;

const FPS = 30;
const VO_IN = 5;
const VO_TAIL = 12;
const M = 120; // page margin, every scene aligns to it
const withAlpha = (rgba: string, a: number) =>
  rgba.replace(/rgba?\(([^)]+)\)/, (_, v) => {
    const [r, g, b] = v.split(",").map((s: string) => s.trim());
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  });
// usage: withAlpha(g, 0.14) instead of `${g}24`
// Blueprint palette: navy ground, drafting blue, ink, resolved green, alarm red
const C = {
  bg: "#081630",
  panel: "#0D2247",
  grid: "#3D7BFF",
  line: "#28406B",
  blue: "#5B93FF",
  green: "#2FD39A",
  red: "#FF5A4E",
  ink: "#EEF3FB",
  muted: "#8FA3C4",
};
const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const OUT = { ...CL, easing: Easing.out(Easing.cubic) };

// ================= TIMELINE =================
const KEYS = ["chaos", "hook", "snap", "identity", "method", "proof", "cta"] as const;
type Key = (typeof KEYS)[number];
const BASE: number[] = [90, 90, 90, 90, 240, 180, 120]; // 900 frames = 30s

const VO_TEXT: string[] = [
  "Shifting scope. Unclear requirements. Missed deadlines.",
  "Tell me the problem. I'll study it first.",
  "Then I structure the solution.",
  "I'm Yassine. Business analyst and full-stack engineer.",
  "Discovery first. Requirements locked. Trade-offs written down. Then I build, and hand over everything.",
  "Repair shops. Training centers. A legacy rewrite. Web, mobile, desktop. Clients come back.",
  "Brief me. I'll build it.",
];

type Timeline = Record<Key, { from: number; dur: number; to: number }> & { total: number };
const buildTimeline = (durs: number[]): Timeline => {
  let at = 0;
  const t = {} as Timeline;
  KEYS.forEach((k, i) => { t[k] = { from: at, dur: durs[i], to: at + durs[i] }; at += durs[i]; });
  t.total = at;
  return t;
};
const TL = createContext<Timeline>(buildTimeline(BASE));
const useTL = () => useContext(TL);

const audioSeconds = (src: string) =>
  new Promise<number>((res, rej) => {
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.onloadedmetadata = () => res(a.duration);
    a.onerror = () => rej(new Error(`Cannot load ${src}`));
    a.src = src;
  });

type Props = { durs: number[] };
const calculateMetadata: CalculateMetadataFunction<Props> = async () => {
  let durs = BASE;
  if (HAS_VOICE) {
    const secs = await Promise.all(KEYS.map((_, i) => audioSeconds(staticFile(`vo/0${i + 1}.mp3`))));
    durs = BASE.map((b, i) => Math.max(b, Math.ceil(secs[i] * FPS) + VO_IN + VO_TAIL));
    console.log("VO seconds", secs.map((s) => s.toFixed(2)), "scene frames", durs);
  }
  return { durationInFrames: durs.reduce((a, b) => a + b, 0), props: { durs } };
};

// ================= ICONS =================
const ICONS: Record<string, React.ReactNode> = {
  file: (<><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6" /></>),
  mail: (<><rect x="3" y="5" width="18" height="14" rx="1" /><path d="M3 7l9 6 9-6" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  bug: (<><ellipse cx="12" cy="13" rx="5" ry="7" /><path d="M12 6V3M7 10H3M17 10h4M7 16H3M17 16h4M9 5L7 3M15 5l2-2" /></>),
  alert: (<><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" /></>),
  question: (<><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 015 0c0 2-2.5 2-2.5 4M12 17v.5" /></>),
  gear: (<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>),
  cap: (<><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11v5c3 2 9 2 12 0v-5" /></>),
  layers: (<><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>),
  rewrite: (<><path d="M4 12a8 8 0 0114-5M20 4v4h-4M20 12a8 8 0 01-14 5M4 20v-4h4" /></>),
  web: (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>),
  mobile: (<><rect x="7" y="2" width="10" height="20" rx="1.5" /><path d="M11 18h2" /></>),
  desktop: (<><rect x="2" y="4" width="20" height="13" rx="1" /><path d="M8 21h8M12 17v4" /></>),
  search: (<><circle cx="10" cy="10" r="6" /><path d="M15 15l6 6" /></>),
  list: (<><path d="M8 6h13M8 12h13M8 18h13M3 6h.5M3 12h.5M3 18h.5" /></>),
  scale: (<><path d="M12 3v18M5 21h14M4 7h16" /><path d="M4 7l-3 7a3 3 0 006 0zM20 7l-3 7a3 3 0 006 0z" /></>),
  code: (<><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" /></>),
  package: (<><path d="M3 7l9-4 9 4v10l-9 4-9-4z" /><path d="M3 7l9 4 9-4M12 11v10" /></>),
  check: (<><path d="M4 12l5 5L20 6" /></>),
};

const Icon: React.FC<{ n: string; size?: number; color?: string; sw?: number }> = ({
  n, size = 48, color = "currentColor", sw = 1.6,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: "block" }}>
    {ICONS[n]}
  </svg>
);

// ================= PRIMITIVES =================
const Fade: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 8, dur - 8, dur], [0, 1, 1, 0], CL);
  return <AbsoluteFill style={{ opacity: o, fontFamily: SANS, color: C.ink }}>{children}</AbsoluteFill>;
};

// Left-to-right reveal, like a line being drawn. The one motion used for headlines.
const Wipe: React.FC<{ at: number; dur?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  at, dur = 16, children, style,
}) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + dur], [0, 100], OUT);
  return <div style={{ clipPath: `inset(-20% ${100 - p}% -20% 0)`, ...style }}>{children}</div>;
};

const Typed: React.FC<{ text: string; at: number; cps?: number; style?: React.CSSProperties }> = ({
  text, at, cps = 32, style,
}) => {
  const f = useCurrentFrame();
  const n = Math.max(0, Math.min(text.length, Math.floor(((f - at) / FPS) * cps)));
  const caret = f >= at && Math.floor(f / 15) % 2 === 0;
  return (
    <div style={{ fontFamily: MONO, whiteSpace: "pre", ...style }}>
      {text.slice(0, n)}<span style={{ opacity: caret ? 1 : 0 }}>▍</span>
    </div>
  );
};

const H1: React.CSSProperties = { fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.02 };

// ================= GLOBAL LAYERS =================
const Blueprint: React.FC = () => {
  const f = useCurrentFrame();
  const t = useTL();
  const g = interpolateColors(f, [t.snap.from, t.snap.from + 25], [C.red, C.grid]);
  const glitch = f < 10 ? (random(`g${f}`) - 0.5) * 24 : 0;
  const mk = (x: number, y: number) => (
    <div style={{ position: "absolute", left: x - 14, top: y - 14, width: 28, height: 28 }}>
      <div style={{ position: "absolute", left: 13, top: 0, width: 2, height: 28, background: `${g}66` }} />
      <div style={{ position: "absolute", top: 13, left: 0, height: 2, width: 28, background: `${g}66` }} />
    </div>
  );
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill style={{
        transform: `translateX(${glitch}px)`,
        backgroundImage: [
          `linear-gradient(${g}24 1px, transparent 1px)`, `linear-gradient(90deg, ${g}24 1px, transparent 1px)`,
          `linear-gradient(${g}0E 1px, transparent 1px)`, `linear-gradient(90deg, ${g}0E 1px, transparent 1px)`,
        ].join(","),
        backgroundSize: "200px 200px, 200px 200px, 40px 40px, 40px 40px",
        backgroundPosition: "-40px -40px",
      }} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 45%, transparent 40%, ${C.bg} 100%)` }} />
      {mk(60, 60)}{mk(1860, 60)}{mk(60, 1020)}{mk(1860, 1020)}
      {/* Progress rule: where we are in the story */}
      <div style={{ position: "absolute", left: M, right: M, top: 58, height: 2, background: `${C.line}` }} />
      <div style={{ position: "absolute", left: M, top: 58, height: 2, background: g,
        width: interpolate(f, [0, t.total], [0, 1920 - 2 * M]) }} />
    </AbsoluteFill>
  );
};

const Subtitles: React.FC = () => {
  const f = useCurrentFrame();
  const t = useTL();
  const i = KEYS.findIndex((k) => f >= t[k].from && f < t[k].to);
  if (i < 0) return null;
  const s = t[KEYS[i]];
  const o = interpolate(f, [s.from, s.from + 6, s.to - 6, s.to], [0, 1, 1, 0], CL);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 44 }}>
      <div style={{ opacity: o, maxWidth: 1440, textAlign: "center", fontFamily: SANS, fontSize: 36, fontWeight: 500,
        lineHeight: 1.3, color: C.ink, background: "rgba(5,13,30,0.86)", padding: "12px 28px" }}>
        {VO_TEXT[i]}
      </div>
    </AbsoluteFill>
  );
};

// ================= CHAOS -> REQUIREMENTS TABLE =================
const CHIPS = [
  { t: "v3_FINAL_final.xlsx", i: "file" },
  { t: "47 unread", i: "mail" },
  { t: "Deadline moved", i: "clock" },
  { t: "Bug #212", i: "bug" },
  { t: "Scope changed?", i: "question" },
  { t: "Who owns this?", i: "alert" },
  { t: "Requirements v7", i: "file" },
  { t: "Urgent!!!", i: "alert" },
  { t: "Call at 9am", i: "clock" },
  { t: "Spec missing", i: "question" },
];

const ChipLayer: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const T = useTL();
  const t = spring({ frame: f - T.snap.from, fps, config: { damping: 18, stiffness: 110 } });
  const op = interpolate(f, [0, 6, T.snap.to - 18, T.snap.to], [0, 1, 1, 0], CL);
  const chaos = 1 - t;
  const shake = interpolate(f, [0, T.hook.from, T.snap.from], [3, 7, 12], CL) * chaos;
  // During the hook the mess steps back so the line can land
  const blur = interpolate(f, [T.hook.from, T.hook.from + 12, T.snap.from, T.snap.from + 8], [0, 7, 7, 0], CL);
  const dim = interpolate(f, [T.hook.from, T.hook.from + 12, T.snap.from, T.snap.from + 8], [1, 0.35, 0.35, 1], CL);
  const resolved = t > 0.55;
  return (
    <AbsoluteFill style={{ opacity: op * dim, filter: `blur(${blur}px)`, fontFamily: SANS }}>
      {CHIPS.map((c, i) => {
        const cw = 150 + c.t.length * 14;
        const cx = 140 + random(`x${i}`) * (1640 - cw);
        const cy = 130 + random(`y${i}`) * 640;
        const rot = (random(`r${i}`) - 0.5) * 36;
        const gx = i < 5 ? M : 1000;
        const gy = 380 + (i % 5) * 84;
        const w = cw + (800 - cw) * t;
        const x = cx + (gx - cx) * t + Math.sin(f / 1.7 + i * 3) * shake;
        const y = cy + (gy - cy) * t + Math.cos(f / 2.1 + i * 2) * shake;
        const r = rot * chaos + Math.sin(f / 2.6 + i) * shake * 0.25;
        const col = interpolateColors(t, [0, 1], [C.red, C.green]);
        return (
          <div key={i} style={{
            position: "absolute", left: x, top: y, width: w, height: 68, boxSizing: "border-box",
            display: "flex", alignItems: "center", gap: 16, padding: "0 22px",
            background: C.panel, border: `1.5px ${resolved ? "solid" : "dashed"} ${resolved ? C.line : col}`,
            borderLeft: `4px solid ${col}`, color: C.ink, fontSize: 26, fontWeight: 500, whiteSpace: "nowrap",
            transform: `rotate(${r}deg)`, boxShadow: chaos > 0.1 ? `0 12px 30px rgba(0,0,0,0.35)` : "none",
          }}>
            <span style={{ fontFamily: MONO, fontSize: 20, color: C.muted, width: 86 * t, overflow: "hidden", opacity: t }}>
              REQ-{String(i + 1).padStart(2, "0")}
            </span>
            <Icon n={c.i} size={28} color={col} />
            <span style={{ flex: 1 }}>{c.t}</span>
            <span style={{ fontFamily: MONO, fontSize: 19, color: col }}>{resolved ? "mapped" : "open"}</span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ================= SCENES (frame 0 = scene start) =================
const Hook: React.FC = () => (
  <AbsoluteFill style={{ justifyContent: "center", paddingLeft: M }}>
    <Wipe at={4} dur={18}><div style={{ ...H1, fontSize: 148 }}>Tell me the problem.</div></Wipe>
    <Typed text="I'll study it first." at={34} style={{ fontSize: 52, color: C.green, marginTop: 28 }} />
  </AbsoluteFill>
);

const Snap: React.FC = () => (
  <AbsoluteFill style={{ paddingLeft: M, paddingTop: 150 }}>
    <Wipe at={10}><div style={{ ...H1, fontSize: 104 }}>I structure the solution.</div></Wipe>
    <Wipe at={22} dur={20}>
      <div style={{ fontFamily: MONO, fontSize: 24, color: C.muted, marginTop: 22 }}>
        10 open threads → 10 mapped requirements
      </div>
    </Wipe>
  </AbsoluteFill>
);

const Identity: React.FC = () => {
  const f = useCurrentFrame();
  const draw = interpolate(f, [10, 34], [0, 1], OUT);
  const node = (icon: string, col: string, label: string, at: number) => {
    const o = interpolate(f, [at, at + 10], [0, 1], CL);
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, opacity: o }}>
        <div style={{ width: 170, height: 170, border: `2px solid ${col}`, background: C.panel,
          display: "flex", justifyContent: "center", alignItems: "center" }}>
          <Icon n={icon} size={80} color={col} />
        </div>
        <div style={{ fontFamily: MONO, fontSize: 24, color: col }}>{label}</div>
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 170 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
        {node("list", C.blue, "analyst", 0)}
        <svg width={360} height={170} style={{ display: "block" }}>
          <line x1={10} y1={85} x2={350} y2={85} stroke={C.muted} strokeWidth={2} strokeDasharray="8 8"
            strokeDashoffset={0} style={{ clipPath: `inset(0 ${100 - draw * 100}% 0 0)` }} />
          <circle cx={180} cy={85} r={26} fill={C.bg} stroke={C.ink} strokeWidth={2} opacity={draw} />
          <path d="M180 73v24M168 85h24" stroke={C.ink} strokeWidth={2} opacity={draw} />
        </svg>
        {node("code", C.green, "engineer", 8)}
      </div>
      <Wipe at={30} dur={18}>
        <div style={{ ...H1, fontSize: 112, marginTop: 70, textAlign: "center" }}>Kerrai Mohammed Yassine</div>
      </Wipe>
      <Wipe at={42} dur={18}>
        <div style={{ fontFamily: MONO, fontSize: 32, color: C.muted, marginTop: 20, textAlign: "center" }}>
          Business Analyst + Full-Stack Engineer
        </div>
      </Wipe>
    </AbsoluteFill>
  );
};

const STEPS = [
  { n: "Discovery", d: "Map the real process.", i: "search" },
  { n: "Requirements", d: "Scope locked on paper.", i: "list" },
  { n: "Trade-offs", d: "Rejected options recorded.", i: "scale" },
  { n: "Execution", d: "Build with checkpoints.", i: "code" },
  { n: "Handover", d: "Documented. Yours.", i: "package" },
];

const Method: React.FC = () => {
  const f = useCurrentFrame();
  const { dur } = useTL().method;
  const start = 30;
  const step = (dur - start - 40) / STEPS.length;
  const active = Math.floor((f - start) / step);
  const prog = interpolate(f, [start, start + step * 4], [0, 4], { ...CL, easing: Easing.inOut(Easing.quad) });
  const X0 = 260, GAP = 350, Y = 560;
  return (
    <AbsoluteFill style={{ paddingLeft: M, paddingTop: 140 }}>
      <Wipe at={2}><div style={{ ...H1, fontSize: 88 }}>Discovery is step one.</div></Wipe>
      <Wipe at={20}><div style={{ ...H1, fontSize: 88, color: C.blue, marginTop: 8 }}>Code is step four.</div></Wipe>

      {/* process line */}
      <div style={{ position: "absolute", left: X0, top: Y, width: GAP * 4, height: 2, background: C.line }} />
      <div style={{ position: "absolute", left: X0, top: Y, width: GAP * prog, height: 2, background: C.green }} />
      {STEPS.map((s, i) => {
        const x = X0 + i * GAP;
        const isActive = active === i;
        const isDone = active > i;
        const appear = interpolate(f, [10 + i * 5, 22 + i * 5], [0, 1], CL);
        const col = isDone ? C.green : isActive ? C.ink : C.muted;
        return (
          <div key={i} style={{ position: "absolute", left: x - 150, top: Y - 36, width: 300, opacity: appear,
            display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{
              width: 72, height: 72, boxSizing: "border-box", background: isDone ? C.green : C.bg,
              border: `2px solid ${isDone ? C.green : isActive ? C.ink : C.line}`,
              display: "flex", justifyContent: "center", alignItems: "center",
              transform: `scale(${isActive ? 1.12 : 1})`,
              boxShadow: isActive ? `0 0 0 10px ${C.ink}14` : "none",
            }}>
              <Icon n={isDone ? "check" : s.i} size={34} color={isDone ? C.bg : col} sw={isDone ? 2.6 : 1.8} />
            </div>
            <div style={{ fontFamily: MONO, fontSize: 22, color: i === 3 ? C.blue : C.muted, marginTop: 26 }}>
              step {i + 1}{i === 3 ? " · code" : ""}
            </div>
            <div style={{ fontSize: 38, fontWeight: 600, marginTop: 6, color: isActive || isDone ? C.ink : C.muted }}>{s.n}</div>
            <div style={{ fontSize: 24, color: C.muted, marginTop: 6, textAlign: "center" }}>{s.d}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const CARDS = [
  { t: "Repair Shop Manager", d: "Paper and memory → one system", i: "gear" },
  { t: "Training Center Platform", d: "Same client. Second project.", i: "cap" },
  { t: "VB.Net → Rewrite", d: "Legacy desktop → Electron + React", i: "rewrite" },
  { t: "Scope Creep Monster", d: "3 systems. 1 coherent build.", i: "layers" },
];

const Proof: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { dur } = useTL().proof;
  const p = Math.round(dur * 0.5);
  return (
    <AbsoluteFill style={{ paddingLeft: M, paddingTop: 140 }}>
      <Wipe at={2}><div style={{ ...H1, fontSize: 88 }}>Real operations. Shipped.</div></Wipe>
      <div style={{ display: "flex", gap: 26, marginTop: 64 }}>
        {CARDS.map((c, i) => {
          const sp = spring({ frame: f - 10 - i * 7, fps, config: { damping: 20, stiffness: 140 } });
          return (
            <div key={i} style={{
              width: 400, height: 280, padding: "26px 30px", boxSizing: "border-box",
              background: C.panel, border: `1.5px solid ${C.line}`, borderTop: `3px solid ${C.blue}`,
              display: "flex", flexDirection: "column", justifyContent: "space-between",
              transform: `translateY(${(1 - sp) * 40}px)`, opacity: sp,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: MONO, fontSize: 20, color: C.muted }}>case {String(i + 1).padStart(2, "0")}</span>
                <Icon n={c.i} size={40} color={C.blue} />
              </div>
              <div>
                <div style={{ fontSize: 34, fontWeight: 600, lineHeight: 1.12, letterSpacing: "-0.01em" }}>{c.t}</div>
                <div style={{ fontSize: 23, color: C.muted, marginTop: 10, lineHeight: 1.3 }}>{c.d}</div>
              </div>
            </div>
          );
        })}
      </div>
      <Wipe at={p} dur={20} style={{ marginTop: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
          {[["web", "Web"], ["mobile", "Mobile"], ["desktop", "Desktop"]].map(([ic, lb]) => (
            <div key={ic} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Icon n={ic} size={44} color={C.green} />
              <span style={{ fontSize: 38, fontWeight: 600 }}>{lb}</span>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 24, color: C.muted, marginTop: 16 }}>
          Next.js · React Native · Electron · Tauri · PostgreSQL · Docker
        </div>
      </Wipe>
    </AbsoluteFill>
  );
};

const Cta: React.FC = () => {
  const f = useCurrentFrame();
  const u = interpolate(f, [48, 70], [0, 1], OUT);
  return (
    <AbsoluteFill style={{ justifyContent: "center", paddingLeft: M, paddingBottom: 60 }}>
      <Wipe at={2} dur={16}><div style={{ ...H1, fontSize: 168 }}>Brief me.</div></Wipe>
      <Wipe at={16} dur={16}><div style={{ ...H1, fontSize: 168, color: C.green }}>I'll build it.</div></Wipe>
      <div style={{ marginTop: 64, opacity: interpolate(f, [40, 52], [0, 1], CL) }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 18, fontFamily: MONO, fontSize: 40 }}>
          <Icon n="mail" size={40} color={C.blue} />
          kerraiyassin@gmail.com
        </div>
        <div style={{ height: 2, background: C.blue, width: 640 * u, marginTop: 12 }} />
        <div style={{ fontFamily: MONO, fontSize: 30, color: C.muted, marginTop: 20 }}>yassin.webaudit.one</div>
      </div>
    </AbsoluteFill>
  );
};

// ================= MAIN =================
const SCENES: { k: Key; C: React.FC }[] = [
  { k: "hook", C: Hook }, { k: "snap", C: Snap }, { k: "identity", C: Identity },
  { k: "method", C: Method }, { k: "proof", C: Proof }, { k: "cta", C: Cta },
];

export const Promo: React.FC<Props> = ({ durs }) => {
  const t = buildTimeline(durs);
  return (
    <TL.Provider value={t}>
      <AbsoluteFill>
        <Blueprint />
        <ChipLayer />
        {SCENES.map(({ k, C: Scene }) => (
          <Sequence key={k} from={t[k].from} durationInFrames={t[k].dur}>
            <Fade dur={t[k].dur}><Scene /></Fade>
          </Sequence>
        ))}
        {SHOW_SUBS ? <Subtitles /> : null}

        {HAS_VOICE
          ? KEYS.map((k, i) => (
              <Sequence key={`vo${i}`} from={t[k].from + VO_IN} durationInFrames={t[k].dur - VO_IN}>
                <Audio src={staticFile(`vo/0${i + 1}.mp3`)} />
              </Sequence>
            ))
          : null}
        {HAS_MUSIC ? (
          <Sequence from={t.snap.from}>
            {(() => {
              const len = t.total - t.snap.from;
              return <Audio src={staticFile("music.mp3")}
                volume={(fr) => interpolate(fr, [0, 30, len - 60, len], [0, 0.2, 0.2, 0], CL)} />;
            })()}
          </Sequence>
        ) : null}
        {HAS_SFX ? (
          <>
            <Sequence from={0}><Audio src={staticFile("sfx/glitch.mp3")} volume={0.5} /></Sequence>
            <Sequence from={t.snap.from}><Audio src={staticFile("sfx/whoosh.mp3")} volume={0.6} /></Sequence>
          </>
        ) : null}
      </AbsoluteFill>
    </TL.Provider>
  );
};

export const Root: React.FC = () => (
  <Composition id="Promo" component={Promo} durationInFrames={900} fps={FPS} width={1920} height={1080}
    defaultProps={{ durs: BASE }} calculateMetadata={calculateMetadata} />
);

// SETUP
// 1) npx create-video@latest   (blank, TypeScript)
// 2) npm i @remotion/google-fonts
// 3) src/Promo.tsx = this file. src/index.ts:
//      import { registerRoot } from "remotion";
//      import { Root } from "./Promo";
//      registerRoot(Root);
// 4) npx remotion studio      5) npx remotion render Promo out.mp4
