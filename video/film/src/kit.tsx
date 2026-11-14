import React from "react";
import { Easing, Img, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { noise2D } from "@remotion/noise";
import EV from "./events.json";
import CAP from "../public/cap/manifest.json";

// FairNest's own tokens (frontend/src/app/globals.css): warm black, sodium yellow, cream, navy ink, electric blue.
// the same Sora and IBM Plex Mono files the site ships (next/font), served locally so a render never waits on the network
const face = (family: string, file: string, weight: string, range?: string) => {
  if (typeof document === "undefined") return;
  const h = delayRender(`font ${file}`), f = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, { weight, ...(range ? { unicodeRange: range } : {}) });
  f.load().then(() => { (document.fonts as unknown as { add: (f: FontFace) => void }).add(f); continueRender(h); }).catch((e) => { console.error(e); continueRender(h); });
};
face("Sora", "sora.woff2", "100 800"); face("Sora", "sora-ext.woff2", "100 800", "U+0100-02BA, U+1E00-1EFF");
face("IBM Plex Mono", "plex-400.woff2", "400"); face("IBM Plex Mono", "plex-500.woff2", "500");
export const SANS = "Sora, sans-serif";
export const MONO = "'IBM Plex Mono', monospace";
export const C = { void: "#0B0A06", glow: "#F3DF1D", hot: "#FFF27A", core: "#F0EEE4", ink: "#16172F", volt: "#3242E6", ok: "#9BE8B4", danger: "#FF7A59",
  dim: "rgba(240,238,228,.62)", faint: "rgba(240,238,228,.4)", line: "rgba(240,238,228,.12)" };
export const GRAD = `linear-gradient(96deg, #FFF7B8 0%, ${C.hot} 30%, ${C.glow} 62%, #C9B210 100%)`;

// ── time: 136 BPM, bar = 16 steps; the composer reads the same bar map (events.json) ──
export const BAR = 240 / EV.bpm;
export const T = (bar: number, step = 0) => bar * BAR + step * (BAR / 16);
export const TOTAL = EV.total_bars * BAR;

export const ease = Easing.bezier(0.16, 1, 0.3, 1);
export const inOut = Easing.bezier(0.65, 0, 0.35, 1);
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const full: React.CSSProperties = { position: "absolute", inset: 0, overflow: "hidden" };
export const useT = () => { const f = useCurrentFrame(); const { fps } = useVideoConfig(); return f / fps; };
export const lerp = (t: number, a: number, b: number, x: number, y: number, e = ease) => interpolate(t, [a, b], [x, y], { ...clamp, easing: e });
export const lin = (t: number, a: number, b: number, x: number, y: number) => interpolate(t, [a, b], [x, y], clamp);
export const pop = (t: number, at: number, damping = 11, stiffness = 170) => spring({ frame: Math.round((t - at) * 60), fps: 60, config: { damping, stiffness, mass: 0.7 } });
export const hit = (t: number, a: number, k = 7) => (t >= a ? Math.exp(-(t - a) * k) : 0);
export const fade = (t: number, a: number, z = 1e9, fi = 0.25, fo = 0.25): React.CSSProperties => {
  const i = lerp(t, a, a + fi, 0, 1), o = lerp(t, z - fo, z, 0, 1, inOut);
  return { opacity: i * (1 - o), filter: i < 0.99 || o > 0.01 ? `blur(${(1 - i) * 12 + o * 16}px)` : undefined };
};
/** keyframes [time, value...] → eased value */
export const kf = (t: number, keys: number[][], i: number, e = inOut) => interpolate(t, keys.map((k) => k[0]), keys.map((k) => k[i]), { ...clamp, easing: e });

export const Mono: React.FC<{ children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }> = ({ children, size = 24, color = C.dim, style }) =>
  <div style={{ fontFamily: MONO, fontSize: size, color, whiteSpace: "nowrap", ...style }}>{children}</div>;
/** Centres its children on the line y; `style` (transforms, fades, flex direction) applies to the inner box. */
export const Centre: React.FC<{ y?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ y = 540, children, style }) =>
  <div style={{ position: "absolute", left: 0, right: 0, top: y, transform: "translateY(-50%)", display: "flex", justifyContent: "center" }}>
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", ...style }}>{children}</div></div>;

// ── the light: the site's grainy sodium aurora, a band of soft yellow chunks along a slow S-curve ──
export const Aurora: React.FC<{ y?: number; rot?: number; flood?: number; o?: number; cool?: boolean }> = ({ y = 0, rot = -18, flood = 0, o = 1, cool }) => {
  const t = useT(), dx = noise2D("ax", t * 0.12, 0) * 160, dy = noise2D("ay", 0, t * 0.12) * 90, w = noise2D("aw", t * 0.1, 5) * 0.12;
  const [c0, c1, c2, c3] = cool ? ["#DCE0FF", "#8E99FF", C.volt, "#1C2499"] : ["#FFFBD6", C.hot, C.glow, "#8C7B06"];
  const H = 540 * (1 + flood * 3.2), SEG = 9, SW = 1500;
  const layer = (h: number, bg: string, op = 1) => <>{Array.from({ length: SEG }, (_, i) => { const x = (i - (SEG - 1) / 2) * 620, wy = 150 * (1 - flood) * Math.sin(i * 0.85 + t * 0.25 + 1);
    return <div key={i} style={{ position: "absolute", left: x - SW / 2, top: wy - h / 2, width: SW, height: h, background: bg, opacity: op }} />; })}</>;
  return <div style={{ ...full, opacity: o }}>
    <div style={{ position: "absolute", left: 960 + dx, top: 540 + y + dy, width: 0, height: 0, transform: `rotate(${rot + w * 8}deg)`, filter: "blur(34px)" }}>
      {layer(H * 2.2, `radial-gradient(ellipse 50% 50% at 50% 50%, ${c3}99 0%, ${c3}33 40%, rgba(0,0,0,0) 70%)`)}
      {layer(H, `radial-gradient(ellipse 50% 50% at 50% 50%, ${c0} 0%, ${c1} 20%, ${c2} 40%, ${c3} 58%, rgba(0,0,0,0) 72%)`)}
      {layer(H * 0.36, `radial-gradient(ellipse 50% 50% at 50% 50%, ${C.void} 0%, ${C.void} 40%, ${C.void}00 72%)`, 1 - flood)}
    </div>
  </div>;
};
/** The site's other light: a single glowing orb (halo) that drifts. */
export const Orb: React.FC<{ x: number; y: number; r: number; o?: number; seed?: string; color?: string }> = ({ x, y, r, o = 1, seed = "o", color = C.glow }) => {
  const t = useT(), dx = noise2D(seed, t * 0.15, 0) * 40, dy = noise2D(seed, 0, t * 0.15) * 30;
  return <div style={{ position: "absolute", left: x + dx - r, top: y + dy - r, width: r * 2, height: r * 2, borderRadius: "50%", opacity: o,
    background: `radial-gradient(circle at 50% 50%, ${C.hot} 0%, ${color} 38%, ${color}55 56%, rgba(0,0,0,0) 70%)`, filter: "blur(18px)" }} />;
};
/** Film grain + vignette, like the site's body::after grain. */
export const Finish: React.FC = () => { const f = useCurrentFrame();
  return <>
    <div style={{ ...full, pointerEvents: "none", background: "radial-gradient(ellipse at 50% 46%, transparent 55%, rgba(0,0,0,.62) 100%)" }} />
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: 0.075, mixBlendMode: "screen", pointerEvents: "none" }}>
      <filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={f % 30} /></filter><rect width="100%" height="100%" filter="url(#g)" /></svg>
  </>; };

/** A scene: warm black, the aurora, and a camera that never rests (push + slow 3D float). */
export const Frame: React.FC<{ a: number; z: number; ay?: number; arot?: number; ao?: number; flood?: number; push?: number; cool?: boolean; bg?: string; children: React.ReactNode }> =
  ({ a, z, ay = 0, arot, ao = 1, flood = 0, push = 0.05, cool, bg = C.void, children }) => {
    const t = useT(), s = 1 + push * 1.6 * lin(t, a, z, 0, 1), rx = noise2D(`rx${a}`, t * 0.45, 0) * 1.8, ry = noise2D(`ry${a}`, 0, t * 0.45) * 2.4, dx = noise2D(`dx${a}`, t * 0.3, 3) * 12;
    return <div style={{ ...full, background: bg }}>{ao > 0 && <Aurora y={ay} rot={arot} o={ao} flood={flood} cool={cool} />}
      <div style={{ ...full, perspective: 2200 }}><div style={{ ...full, transform: `translateX(${dx}px) scale(${s}) rotateX(${rx}deg) rotateY(${ry}deg)` }}>{children}</div></div></div>;
  };

/** A word lands giant, then shrinks in place to a line. */
export const Giant: React.FC<{ word: string; at: number; shrink?: number; big?: number; small?: number; acc?: boolean; y?: number; hold?: number; color?: string; weight?: number }> =
  ({ word, at, shrink, big = 420, small = 96, acc, y = 540, hold, color = C.core, weight = 600 }) => {
    const t = useT(), p = pop(t, at - 0.06, 12, 240), sh = shrink === undefined ? 0 : lerp(t, shrink, shrink + 0.32, 0, 1, inOut), size = interpolate(sh, [0, 1], [big, small]);
    const o = Math.min(1, p * 1.5) * (hold === undefined ? 1 : 1 - lerp(t, hold - 0.12, hold - 0.02, 0, 1)), bl = sh > 0 && sh < 1 ? (1 - Math.abs(sh - 0.5) * 2) * 10 : 0;
    if (t < at - 0.06 || (hold !== undefined && t > hold)) return null;
    return <div style={{ position: "absolute", left: 0, right: 0, top: y, transform: `translateY(-50%) scale(${0.8 + 0.2 * p})`, textAlign: "center", fontFamily: SANS, fontWeight: weight, fontSize: size, letterSpacing: "-0.05em", lineHeight: 1.1, whiteSpace: "nowrap",
      color, opacity: o, filter: bl > 0.5 || p < 0.9 ? `blur(${bl + (1 - Math.min(1, p)) * 12}px)` : undefined,
      ...(acc ? { backgroundImage: `linear-gradient(${100 + sh * 160 + t * 20}deg, #FFFBD6 0%, ${C.hot} 35%, ${C.glow} 65%, #B39E0A 100%)`, WebkitBackgroundClip: "text", color: "transparent", paddingBottom: "0.08em" } : {}) }}>{word}</div>;
  };

/** Words drop one at a time; consecutive `pill` words share one yellow highlighter wiped in from the left. */
export const Drop: React.FC<{ words: string[]; at: number; gap?: number; size: number; color?: string; pill?: number[]; weight?: number }> = ({ words, at, gap = 0.09, size, color = C.core, pill = [], weight = 500 }) => {
  const t = useT(), groups: number[][] = [];
  words.forEach((_, i) => { const on = pill.includes(i), last = groups[groups.length - 1]; if (on && last && pill.includes(last[last.length - 1]) && last[last.length - 1] === i - 1) last.push(i); else groups.push([i]); });
  const word = (i: number, on: boolean) => { const a = at + i * gap, p = pop(t, a, 13, 260), o = lerp(t, a, a + 0.12, 0, 1);
    return <span key={i} style={{ position: "relative", display: "inline-block", fontFamily: SANS, fontWeight: weight, fontSize: size, letterSpacing: "-0.04em", lineHeight: 1.12, color: on ? C.ink : color, opacity: o,
      transform: `translateY(${(1 - p) * size * 0.35}px)`, filter: o < 0.99 ? `blur(${(1 - o) * 10}px)` : undefined }}>{words[i]}</span>; };
  return <span style={{ display: "inline-flex", gap: size * 0.24, alignItems: "baseline", whiteSpace: "nowrap" }}>{groups.map((g) => {
    if (!pill.includes(g[0])) return word(g[0], false);
    const a = at + g[0] * gap, wp = lerp(t, a + 0.1, a + 0.1 + 0.16 * g.length, 0, 1, inOut);
    return <span key={`g${g[0]}`} style={{ position: "relative", display: "inline-flex", gap: size * 0.24, padding: `0 ${size * 0.18}px` }}>
      <span style={{ position: "absolute", left: 0, right: 0, top: "6%", bottom: "-2%", borderRadius: size * 0.2, background: GRAD, transformOrigin: "0 50%", transform: `scaleX(${wp})`, boxShadow: `0 0 ${size * 0.6}px rgba(243,223,29,${0.35 * wp})` }} />
      {g.map((i) => word(i, true))}</span>; })}</span>;
};

/** The narrator: one thin line at a fixed place; each sentence blurs in word by word and blurs out before the next. */
export const Narrator: React.FC<{ lines: [number, number, string, string[]?][]; y?: number; size?: number }> = ({ lines, y = 940, size = 46 }) => {
  const t = useT(), cur = lines.find(([a, z]) => t >= a - 0.08 && t < z);
  if (!cur) return null;
  const [a, z, text, hl = []] = cur, out = lerp(t, z - 0.28, z, 0, 1, inOut), ws = text.split(" ");
  return <Centre y={y} style={{ opacity: 1 - out, filter: out > 0.01 ? `blur(${out * 14}px)` : undefined }}>
    <div style={{ display: "flex", gap: size * 0.26, fontFamily: SANS, fontWeight: 300, fontSize: size, letterSpacing: "-0.02em", color: C.core, textShadow: "0 2px 30px rgba(0,0,0,.7)" }}>
      {ws.map((w, i) => { const at = a + i * 0.075, p = lerp(t, at, at + 0.42, 0, 1), on = hl.includes(w.replace(/[.,?!:]/g, ""));
        return <span key={i} style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * 14}px)`, filter: p < 0.99 ? `blur(${(1 - p) * 16}px)` : undefined, color: on ? C.glow : undefined, fontWeight: on ? 500 : 300 }}>{w}</span>; })}
    </div></Centre>;
};

// ── the four people (portraits from video/characters) ──
export const PEOPLE = {
  maya: { name: "Maya", role: "tenant", img: "char/Maya_Tenant.png", color: C.glow, ink: C.ink },
  raj: { name: "Raj", role: "landlord", img: "char/Raj_Landlord.png", color: C.core, ink: C.ink },
  leo: { name: "Leo", role: "new tenant", img: "char/Leo_Replacement_Tenant.png", color: C.ok, ink: C.ink },
  priya: { name: "Priya", role: "arbiter", img: "char/Priya_Neutral_Arbiter.png", color: "#8E99FF", ink: C.ink },
} as const;
export type Who = keyof typeof PEOPLE;
export const Avatar: React.FC<{ who: Who; size: number; ring?: boolean; style?: React.CSSProperties; glow?: number }> = ({ who, size, ring = true, style, glow = 0 }) => {
  const P = PEOPLE[who];
  return <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flex: "none", background: C.void,
    boxShadow: `${ring ? `0 0 0 ${Math.max(2, size * 0.03)}px ${P.color},` : ""} 0 ${size * 0.12}px ${size * 0.35}px rgba(0,0,0,.55), 0 0 ${size * 0.6 * glow}px ${P.color}`, ...style }}>
    <Img src={staticFile(P.img)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>;
};
export const NameTag: React.FC<{ who: Who; size?: number; style?: React.CSSProperties }> = ({ who, size = 26, style }) => {
  const P = PEOPLE[who];
  return <div style={{ display: "inline-flex", alignItems: "center", gap: size * 0.4, padding: `${size * 0.22}px ${size * 0.7}px ${size * 0.22}px ${size * 0.22}px`, borderRadius: 999, background: P.color, whiteSpace: "nowrap", boxShadow: "0 10px 30px rgba(0,0,0,.4)", ...style }}>
    <Avatar who={who} size={size * 1.6} ring={false} /><span style={{ fontFamily: SANS, fontSize: size, fontWeight: 600, color: P.ink, letterSpacing: "-0.02em" }}>{P.name}<span style={{ fontWeight: 400, opacity: 0.7 }}> · {P.role}</span></span></div>;
};
/** A person as a cursor: the arrow, with their face and name riding beside it. */
export const PersonCursor: React.FC<{ who: Who; x: number; y: number; press?: boolean; o?: number; scale?: number }> = ({ who, x, y, press, o = 1, scale = 1 }) => {
  const P = PEOPLE[who];
  return <div style={{ position: "absolute", left: x, top: y, opacity: o, transform: `scale(${scale})`, transformOrigin: "0 0", zIndex: 20, pointerEvents: "none" }}>
    <svg width={46} height={46} viewBox="0 0 24 24" style={{ position: "absolute", left: -6, top: -4, transform: `scale(${press ? 0.82 : 1})`, transformOrigin: "6px 4px", filter: "drop-shadow(0 8px 12px rgba(0,0,0,.5))" }}>
      <path d="M4 2l15 11.5-6.6.8 3.9 7.6-3 1.5-3.9-7.7L4 20z" fill={P.color} stroke="#0B0A06" strokeWidth={1.3} strokeLinejoin="round" /></svg>
    <div style={{ position: "absolute", left: 30, top: 34 }}><NameTag who={who} size={22} /></div>
  </div>;
};
/** Click ripple at a point. */
export const Ripple: React.FC<{ x: number; y: number; at: number; color?: string }> = ({ x, y, at, color = C.glow }) => {
  const t = useT(), u = (t - at) / 0.55;
  if (u < 0 || u > 1) return null;
  return <div style={{ position: "absolute", left: x - 34, top: y - 34, width: 68, height: 68, borderRadius: "50%", border: `4px solid ${color}`, opacity: 1 - u, transform: `scale(${1 + u * 2.4})`, pointerEvents: "none", zIndex: 19 }} />;
};

// ── the recorded product: frames of the real UI in a browser window ──
type Shot = { frames: number; marks: Record<string, number>; boxes: Record<string, number[]> };
export const SHOTS = CAP as unknown as Record<string, Shot>;
export const capSrc = (shot: string, i: number) => staticFile(`cap/${shot}/${String(Math.max(1, Math.min(SHOTS[shot].frames, Math.round(i)))).padStart(4, "0")}.jpg`);
/** frame index from keys [time, frame]: holds each frame (no tweening between screenshots) */
export const frameAt = (t: number, keys: [number, number][]) => Math.floor(interpolate(t, keys.map((k) => k[0]), keys.map((k) => k[1]), clamp) + 1e-6);
export const mark = (shot: string, k: string) => { const v = SHOTS[shot].marks[k]; if (v === undefined) throw new Error(`no mark ${shot}:${k}`); return v; };
/** centre of a recorded box, in the 1280×720 page space */
export const bc = (shot: string, k: string): [number, number] => { const b = SHOTS[shot].boxes[k]; if (!b) throw new Error(`no box ${shot}:${k}`); return [b[0] + b[2] / 2, b[1] + b[3] / 2]; };

export const WIN = { x: 160, y: 70, w: 1600 }; // the window's content is 1280×720 page px drawn at w/1280
export const K = WIN.w / 1280, BARH = 46;
/** page px → frame px inside the window */
export const px = (p: [number, number]): [number, number] => [WIN.x + p[0] * K, WIN.y + BARH + p[1] * K];

export const Browser: React.FC<{ src: string; url: string; o?: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({ src, url, o = 1, style, children }) =>
  <div style={{ position: "absolute", left: WIN.x, top: WIN.y, width: WIN.w, height: BARH + 720 * K, borderRadius: 22, overflow: "hidden", opacity: o, background: "#141310",
    boxShadow: "0 60px 140px rgba(0,0,0,.75), 0 0 0 1.5px rgba(240,238,228,.12), 0 0 120px rgba(243,223,29,.08)", ...style }}>
    <div style={{ height: BARH, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", background: "#1A1915", borderBottom: "1px solid rgba(240,238,228,.08)" }}>
      {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c, opacity: 0.85 }} />)}
      <div style={{ marginLeft: 120, flex: 1, maxWidth: 820, height: 30, borderRadius: 15, background: "rgba(240,238,228,.07)", display: "flex", alignItems: "center", gap: 10, padding: "0 16px", fontFamily: MONO, fontSize: 17, color: C.dim }}>
        <svg width={14} height={14} viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0110 0v3M5 11h14v10H5z" fill="none" stroke="rgba(240,238,228,.6)" strokeWidth={2} /></svg>{url}</div>
    </div>
    <Img src={src} style={{ display: "block", width: WIN.w, height: 720 * K }} />
    {children}
  </div>;

// ── the lease NFT exactly as the contract draws it (contract/src/nft.rs `token`) ──
export const NFT_STAGES = {
  locked: ["Deposit locked", C.glow, C.ink], claim: ["Move-out claim", C.core, C.ink], dispute: ["In dispute", C.volt, C.core], closed: ["Closed", C.ink, C.glow],
} as const;
export type Stage = keyof typeof NFT_STAGES;
export const NftArt: React.FC<{ stage: Stage; size: number }> = ({ stage, size }) => {
  const [label, fill, ink] = NFT_STAGES[stage];
  return <svg width={size} height={size} viewBox="0 0 400 400" style={{ display: "block" }}>
    <rect width="400" height="400" fill="#0b0a06" /><circle cx="200" cy="170" r="150" fill={fill} />
    <text x="200" y="120" textAnchor="middle" fontFamily="sans-serif" fontSize="22" fill={ink}>FairNest lease</text>
    <text x="200" y="190" textAnchor="middle" fontFamily="sans-serif" fontSize="64" fontWeight="700" fill={ink}>#0</text>
    <text x="200" y="240" textAnchor="middle" fontFamily="sans-serif" fontSize="24" fill={ink}>1500 USDC</text>
    <text x="200" y="370" textAnchor="middle" fontFamily="monospace" fontSize="22" fill="#f0eee4">{label}</text></svg>;
};
/** The NFT as a physical card: rounded, glassy edge, a glow in its stage colour. */
export const NftCard: React.FC<{ stage: Stage; size: number; style?: React.CSSProperties; glow?: number }> = ({ stage, size, style, glow = 1 }) =>
  <div style={{ width: size, height: size * 1.16, borderRadius: size * 0.08, background: "linear-gradient(160deg, #24221B, #0E0D09)", padding: size * 0.05, boxSizing: "border-box",
    boxShadow: `0 ${size * 0.12}px ${size * 0.3}px rgba(0,0,0,.6), inset 0 0 0 1.5px rgba(240,238,228,.16), 0 0 ${size * 0.5 * glow}px ${NFT_STAGES[stage][1]}66`, ...style }}>
    <div style={{ borderRadius: size * 0.05, overflow: "hidden" }}><NftArt stage={stage} size={size * 0.9} /></div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: size * 0.03, fontFamily: MONO, fontSize: size * 0.05, color: C.dim }}>
      <span>NEP-171 · token 0</span><span style={{ color: NFT_STAGES[stage][1] === C.ink ? C.glow : NFT_STAGES[stage][1] }}>●</span></div>
  </div>;

/** The FairNest mark (frontend/src/components/mark.tsx): two rounded beams form a roof over the deposit. `draw` 0→1 builds it. */
export const Mark: React.FC<{ size: number; color?: string; draw?: number; dot?: number }> = ({ size, color = C.glow, draw = 1, dot = 1 }) => {
  const a = Math.min(1, draw * 2), b = Math.max(0, Math.min(1, draw * 2 - 1));
  return <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={{ overflow: "visible" }}>
    <g transform="rotate(-38 3 17)"><rect x="3" y="17" width={26 * a} height="10" rx="5" fill={color} opacity={a > 0 ? 1 : 0} /></g>
    <g transform="rotate(38 22.5 1)"><rect x="22.5" y="1" width={26 * b} height="10" rx="5" fill={color} opacity={b > 0 ? 1 : 0} /></g>
    <circle cx="24" cy="36" r={7 * dot} fill={color} />
  </svg>;
};
export const NearMark: React.FC<{ size: number; color?: string }> = ({ size, color = C.core }) =>
  <svg width={size} height={size} viewBox="0 0 27 28"><path fill={color} d="m 24.079,0.690475 c -0.9891,0 -1.9075,0.511145 -2.4256,1.351425 l -5.5825,8.261 c -0.1819,0.2723 -0.1081,0.6393 0.1651,0.8206 0.2214,0.1471 0.5143,0.1289 0.716,-0.044 l 5.495,-4.75049 c 0.0913,-0.0819 0.232,-0.07356 0.3142,0.01744 0.0373,0.04171 0.0571,0.09556 0.0571,0.15092 V 21.3707 c 0,0.1228 -0.0997,0.2214 -0.223,0.2214 -0.0662,0 -0.1285,-0.0288 -0.1704,-0.0796 L 5.81436,1.69457 C 5.27339,1.05829 4.47904,0.691234 3.64284,0.690475 H 3.0623 C 1.4911,0.690475 0.217407,1.96 0.217407,3.52605 V 24.4739 c 0,1.5661 1.273693,2.8356 2.844893,2.8356 0.98913,0 1.9075,-0.5111 2.42565,-1.3514 l 5.58255,-8.261 c 0.1818,-0.2723 0.108,-0.6393 -0.1652,-0.8206 -0.2214,-0.1471 -0.5143,-0.1289 -0.7159,0.044 L 4.69436,21.671 C 4.60306,21.7529 4.4623,21.7445 4.38013,21.6535 4.34284,21.6118 4.32306,21.558 4.32382,21.5026 V 6.62554 c 0,-0.12286 0.09967,-0.22145 0.22293,-0.22145 0.06544,0 0.12859,0.02882 0.17044,0.07963 L 21.3255,26.3054 c 0.5409,0.6363 1.3353,1.0034 2.1715,1.0041 h 0.5805 c 1.5712,8e-4 2.8457,-1.268 2.8472,-2.834 V 3.52605 C 26.9247,1.96 25.651,0.690475 24.0798,0.690475 Z" /></svg>;

export const Count: React.FC<{ from: number; to: number; a: number; b: number; style?: React.CSSProperties; fmt?: (v: number) => string }> = ({ from, to, a, b, style, fmt = (v) => Math.round(v).toLocaleString("en-US") }) => {
  const t = useT(); return <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>{fmt(interpolate(t, [a, b], [from, to], { ...clamp, easing: inOut }))}</span>;
};
