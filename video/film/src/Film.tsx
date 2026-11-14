import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useVideoConfig } from "remotion";
import { noise2D } from "@remotion/noise";
import {
  BAR, T, TOTAL, C, GRAD, SANS, MONO, clamp, inOut, ease, full, lerp, lin, pop, hit, fade, kf, useT,
  Mono, Centre, Aurora, Orb, Finish, Frame, Giant, Drop, Narrator, Avatar, NameTag, PersonCursor, Ripple, PEOPLE, type Who,
  SHOTS, capSrc, frameAt, mark, bc, px, WIN, K, BARH, Browser, NftCard, NftArt, type Stage, Mark, NearMark, Count,
} from "./kit";

// FairNest · "Held by the rules" (3:07). Giant words that shrink, the product under a cursor, zoom-throughs,
// chapter verbs and an orbit that collapses into the mark, in FairNest's own light: warm black, sodium yellow, cream.
// The product scenes are frames of the FairNest UI showing lease #0 on fairnest-leases.testnet.
// The people are the four portraits from video/characters, used as named cursors. Timing: src/events.json (136 BPM, 16 steps a bar).
export const FILM = { total: TOTAL, music: "bed.wav" };

const URL_APP = "fairnest.adoranto737.workers.dev";
const U = (p: string) => `${URL_APP}${p}`;

// ═════════════════════════════════════════════════════════════════════════════
// The product scene: recorded frames in the browser, a named cursor, a camera that follows the work.
// cur/cam keys are [time, pageX, pageY(, scale)] in the 1280×720 page space; px() maps them into the frame.
type ScreenProps = {
  shot: string; url: string; a: number; z: number; frames: [number, number][]; who?: Who;
  cur?: [number, number, number][]; clicks?: number[]; cam?: [number, number, number, number][]; enter?: boolean; ao?: number; note?: string; children?: React.ReactNode; dim?: number;
};
const Screen: React.FC<ScreenProps> = ({ shot, url, a, z, frames, who, cur, clicks = [], cam, enter = false, ao = 0.75, note, children, dim = 0 }) => {
  const t = useT(), i = frameAt(t, frames);
  const land = enter ? lerp(t, a - 0.04, a + 0.75, 0, 1, inOut) : 1;
  const ck = cam ?? [[a, 1, 640, 340]], cs = kf(t, ck.map((k) => [k[0], k[1]]), 1), fp = px([kf(t, ck.map((k) => [k[0], k[2]]), 1), kf(t, ck.map((k) => [k[0], k[3]]), 1)]);
  const F = [interpolate(cs, [1, 1.6], [960, fp[0]], { extrapolateRight: "extend" }), interpolate(cs, [1, 1.6], [541, fp[1]], { extrapolateRight: "extend" })];
  const cp = cur ? px([kf(t, cur.map((k) => [k[0], k[1]]), 1), kf(t, cur.map((k) => [k[0], k[2]]), 1)]) : null;
  const curOn = cur && t >= cur[0][0] - 0.05 && t <= z;
  const press = clicks.some((c) => t >= c - 0.05 && t < c + 0.12);
  return <Frame a={a} z={z} ao={ao} ay={interpolate(t, [a, z], [-200, 220], clamp)} push={0.03}>
    <div style={{ ...full, perspective: 1900 }}>
      <div style={{ ...full, transform: `translateY(${(1 - land) * 420}px) rotateX(${(1 - land) * 22}deg) scale(${1 - (1 - land) * 0.12})`, transformOrigin: "50% 80%", opacity: Math.min(1, 0.45 + land * 1.4) }}>
        <div style={{ ...full, transformOrigin: "0 0", transform: `translate(960px, 541px) scale(${cs}) translate(${-F[0]}px, ${-F[1]}px)` }}>
          <Browser src={capSrc(shot, i)} url={url} />
          {dim > 0 && <div style={{ position: "absolute", left: WIN.x, top: WIN.y, width: WIN.w, height: BARH + 720 * K, borderRadius: 22, background: `rgba(11,10,6,${dim})` }} />}
          {clicks.map((c, k) => { const p = cur ? px([kf(c, cur.map((q) => [q[0], q[1]]), 1), kf(c, cur.map((q) => [q[0], q[2]]), 1)]) : [0, 0]; return <Ripple key={k} x={p[0]} y={p[1]} at={c} color={who ? PEOPLE[who].color : C.glow} />; })}
          {curOn && cp && who && <PersonCursor who={who} x={cp[0]} y={cp[1]} press={press} scale={1 / Math.sqrt(cs)} o={Math.min(1, lerp(t, cur![0][0] - 0.05, cur![0][0] + 0.2, 0, 1))} />}
          {children}
        </div>
      </div>
    </div>
    {note && <Mono size={19} color="rgba(240,238,228,.45)" style={{ position: "absolute", left: 56, bottom: 30 }}>{note}</Mono>}
  </Frame>;
};
const B = (shot: string, k: string): [number, number] => bc(shot, k);
const NOTE = "lease #0 · fairnest-leases.testnet · recorded from its real transactions";

// ═════════════════════════════════════════════════════════════════════════════
// 1 · bars 0–4 · the hook: the keys, then "Your / deposit. / Their / decision."
const Hook: React.FC = () => {
  const t = useT(), photo = lerp(t, 0, 0.6, 0, 1), back = lerp(t, T(1) - 0.1, T(1, 3), 0, 1, inOut);
  return <Frame a={0} z={T(4)} ao={lin(t, 0, T(1), 0.25, 1)} ay={interpolate(t, [0, T(4)], [-320, 240], clamp)} push={0.04}>
    <div style={{ position: "absolute", left: 960 - 560, top: 540 - 330, width: 1120, height: 660, borderRadius: 34, overflow: "hidden", opacity: photo * (1 - back * 0.72),
      transform: `scale(${(1.0 + lin(t, 0, T(4), 0, 0.08)) * (1 - back * 0.18)})`, filter: back > 0.01 ? `blur(${back * 14}px)` : undefined, boxShadow: "0 50px 140px rgba(0,0,0,.7)" }}>
      <Img src={staticFile("img/keys.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "sepia(.35) saturate(.8) brightness(.72)", transform: `scale(${1.1 + lin(t, 0, T(4), 0, 0.12)})` }} />
      <div style={{ ...full, background: "linear-gradient(180deg, rgba(11,10,6,0) 40%, rgba(11,10,6,.75))" }} />
      <Mono size={22} color="rgba(240,238,228,.7)" style={{ position: "absolute", left: 40, bottom: 30, ...fade(t, 0.3) }}>Move-in day · 1 Main St, Apt 4</Mono>
    </div>
    <Giant word="Your" at={T(1, 0)} shrink={T(1, 4)} hold={T(1, 8)} />
    <Giant word="deposit." at={T(1, 8)} shrink={T(1, 12)} hold={T(2, 0)} acc />
    <Giant word="Their" at={T(2, 0)} shrink={T(2, 4)} hold={T(2, 8)} />
    <Giant word="decision." at={T(2, 8)} shrink={T(2, 12)} hold={T(3, 0)} />
    {t >= T(3) - 0.07 && <Centre y={540} style={{ opacity: 1 - lerp(t, T(4) - 0.25, T(4), 0, 1) }}><Drop words={["Your", "deposit.", "Their", "decision."]} at={T(3) - 0.07} size={104} pill={[2, 3]} weight={600} /></Centre>}
  </Frame>;
};

// ═════════════════════════════════════════════════════════════════════════════
// 2 · bars 4–16 · the problem, told by objects: the deposit leaves, deductions print, days pass, the fight
const Coin: React.FC<{ x: number; y: number; s: number; label?: string; o?: number }> = ({ x, y, s, label = "1,500", o = 1 }) =>
  <div style={{ position: "absolute", left: x - s / 2, top: y - s / 2, width: s, height: s, borderRadius: "50%", opacity: o, display: "grid", placeItems: "center",
    background: `radial-gradient(circle at 35% 30%, #FFFBD6 0%, ${C.hot} 25%, ${C.glow} 60%, #B39E0A 100%)`, boxShadow: `0 0 ${s * 0.7}px rgba(243,223,29,.55), 0 ${s * 0.1}px ${s * 0.3}px rgba(0,0,0,.5)` }}>
    <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: s * 0.24, color: C.ink, letterSpacing: "-0.04em" }}>{label}</span></div>;

const Problem: React.FC = () => {
  const t = useT();
  // P1 · bars 4–7: the deposit leaves the tenant and lands in the landlord's account
  const p1 = t < T(7);
  const fly = lerp(t, T(5, 4), T(6, 0), 0, 1, inOut), coinX = interpolate(fly, [0, 1], [560, 1340]), coinY = interpolate(fly, [0, 1], [430, 470]) - Math.sin(fly * Math.PI) * 220;
  const cardIn = pop(t, T(4, 12), 12, 170), locked = t >= T(6, 0);
  // P2 · bars 7–10: deductions print on a receipt nobody can check
  const ROWS: [string, number][] = [["Cleaning", 250], ["Carpet", 400], ["Repainting", 300], ["Admin fee", 150]];
  const rowAt = (i: number) => T(7, 8) + i * BAR * 0.5, kept = ROWS.reduce((s, r, i) => s - (t >= rowAt(i) + 0.1 ? r[1] : 0), 1500);
  // P3 · bars 10–13: the days pass
  const day = Math.min(90, Math.max(1, Math.floor(lin(t, T(10, 4), T(12, 8), 1, 90.99))));
  // P4 · bars 13–16: the fight
  const p4 = t >= T(13) - 0.3;
  return <Frame a={T(4)} z={T(16)} ay={interpolate(t, [T(4), T(16)], [260, -260], clamp)} ao={0.55} push={0.03}>
    {p1 && <div style={{ ...full, opacity: 1 - lerp(t, T(7) - 0.25, T(7), 0, 1) }}>
      <div style={{ position: "absolute", left: 420, top: 300, transform: `scale(${pop(t, T(4) - 0.05, 12, 170)})` }}><Avatar who="maya" size={260} glow={0.4} /></div>
      <div style={{ position: "absolute", left: 400, top: 590, ...fade(t, T(4, 4)) }}><NameTag who="maya" size={28} /></div>
      <div style={{ position: "absolute", left: 1180, top: 300, transform: `scale(${pop(t, T(4, 6), 12, 170)})` }}><Avatar who="raj" size={260} /></div>
      <div style={{ position: "absolute", left: 1160, top: 590, ...fade(t, T(4, 10)) }}><NameTag who="raj" size={28} /></div>
      {/* the landlord's account */}
      <div style={{ position: "absolute", left: 1120, top: 690, width: 400, height: 150, borderRadius: 22, padding: "22px 26px", boxSizing: "border-box", background: "linear-gradient(135deg, #22233F, #16172F)", boxShadow: "0 30px 80px rgba(0,0,0,.6), inset 0 0 0 1px rgba(240,238,228,.12)",
        opacity: Math.min(1, cardIn * 1.4), transform: `translateY(${(1 - cardIn) * 60}px) scale(${1 + 0.06 * hit(t, T(6, 0), 8)})` }}>
        <Mono size={18} color="rgba(240,238,228,.55)">Landlord&apos;s account</Mono>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 14 }}><span style={{ fontFamily: SANS, fontSize: 52, fontWeight: 600, color: C.core, letterSpacing: "-0.04em" }}>{locked ? "+1,500" : "0"}</span>
          {locked && <span style={{ fontFamily: SANS, fontSize: 22, color: C.glow, ...fade(t, T(6, 0)) }}>deposit received</span>}</div>
      </div>
      {t >= T(4, 8) && <Coin x={coinX} y={coinY + (t >= T(6) ? lerp(t, T(6), T(6, 4), 0, 300, inOut) : 0)} s={150 * pop(t, T(4, 8), 11, 200) * (t >= T(6) ? 1 - lerp(t, T(6), T(6, 4), 0, 1, inOut) : 1)} />}
    </div>}
    {t >= T(7) - 0.3 && t < T(10) && <div style={{ ...full, opacity: lerp(t, T(7) - 0.3, T(7), 0, 1) * (1 - lerp(t, T(10) - 0.25, T(10), 0, 1)) }}>
      <div style={{ position: "absolute", left: 300, top: 330 }}><Avatar who="maya" size={220} /></div>
      <div style={{ position: "absolute", left: 300, top: 580, width: 220, textAlign: "center", fontFamily: SANS, fontSize: 120, fontWeight: 600, color: C.glow, transform: `scale(${pop(t, T(9, 8), 10, 200)})` }}>?</div>
      <div style={{ position: "absolute", left: 760, top: 150, width: 560, borderRadius: 18, background: "#F4F1E6", padding: "34px 40px 30px", boxShadow: "0 50px 120px rgba(0,0,0,.6)",
        transform: `rotate(${-2 + noise2D("rc", t * 0.4, 0) * 1.5}deg) translateY(${(1 - pop(t, T(7) - 0.05, 12, 160)) * 300}px)` }}>
        <Mono size={18} color="#7A766A">MOVE-OUT STATEMENT</Mono>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 14, paddingBottom: 18, borderBottom: "2px dashed rgba(22,23,47,.18)" }}>
          <span style={{ fontFamily: SANS, fontSize: 30, color: C.ink }}>Deposit back</span>
          <span style={{ fontFamily: SANS, fontSize: 64, fontWeight: 600, color: C.ink, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>{kept.toLocaleString("en-US")}</span></div>
        {ROWS.map(([r, v], i) => { const p = lerp(t, rowAt(i), rowAt(i) + 0.15, 0, 1);
          return <div key={r} style={{ display: "flex", justifyContent: "space-between", height: 62, alignItems: "center", fontFamily: MONO, fontSize: 30, color: C.ink, opacity: p, transform: `translateX(${(1 - p) * -30}px)` }}>
            <span>{r}</span><span style={{ color: "#C2452B" }}>−{v}</span></div>; })}
        <div style={{ marginTop: 18, height: 120, borderRadius: 14, border: "3px dashed rgba(22,23,47,.25)", display: "grid", placeItems: "center", fontFamily: SANS, fontSize: 24, color: "#7A766A", ...fade(t, T(9, 4)) }}>no photos attached</div>
      </div>
    </div>}
    {t >= T(10) - 0.3 && t < T(13) && <div style={{ ...full, opacity: lerp(t, T(10) - 0.3, T(10), 0, 1) * (1 - lerp(t, T(13) - 0.25, T(13), 0, 1)) }}>
      <div style={{ position: "absolute", left: 300, top: 220, display: "grid", gridTemplateColumns: "repeat(15, 44px)", gap: 14 }}>
        {Array.from({ length: 90 }, (_, k) => { const on = k < day; return <div key={k} style={{ width: 44, height: 44, borderRadius: 12, background: on ? (k < 14 ? "rgba(243,223,29,.85)" : "rgba(240,238,228,.18)") : "rgba(240,238,228,.05)", boxShadow: on && k === day - 1 ? "0 0 30px rgba(243,223,29,.8)" : undefined, transform: `scale(${k === day - 1 ? 1.15 : 1})` }} />; })}
      </div>
      <div style={{ position: "absolute", left: 1290, top: 230, fontFamily: SANS }}>
        <div style={{ fontSize: 30, color: C.dim }}>Day</div>
        <div style={{ fontSize: 210, fontWeight: 600, color: C.core, letterSpacing: "-0.06em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{day}</div>
        <div style={{ marginTop: 26, display: "inline-flex", alignItems: "center", gap: 12, padding: "10px 22px", borderRadius: 999, border: "1.5px solid rgba(240,238,228,.2)", fontSize: 26, color: C.core }}>
          <span style={{ width: 12, height: 12, borderRadius: 6, background: C.glow, opacity: 0.4 + 0.6 * Math.abs(Math.sin(t * 4)) }} />{t < T(12, 8) ? "Refund pending" : "Still waiting"}</div>
      </div>
      <Mono size={20} color="rgba(240,238,228,.45)" style={{ position: "absolute", left: 300, top: 640 }}>the first 14 days: when many tenants expect it back</Mono>
    </div>}
    {p4 && <div style={{ ...full, opacity: lerp(t, T(13) - 0.3, T(13), 0, 1) * (1 - lerp(t, T(16) - 0.2, T(16), 0, 1)) }}>
      {/* the tenant's only appeal: court, months */}
      <div style={{ position: "absolute", left: 360, top: 200, opacity: 1 - lerp(t, T(14, 6), T(14, 10), 0, 0.75), transform: `scale(${1 - lerp(t, T(14, 6), T(14, 12), 0, 0.15)})` }}>
        {[0, 1, 2].map((k) => <div key={k} style={{ position: "absolute", left: k * 26, top: k * -22, width: 420, height: 520, borderRadius: 16, background: k === 2 ? "#F4F1E6" : `rgba(244,241,230,${0.35 + k * 0.2})`, boxShadow: "0 30px 80px rgba(0,0,0,.5)", transform: `rotate(${(k - 1) * 4 + noise2D(`f${k}`, t * 0.5, 0)}deg) translateY(${(1 - pop(t, T(13) + k * 0.15, 12, 170)) * 300}px)` }}>
          {k === 2 && <div style={{ padding: "36px 38px" }}><Mono size={18} color="#7A766A">SMALL CLAIMS · FORM</Mono>
            {Array.from({ length: 8 }, (_, j) => <div key={j} style={{ height: 12, marginTop: 24, width: `${45 + 45 * Math.abs(Math.sin(j * 1.9))}%`, borderRadius: 6, background: "rgba(22,23,47,.14)" }} />)}
            <div style={{ marginTop: 36, fontFamily: SANS, fontSize: 30, fontWeight: 600, color: C.ink }}>Hearing in <Count from={2} to={14} a={T(13, 4)} b={T(14, 4)} /> weeks</div></div>}</div>)}
      </div>
      {/* the landlord's side */}
      <div style={{ position: "absolute", left: 1120, top: 250, transform: `scale(${pop(t, T(14, 8), 12, 170)})` }}><Avatar who="raj" size={260} /></div>
      {t >= T(14, 12) && <div style={{ position: "absolute", left: 760, top: 610, padding: "26px 34px", borderRadius: "30px 30px 30px 6px", background: C.core, color: C.ink, fontFamily: SANS, fontSize: 38, fontWeight: 500, letterSpacing: "-0.03em", boxShadow: "0 30px 80px rgba(0,0,0,.5)",
        transform: `scale(${pop(t, T(14, 12), 12, 200)})`, transformOrigin: "0 100%" }}>“It was like that when I moved in.”</div>}
    </div>}
    <Narrator lines={[
      [T(4), T(7), "You hand over the keys, and a month's rent.", ["rent."]],
      [T(7), T(10), "At move-out, they decide what comes back.", ["they", "decide"]],
      [T(10), T(13), "And when. If it comes back at all.", ["when."]],
      [T(13), T(14, 8), "Disagree? Small-claims court. Months.", ["Months."]],
      [T(14, 8), T(16), "And landlords lose out too.", ["landlords"]],
    ]} />
  </Frame>;
};

// ═════════════════════════════════════════════════════════════════════════════
// 3 · bars 16–18 · "What if nobody held it?" · the question mark's dot becomes the light
const Question: React.FC = () => {
  const t = useT(), grow = lerp(t, T(17, 8), T(18) + 0.02, 0, 1, Easing2), q = t >= T(17, 4);
  return <Frame a={T(16)} z={T(18)} ao={0.35} ay={-120} push={0.02}>
    <div style={full}>
      <Giant word="What if" at={T(16, 0)} shrink={T(16, 4)} hold={T(16, 8)} big={340} />
      <Giant word="nobody" at={T(16, 8)} shrink={T(16, 12)} hold={T(17, 0)} big={380} acc />
      <Giant word="held it?" at={T(17, 0)} shrink={T(17, 3)} hold={T(17, 4)} big={340} />
      {q && <Centre y={540}><span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 104, letterSpacing: "-0.05em", color: C.core }}>
        What if <span style={{ backgroundImage: GRAD, WebkitBackgroundClip: "text", color: "transparent" }}>nobody</span> held it<span style={{ position: "relative", color: C.core }}>?
          {t >= T(17, 8) && <span style={{ position: "absolute", left: "0.205em", top: "0.81em", width: "0.17em", height: "0.17em", marginLeft: "-0.085em", marginTop: "-0.085em", borderRadius: "50%",
            background: `radial-gradient(circle, ${C.hot} 0%, ${C.glow} 60%)`, boxShadow: `0 0 ${20 + 80 * grow}px ${C.glow}`, transform: `scale(${1 + grow * 260})` }} />}</span></span></Centre>}
    </div>
  </Frame>;
};
const Easing2 = (x: number) => x * x * x;

// ═════════════════════════════════════════════════════════════════════════════
// 4 · bars 18–24 · the mark builds on yellow, the light contracts into its dot, the drop: FairNest
const Reveal: React.FC = () => {
  const t = useT(), draw = lerp(t, T(18, 1), T(18, 12), 0, 1, inOut), shrinkR = lerp(t, T(19, 0), T(19, 12), 1, 0, inOut);
  const R = interpolate(shrinkR, [0, 1], [0, 1500]), letters = Math.max(0, Math.min(8, Math.floor((t - T(19, 6)) * 14)));
  const drop = t >= T(20), flare = hit(t, T(20), 5);
  const lock = drop ? lerp(t, T(21, 4), T(21, 14), 0, 1, inOut) : 0;  // the lockup rises to make room for the window
  const win = lerp(t, T(21, 10), T(22, 6), 0, 1, inOut), zoom = lerp(t, T(23, 1), T(24), 0, 1, (x) => x * x * x), cta = px(B("landing", "cta"));
  const ccx = kf(t, [[T(22, 6), 1700], [T(22, 14), cta[0] - 4]], 1), ccy = kf(t, [[T(22, 6), 1060], [T(22, 14), cta[1] + 2]], 1);
  return <Frame a={T(18)} z={T(24)} ao={drop ? 1 : lin(t, T(19), T(20), 0, 0.8)} flood={flare * 0.25} ay={interpolate(t, [T(19), T(24)], [260, -160], clamp)} push={0.02}>
    {/* the yellow field (contracting into the mark's dot) */}
    {t < T(19, 13) && <div style={{ position: "absolute", left: 960 - R, top: 560 - R, width: 2 * R, height: 2 * R, borderRadius: "50%", background: C.glow, boxShadow: `0 0 200px ${C.glow}` }} />}
    {t < T(19, 13) && t >= T(19) - 0.1 && <div style={{ position: "absolute", left: 960 - R * 1.4, top: 560 - R * 1.4, width: 2.8 * R, height: 2.8 * R, borderRadius: "50%", background: `radial-gradient(circle, rgba(243,223,29,.35), rgba(243,223,29,0) 70%)` }} />}
    <div style={{ ...full, opacity: 1 - Math.min(1, zoom * 2), transform: `translateY(${-lock * 300}px) scale(${1 - lock * 0.45})` }}>
      <Centre y={460} style={{ gap: 40 * Math.min(1, letters / 2), transform: `scale(${(drop ? 1 + 0.06 * flare : 1) * (t < T(19) ? 1.4 + 0.22 * lin(t, T(18), T(19), 0, 1) : interpolate(shrinkR, [0, 1], [1, 1.62]))}) rotate(${t < T(19) ? noise2D("mk", t * 0.8, 0) * 3 : 0}deg)` }}>
        <Mark size={300} color={t < T(19, 6) ? C.ink : C.glow} draw={draw} dot={t < T(18, 12) ? lerp(t, T(18, 8), T(18, 12), 0, 1) : 1 + 0.12 * Math.max(0, Math.sin((t - T(18, 12)) / (BAR / 4) * Math.PI)) * (t < T(20) ? 1 : 0)} />
        {letters > 0 && <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 230, letterSpacing: "-0.055em", color: C.core, display: "flex", overflow: "hidden", paddingBottom: 20 }}>
          {"FairNest".split("").map((ch, k) => <span key={k} style={{ display: "inline-block", opacity: k < letters ? 1 : 0, transform: `translateY(${k < letters ? 0 : 50}%)` }}>{ch}</span>)}</span>}
      </Centre>
      {drop && <Centre y={760} style={{ flexDirection: "column", gap: 18, opacity: 1 - lock }}>
        <Drop words={["Your", "rent", "deposit,", "held", "by", "a", "contract"]} at={T(20, 2)} size={66} pill={[5, 6]} weight={400} />
        <Drop words={["instead", "of", "your", "landlord."]} at={T(20, 10)} size={66} weight={400} /></Centre>}
      {drop && <Centre y={950} style={{ gap: 14, ...fade(t, T(21)) }}><NearMark size={34} /><Mono size={26} color={C.core}>built on NEAR</Mono></Centre>}
    </div>
    {/* the site itself, then a click on "Open the app" and the zoom through the yellow button */}
    {t >= T(21, 10) && <div style={{ ...full, perspective: 1800 }}>
      <div style={{ ...full, transform: `translateY(${(1 - win) * 700}px) rotateX(${(1 - win) * 26}deg)`, transformOrigin: "50% 100%" }}>
        <div style={{ ...full, transform: `scale(${1 + zoom * 30})`, transformOrigin: `${cta[0]}px ${cta[1]}px`, filter: zoom > 0.25 ? `blur(${(zoom - 0.25) * 30}px)` : undefined }}>
          <Browser src={capSrc("landing", 1)} url={URL_APP} />
          {t >= T(22, 6) && <Ripple x={cta[0]} y={cta[1]} at={T(23, 0)} />}
          {t >= T(22, 6) && t < T(23, 6) && <svg width={58} height={58} viewBox="0 0 24 24" style={{ position: "absolute", left: ccx, top: ccy, transform: `scale(${t >= T(23) - 0.05 && t < T(23) + 0.12 ? 0.82 : 1})`, transformOrigin: "0 0", filter: "drop-shadow(0 8px 14px rgba(0,0,0,.5))" }}>
            <path d="M4 2l15 11.5-6.6.8 3.9 7.6-3 1.5-3.9-7.7L4 20z" fill="#fff" stroke="#111" strokeWidth={1.3} strokeLinejoin="round" /></svg>}
        </div>
      </div>
    </div>}
    {zoom > 0.5 && <div style={{ ...full, background: C.glow, opacity: lerp(t, T(23, 10), T(24), 0, 0.62), mixBlendMode: "screen" }} />}
  </Frame>;
};

// ═════════════════════════════════════════════════════════════════════════════
// Chapter card: a verb lands giant, shrinks, and its line drops beneath it.
const Chapter: React.FC<{ a: number; z: number; word: string; line: string[]; pill: number[]; lineAt: number; ay?: number; cool?: boolean; children?: React.ReactNode }> = ({ a, z, word, line, pill, lineAt, ay = 0, cool, children }) => {
  const t = useT(), out = lerp(t, z - 0.22, z, 0, 1);
  return <Frame a={a} z={z} ay={interpolate(t, [a, z], [ay - 260, ay + 200], clamp)} push={0.03} cool={cool}>
    <div style={{ ...full, opacity: 1 - out, filter: out > 0.01 ? `blur(${out * 12}px)` : undefined }}>
      <Giant word={word} at={a} shrink={a + BAR / 2} big={460} small={150} y={470} acc />
      {t >= lineAt - 0.07 && <Centre y={640}><Drop words={line} at={lineAt - 0.07} size={78} pill={pill} /></Centre>}
      {children}
    </div>
  </Frame>;
};

// ═════════════════════════════════════════════════════════════════════════════
// 5 · bars 24–32 · Lock: Raj creates the lease, Maya locks the deposit, the NFT is minted to her
const LockA: React.FC = () => <Chapter a={T(24)} z={T(25, 8)} word="Lock" line={["the", "deposit", "in", "a", "contract."]} pill={[3, 4]} lineAt={T(24, 10)} />;
const LockB: React.FC = () => {
  const ty = B("create", "tenant"), ar = B("create", "arbiter"), cr = B("create", "create");
  return <Screen shot="create" url={U("/new")} a={T(25, 8)} z={T(28, 12)} who="raj" enter note={NOTE}
    frames={[[T(25, 8), 1], [T(26, 2), 2], [T(26, 4), mark("create", "tenant:start")], [T(26, 14), mark("create", "tenant:end")], [T(27, 0), mark("create", "arbiter:start")], [T(27, 8), mark("create", "arbiter:end")],
      [T(27, 10), 38], [T(27, 11), mark("create", "terms:start")], [T(28, 2), mark("create", "terms:end")], [T(28, 4), mark("create", "create")], [T(28, 8) + 0.1, mark("create", "create")], [T(28, 9), 56]]}
    cur={[[T(25, 12), 1100, 700], [T(26, 2), ty[0] - 200, ty[1] + 4], [T(26, 14), ty[0] - 200, ty[1] + 4], [T(27, 0), ar[0] - 180, ar[1] + 4], [T(28, 2), ar[0] - 180, ar[1] + 4], [T(28, 6), cr[0], cr[1]], [T(28, 12), cr[0] + 30, cr[1] + 20]]}
    clicks={[T(26, 2), T(27, 0), T(28, 8)]}
    cam={[[T(25, 8), 1, 640, 340], [T(26, 2), 1.4, 420, 420], [T(27, 8), 1.4, 420, 470], [T(28, 2), 1.15, 420, 380], [T(28, 10), 1, 640, 340]]} />;
};
const LockC: React.FC = () => {
  const d = B("fund", "deposit"), n = B("fund", "nft");
  return <Screen shot="fund" url={U("/lease?id=0")} a={T(28, 12)} z={T(30, 8)} who="maya" note={NOTE}
    frames={[[T(28, 12), 1], [T(29, 8) + 0.1, mark("fund", "deposit")], [T(29, 10), 6]]}
    cur={[[T(28, 13), 300, 700], [T(29, 6), d[0], d[1]], [T(29, 12), d[0] + 10, d[1] + 10], [T(30, 4), n[0] - 20, n[1] + 50]]}
    clicks={[T(29, 8)]}
    cam={[[T(28, 12), 1.1, 400, 330], [T(29, 8), 1.25, 300, 420], [T(29, 12), 1.25, 600, 330], [T(30, 4), 1.8, n[0], n[1]]]} />;
};
const LockD: React.FC = () => {
  const t = useT(), n = px(B("fund", "nft")), lift = lerp(t, T(30, 8), T(31, 4), 0, 1, inOut);
  const x = interpolate(lift, [0, 1], [n[0] - 60, 1150]), y = interpolate(lift, [0, 1], [n[1] - 70, 230]), s = interpolate(lift, [0, 1], [150, 470]), spin = lift * 360;
  return <Frame a={T(30, 8)} z={T(33)} ay={interpolate(t, [T(30, 8), T(33)], [200, -240], clamp)} push={0.03}>
    <div style={{ ...full, opacity: 1 - lerp(t, T(30, 8), T(31), 0, 1), filter: `blur(${lerp(t, T(30, 8), T(31), 0, 18)}px)` }}><Browser src={capSrc("fund", 6)} url={U("/lease?id=0")} /></div>
    <div style={{ position: "absolute", left: 360, top: 330, transform: `scale(${pop(t, T(31, 0), 12, 170)})` }}><Avatar who="maya" size={300} glow={lerp(t, T(31, 8), T(32), 0, 1)} /></div>
    <div style={{ position: "absolute", left: 370, top: 660, ...fade(t, T(31, 4)) }}><NameTag who="maya" size={28} /></div>
    {/* the light beam from the token to its holder */}
    {t >= T(31, 4) && <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}><path d={`M ${1150 + 30} ${470} Q 900 ${330} ${640} ${480}`} fill="none" stroke={C.glow} strokeWidth={6} strokeLinecap="round"
      strokeDasharray={900} strokeDashoffset={900 * (1 - lerp(t, T(31, 4), T(31, 12), 0, 1))} style={{ filter: `drop-shadow(0 0 14px ${C.glow})` }} opacity={0.85} /></svg>}
    <div style={{ position: "absolute", left: x, top: y, perspective: 1200 }}><div style={{ transform: `rotateY(${spin}deg) rotateX(${noise2D("nx", t * 0.6, 0) * 6}deg)` }}><NftCard stage="locked" size={s} glow={lift} /></div></div>
    <Centre y={900} style={{ flexDirection: "column", gap: 14 }}>
      {t >= T(31, 0) - 0.07 && <Drop words={["Funding", "mints", "a", "lease", "NFT."]} at={T(31, 0) - 0.07} size={60} pill={[3, 4]} />}
      {t >= T(32, 0) && <div style={{ ...fade(t, T(32, 0)) }}><Mono size={26} color={C.core}>Whoever holds it is the tenant.</Mono></div>}
    </Centre>
  </Frame>;
};

// ═════════════════════════════════════════════════════════════════════════════
// 6 · bars 33–41 · Hand over: Raj approves Leo, Maya hands the NFT on, her vault access ends
const HandA: React.FC = () => {
  const t = useT();
  return <Frame a={T(33)} z={T(34, 8)} ay={-200} push={0.04}>
    <div style={{ position: "absolute", left: 960 - 520, top: 120, width: 1040, height: 585, borderRadius: 30, overflow: "hidden", opacity: 0.55 * lerp(t, T(33) - 0.05, T(33, 3), 0, 1), boxShadow: "0 50px 120px rgba(0,0,0,.6)" }}>
      <Img src={staticFile("img/moving.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "sepia(.3) brightness(.7)", transform: `scale(${1.05 + lin(t, T(33), T(34, 8), 0, 0.08)})` }} /></div>
    <Centre y={330}><Drop words={["Moving", "out", "early?"]} at={T(33) - 0.07} size={84} weight={600} /></Centre>
    {t >= T(33, 8) - 0.06 && <Giant word="Hand it on." at={T(33, 8)} shrink={T(33, 14)} big={300} small={120} y={640} acc />}
    <div style={{ position: "absolute", left: 240, top: 760, transform: `scale(${pop(t, T(33, 4), 12, 170)})` }}><NameTag who="maya" size={30} /></div>
    <div style={{ position: "absolute", left: 1400, top: 760, transform: `scale(${pop(t, T(34, 0), 12, 170)})` }}><NameTag who="leo" size={30} /></div>
  </Frame>;
};
const HandB: React.FC = () => {
  const w = B("approve", "who"), ap = B("approve", "approve");
  return <Screen shot="approve" url={U("/lease?id=0")} a={T(34, 8)} z={T(36, 4)} who="raj" enter note={NOTE}
    frames={[[T(34, 8), 1], [T(35, 0), mark("approve", "who:start")], [T(35, 10), mark("approve", "who:end")], [T(35, 12), mark("approve", "approve")], [T(35, 14) + 0.1, mark("approve", "approve")], [T(36, 0), 17]]}
    cur={[[T(34, 10), 1200, 760], [T(34, 15), w[0] - 120, w[1] + 4], [T(35, 10), w[0] - 120, w[1] + 4], [T(35, 13), ap[0], ap[1]], [T(36, 4), ap[0] + 20, ap[1] + 30]]}
    clicks={[T(34, 15), T(35, 14)]}
    cam={[[T(34, 8), 1, 640, 340], [T(35, 0), 1.55, 960, 480], [T(36, 4), 1.55, 960, 520]]} />;
};
const HandC: React.FC = () => {
  const h = B("handover", "hand"), hs = B("handover", "holders"), wn = B("handover", "warn");
  return <Screen shot="handover" url={U("/lease?id=0")} a={T(36, 4)} z={T(38, 4)} who="maya" note={NOTE}
    frames={[[T(36, 4), 1], [T(36, 12), mark("handover", "hand")], [T(37, 0) + 0.1, mark("handover", "hand")], [T(37, 2), 5], [T(37, 10), 7]]}
    cur={[[T(36, 5), 900, 700], [T(36, 12), h[0], h[1]], [T(37, 4), h[0] + 10, h[1] + 30], [T(37, 10), wn[0] + 200, wn[1] + 60]]}
    clicks={[T(37, 0)]}
    cam={[[T(36, 4), 1.5, 960, 380], [T(37, 0), 1.5, 960, 400], [T(37, 4), 1.6, hs[0], hs[1]], [T(37, 9), 1.6, hs[0], hs[1]], [T(37, 11), 1.35, wn[0], wn[1]], [T(38, 4), 1.4, wn[0], wn[1]]]} />;
};
const HandD: React.FC = () => {
  const t = useT(), go = lerp(t, T(38, 8), T(39, 4), 0, 1, inOut), x = interpolate(go, [0, 1], [560, 1270]), y = 330 - Math.sin(go * Math.PI) * 170, glowL = lerp(t, T(39, 2), T(39, 8), 0, 1);
  return <Frame a={T(38, 4)} z={T(40)} ay={180} push={0.04}>
    <div style={{ position: "absolute", left: 230, top: 330, opacity: 1 - 0.55 * go, filter: `grayscale(${go})`, transform: `scale(${pop(t, T(38, 4), 12, 170)})` }}><Avatar who="maya" size={280} /></div>
    <div style={{ position: "absolute", left: 1410, top: 330, transform: `scale(${pop(t, T(38, 6), 12, 170) * (1 + 0.06 * hit(t, T(39, 4), 7))})` }}><Avatar who="leo" size={280} glow={glowL} /></div>
    <div style={{ position: "absolute", left: 250, top: 640, ...fade(t, T(38, 6)) }}><Mono size={24} color={C.dim}>Maya · held it</Mono></div>
    <div style={{ position: "absolute", left: 1440, top: 640, ...fade(t, T(39, 4)) }}><Mono size={24} color={C.ok}>Leo · holds it now</Mono></div>
    {Array.from({ length: 14 }, (_, k) => { const g = Math.max(0, go - k * 0.025), xx = interpolate(g, [0, 1], [560, 1270]), yy = 330 - Math.sin(g * Math.PI) * 170;
      return <div key={k} style={{ position: "absolute", left: xx + 120, top: yy + 150, width: 22 - k, height: 22 - k, borderRadius: "50%", background: C.glow, opacity: go > 0 && go < 1 ? 0.5 * (1 - k / 14) : 0, filter: "blur(2px)" }} />; })}
    <div style={{ position: "absolute", left: x, top: y, perspective: 1000 }}><div style={{ transform: `rotateZ(${Math.sin(go * Math.PI) * -8}deg) rotateY(${go * 360}deg)` }}><NftCard stage="locked" size={250} /></div></div>
    <Centre y={880} style={{ flexDirection: "column", gap: 10 }}>
      <Drop words={["The", "refund,", "the", "rights,", "the", "vault:"]} at={T(38, 8)} size={58} />
      {t >= T(39, 4) - 0.07 && <Drop words={["all", "of", "it", "moves", "with", "the", "NFT."]} at={T(39, 4) - 0.07} size={58} pill={[3, 4, 5, 6]} />}
    </Centre>
  </Frame>;
};
const HandE: React.FC = () => {
  const u = B("vault", "unlock"), e = B("vault", "error");
  return <Screen shot="vault" url={U("/vault?id=0")} a={T(40)} z={T(41, 4)} who="maya" enter note="the vault Worker reads the NFT holder from the chain on every request"
    frames={[[T(40), 1], [T(40, 6), mark("vault", "unlock")], [T(40, 8) + 0.1, mark("vault", "unlock")], [T(40, 10), 6]]}
    cur={[[T(40, 1), 700, 600], [T(40, 6), u[0], u[1]], [T(41, 4), u[0] + 20, u[1] + 30]]}
    clicks={[T(40, 8)]}
    cam={[[T(40), 1, 640, 340], [T(40, 6), 1.4, 380, 420], [T(40, 12), 1.9, e[0], e[1]], [T(41, 4), 2.0, e[0], e[1]]]} />;
};

// ═════════════════════════════════════════════════════════════════════════════
// 7 · bar 41 · "Then, move-out day." · the card turns to the claim stage
const MoveOut: React.FC = () => {
  const t = useT(), flip = lerp(t, T(41, 6), T(41, 12), 0, 1, inOut);
  return <Frame a={T(41, 4)} z={T(42)} ay={-60} push={0.06}>
    <Centre y={330}><Drop words={["Then,", "move-out", "day."]} at={T(41, 4) - 0.05} size={80} weight={600} /></Centre>
    <div style={{ position: "absolute", left: 960 - 160, top: 470, perspective: 1000 }}><div style={{ transform: `rotateY(${flip * 180}deg)` }}>
      <div style={{ transform: flip > 0.5 ? "rotateY(180deg)" : undefined }}><NftCard stage={flip > 0.5 ? "claim" : "locked"} size={320} /></div></div></div>
  </Frame>;
};

// ═════════════════════════════════════════════════════════════════════════════
// 8 · bars 42–48 · Claim: Raj itemises two deductions with evidence
const ClaimA: React.FC = () => <Chapter a={T(42)} z={T(44)} word="Claim" line={["line", "by", "line,", "with", "evidence."]} pill={[3, 4]} lineAt={T(42, 12)} />;
const ClaimB: React.FC = () => {
  const r1 = B("claim", "r1"), a1 = B("claim", "a1"), ad = B("claim", "add"), r2 = B("claim", "r2"), a2 = B("claim", "a2"), fl = B("claim", "file"), dl = B("claim", "deadline");
  return <Screen shot="claim" url={U("/lease?id=0")} a={T(44)} z={T(47, 8)} who="raj" enter note={NOTE}
    frames={[[T(44), 1], [T(44, 4), 2], [T(44, 5), mark("claim", "r1:start")], [T(44, 14), mark("claim", "r1:end")], [T(45, 0), mark("claim", "a1:start")], [T(45, 2), mark("claim", "a1:end")], [T(45, 3), 17],
      [T(45, 6), mark("claim", "add")], [T(45, 8), 19], [T(45, 9), mark("claim", "r2:start")], [T(46, 0), mark("claim", "r2:end")], [T(46, 1), mark("claim", "a2:start")], [T(46, 3), mark("claim", "a2:end")], [T(46, 4), 32],
      [T(46, 6), mark("claim", "file")], [T(46, 10) + 0.1, mark("claim", "file")], [T(46, 12), 34], [T(46, 15), 35]]}
    cur={[[T(44, 1), 1100, 700], [T(44, 4), r1[0] - 100, r1[1] + 4], [T(44, 15), a1[0], a1[1] + 4], [T(45, 3), a1[0], a1[1] + 4], [T(45, 6), ad[0], ad[1]], [T(45, 8), r2[0] - 100, r2[1] + 4], [T(46, 0), a2[0], a2[1] + 4], [T(46, 4), a2[0], a2[1] + 4], [T(46, 8), fl[0], fl[1]], [T(47, 8), fl[0] + 30, fl[1] + 40]]}
    clicks={[T(44, 4), T(45, 0), T(45, 6), T(45, 8), T(46, 1), T(46, 10)]}
    cam={[[T(44), 1, 640, 340], [T(44, 4), 1.45, 420, 260], [T(45, 4), 1.45, 420, 300], [T(45, 8), 1.45, 420, 560], [T(46, 4), 1.4, 420, 520], [T(46, 8), 1.2, 520, 380], [T(46, 14), 1.55, dl[0], dl[1] + 80], [T(47, 8), 1.6, dl[0], dl[1] + 70]]} />;
};

// ═════════════════════════════════════════════════════════════════════════════
// 9 · bars 48–54 · Dispute: Leo disputes only the carpet; the rest pays out at once
const DisputeA: React.FC = () => <Chapter a={T(47, 8)} z={T(49, 8)} word="Dispute" line={["only", "what's", "wrong."]} pill={[1, 2]} lineAt={T(48, 8)} />;
const DisputeB: React.FC = () => {
  const tk = B("dispute", "tick"), wy = B("dispute", "why"), dp = B("dispute", "dispute"), sp = B("dispute", "split");
  return <Screen shot="dispute" url={U("/lease?id=0")} a={T(49, 8)} z={T(52, 4)} who="leo" enter note={NOTE}
    frames={[[T(49, 8), 1], [T(50, 0) + 0.1, mark("dispute", "tick")], [T(50, 1), 4], [T(50, 4), mark("dispute", "why:start")], [T(51, 2), mark("dispute", "why:end")], [T(51, 6), mark("dispute", "dispute")], [T(51, 8) + 0.1, mark("dispute", "dispute")], [T(51, 10), 25], [T(51, 14), 27]]}
    cur={[[T(49, 9), 1000, 700], [T(49, 15), tk[0], tk[1]], [T(50, 3), wy[0] - 120, wy[1] + 4], [T(51, 2), wy[0] - 120, wy[1] + 4], [T(51, 6), dp[0], dp[1]], [T(51, 12), dp[0] + 10, dp[1] + 20], [T(52, 4), sp[0] - 150, sp[1] + 60]]}
    clicks={[T(50, 0), T(50, 3), T(51, 8)]}
    cam={[[T(49, 8), 1, 640, 340], [T(49, 14), 1.55, 420, 380], [T(50, 3), 1.45, 420, 560], [T(51, 6), 1.4, 420, 580], [T(51, 10), 1.2, 640, 380], [T(51, 14), 1.75, sp[0], sp[1]], [T(52, 4), 1.8, sp[0], sp[1]]]} />;
};
/** A wide split bar of the 1,500: what is paid now, what waits for the arbiter. */
const SplitViz: React.FC<{ a: number; z: number; parts: { v: number; color: string; label: string; who?: Who; held?: boolean }[]; title: string[]; pill: number[]; foot?: string }> = ({ a, z, parts, title, pill, foot }) => {
  const t = useT(), W = 1500, X0 = 210;
  let acc = 0;
  return <Frame a={a} z={z} ay={-160} push={0.04}>
    <Centre y={250}><Drop words={title} at={a - 0.06} size={72} pill={pill} weight={600} /></Centre>
    {parts.map((p, k) => { const at = a + 0.25 + k * BAR / 4, g = lerp(t, at, at + 0.5, 0, 1, inOut), x = X0 + (acc / 1500) * W, w = (p.v / 1500) * W * g; acc += p.v;
      return <React.Fragment key={k}>
        <div style={{ position: "absolute", left: x + 4, top: 470, width: Math.max(0, w - 8), height: 130, borderRadius: 22, background: p.held ? `repeating-linear-gradient(135deg, ${p.color}, ${p.color} 16px, ${p.color}bb 16px, ${p.color}bb 32px)` : p.color,
          boxShadow: `0 0 ${50 * g}px ${p.color}66`, transform: `scaleY(${0.6 + 0.4 * g})` }} />
        <div style={{ position: "absolute", left: x + 10, top: 630, width: (p.v / 1500) * W - 20, opacity: g, transform: `translateY(${(1 - g) * 20}px)` }}>
          <div style={{ fontFamily: SANS, fontSize: 64, fontWeight: 600, color: C.core, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}><Count from={0} to={p.v} a={at} b={at + 0.6} /></div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>{p.who && <Avatar who={p.who} size={46} />}<Mono size={22} color={p.held ? "#B9C0FF" : C.dim} style={{ whiteSpace: "normal" }}>{p.label}</Mono></div>
        </div></React.Fragment>; })}
    {foot && <Centre y={930} style={{ ...fade(t, a + BAR) }}><Mono size={26} color={C.core}>{foot}</Mono></Centre>}
  </Frame>;
};
const DisputeC: React.FC = () => <SplitViz a={T(52, 4)} z={T(54)} title={["Paid", "out", "now.", "Only", "400", "waits."]} pill={[3, 4, 5]}
  parts={[{ v: 200, color: C.core, label: "Raj · cleaning", who: "raj" }, { v: 900, color: C.ok, label: "Leo · the unclaimed rest", who: "leo" }, { v: 400, color: C.volt, label: "carpet · held for the arbiter", held: true }]} />;

// ═════════════════════════════════════════════════════════════════════════════
// 10 · bars 54–60 · Rule: Priya rules on the disputed 400 only
const RuleA: React.FC = () => <Chapter a={T(54)} z={T(55, 12)} word="Rule" line={["A", "neutral", "arbiter", "decides", "the", "rest."]} pill={[1, 2]} lineAt={T(54, 12)} />;
const RuleB: React.FC = () => {
  const aw = B("rule", "award"), nt = B("rule", "note"), sb = B("rule", "submit"), sp = B("rule", "split");
  return <Screen shot="rule" url={U("/lease?id=0")} a={T(55, 12)} z={T(58, 8)} who="priya" enter note={NOTE}
    frames={[[T(55, 12), 1], [T(56, 4), mark("rule", "award:start")], [T(56, 7), mark("rule", "award:end")], [T(56, 9), mark("rule", "note:start")], [T(57, 8), mark("rule", "note:end")], [T(57, 11), mark("rule", "submit")], [T(57, 13) + 0.1, mark("rule", "submit")], [T(57, 15), 29], [T(58, 2), 31]]}
    cur={[[T(55, 13), 1000, 700], [T(56, 3), aw[0] - 150, aw[1] + 4], [T(56, 8), nt[0] - 150, nt[1] + 4], [T(57, 8), nt[0] - 150, nt[1] + 4], [T(57, 11), sb[0], sb[1]], [T(58, 8), sb[0] + 20, sb[1] + 30]]}
    clicks={[T(56, 3), T(56, 8), T(57, 13)]}
    cam={[[T(55, 12), 1, 640, 340], [T(56, 3), 1.5, 420, 380], [T(57, 8), 1.45, 420, 440], [T(57, 14), 1.2, 640, 380], [T(58, 2), 1.75, sp[0], sp[1]], [T(58, 8), 1.8, sp[0], sp[1]]]} />;
};
const RuleC: React.FC = () => <SplitViz a={T(58, 8)} z={T(60)} title={["Settled:", "300", "to", "Raj,", "1,200", "to", "Leo."]} pill={[4, 5, 6]} foot="the arbiter can never award more than the disputed lines"
  parts={[{ v: 300, color: C.core, label: "Raj · 200 + 100 of the carpet", who: "raj" }, { v: 1200, color: C.ok, label: "Leo · 900 + 300 of the carpet", who: "leo" }]} />;

// ═════════════════════════════════════════════════════════════════════════════
// 11 · bars 60–64 · Leo withdraws; nine real transactions, all public
const PayA: React.FC = () => {
  const w = B("withdraw", "withdraw"), bl = B("withdraw", "balance");
  return <Screen shot="withdraw" url={U("/app")} a={T(60)} z={T(62)} who="leo" enter note={NOTE}
    frames={[[T(60), 1], [T(60, 8), mark("withdraw", "withdraw")], [T(60, 12) + 0.1, mark("withdraw", "withdraw")], [T(60, 14), 5]]}
    cur={[[T(60, 1), 600, 650], [T(60, 8), w[0], w[1]], [T(61, 4), w[0] + 30, w[1] + 40]]}
    clicks={[T(60, 12)]}
    cam={[[T(60), 1.2, 900, 380], [T(60, 6), 1.55, bl[0], bl[1] + 80], [T(60, 14), 1.6, bl[0], bl[1] + 50], [T(62), 1.75, bl[0], bl[1] + 30]]} />;
};
const TXS: [string, string][] = [
  ["Lease created", "6VQemHAyAXGPvcjUxLjtpb5AH98uaqn3t1cTDQtW5wBS"], ["Deposit locked · NFT minted", "A6iguWyAXeFebXhnSZ6Gz5NQLdQUZ1Kdt5XqUKFEapd8"],
  ["Replacement approved", "GJdf6DsZHdbbAiwn7aVFKR6JFyMLQSxk79HfZqhH5zRs"], ["NFT handed to Leo", "C6U749WD8ghsMqsVJSf2A4hFANCiCXiu3M76QK8qqYwB"],
  ["Deductions filed", "7whGQPhFCAyRd9Q1TFzAGwvW7RbHhswVq79EaJAXhi77"], ["Carpet disputed", "FUdqxMTEpmHFUk6zvsNyGiNWVD2QQRUtfgfXBdkyuE1Q"],
  ["Arbiter ruled", "6R1YjfpTe1YaB13kCtrtJi2aspaqnHKmK2gia2gGW5Za"], ["Leo withdrew 1,200", "Ce7GGLH15pFVwG1p1gszziDyX4agyktjvXvUYW7gGX5u"], ["Raj withdrew 300", "HPxB6rfbtj9d3cTk8y1ACx5TzH8aM7gemGD2Bw6E89YR"],
];
const PayB: React.FC = () => {
  const t = useT(), at = (i: number) => T(62, 2) + i * (BAR / 8), n = TXS.filter((_, i) => t >= at(i)).length, scroll = lerp(t, T(63, 0), T(64), 0, 110, inOut);
  return <Frame a={T(62)} z={T(64)} ay={200} push={0.05}>
    <div style={{ position: "absolute", left: 170, top: 330 }}>
      <div style={{ fontFamily: SANS, fontSize: 250, fontWeight: 600, color: C.core, letterSpacing: "-0.06em", lineHeight: 0.9, transform: `scale(${1 + 0.05 * hit(t, at(Math.max(0, n - 1)), 9)})`, transformOrigin: "0 100%" }}>{n}</div>
      <div style={{ fontFamily: SANS, fontSize: 52, fontWeight: 500, color: C.core, letterSpacing: "-0.03em", marginTop: 10 }}>transactions.</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18, ...fade(t, T(62, 6)) }}><NearMark size={34} color={C.glow} /><span style={{ fontFamily: SANS, fontSize: 40, color: C.glow }}>Every one public.</span></div>
    </div>
    <div style={{ position: "absolute", left: 860, top: 120 - scroll, width: 900 }}>
      {TXS.map(([label, h], i) => { const p = pop(t, at(i), 12, 200);
        return t < at(i) ? null : <div key={h} style={{ display: "flex", alignItems: "center", gap: 20, height: 82, marginBottom: 14, padding: "0 26px", borderRadius: 18, background: "rgba(240,238,228,.06)", border: "1px solid rgba(240,238,228,.1)",
          opacity: Math.min(1, p * 1.5), transform: `translateX(${(1 - p) * 120}px)` }}>
          <span style={{ width: 34, height: 34, borderRadius: 17, display: "grid", placeItems: "center", background: "rgba(155,232,180,.15)", color: C.ok, fontSize: 20 }}>✓</span>
          <span style={{ fontFamily: SANS, fontSize: 28, color: C.core, flex: 1 }}>{label}</span><Mono size={22} color={C.glow}>{h.slice(0, 10)}…</Mono></div>; })}
    </div>
    <Mono size={19} color="rgba(240,238,228,.45)" style={{ position: "absolute", left: 56, bottom: 30 }}>testnet.nearblocks.io · fairnest-leases.testnet · lease #0</Mono>
  </Frame>;
};

// ═════════════════════════════════════════════════════════════════════════════
// 12 · bars 64–70 · the deadlines: nobody can sit on the money
const DL: [string, string, Who, Who][] = [["Landlord files nothing", "Tenant refunded in full", "raj", "maya"], ["Tenant never answers", "The claim stands", "maya", "raj"], ["Arbiter stays silent", "Disputed sum goes to the tenant", "priya", "leo"]];
const Deadlines: React.FC = () => {
  const t = useT();
  return <Frame a={T(64)} z={T(70)} ay={-200} push={0.04}>
    <Giant word="Nobody can stall." at={T(64)} shrink={T(64, 8)} big={190} small={84} y={200} />
    {DL.map(([who, out, w0, w1], k) => { const a = T(65) + k * BAR * 1.5, p = pop(t, a - 0.05, 12, 170), ring = lerp(t, a + 0.2, a + BAR, 1, 0, (x) => x), done = t >= a + BAR, x = 150 + k * 560;
      return <div key={k} style={{ position: "absolute", left: x, top: 330, width: 500, height: 560, borderRadius: 30, background: "rgba(22,21,16,.86)", border: `1.5px solid ${done ? "rgba(243,223,29,.5)" : "rgba(240,238,228,.1)"}`, boxShadow: "0 40px 100px rgba(0,0,0,.5)",
        opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 120}px) rotate(${noise2D(`dl${k}`, t * 0.4, 0) * 1.2}deg)`, padding: 36, boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}><Avatar who={w0} size={58} /><span style={{ fontFamily: SANS, fontSize: 30, fontWeight: 500, color: C.core, letterSpacing: "-0.02em" }}>{who}</span></div>
        <svg width={210} height={210} viewBox="0 0 100 100" style={{ display: "block", margin: "34px auto 0" }}>
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(240,238,228,.1)" strokeWidth={7} />
          <circle cx="50" cy="50" r="42" fill="none" stroke={done ? C.glow : C.core} strokeWidth={7} strokeLinecap="round" strokeDasharray={264} strokeDashoffset={264 * (1 - ring)} transform="rotate(-90 50 50)" />
          <text x="50" y="57" textAnchor="middle" fontFamily={MONO} fontSize="18" fill={done ? C.glow : C.core}>{done ? "0:00" : `${Math.floor(ring * 10)}:${String(Math.floor((ring * 600) % 60)).padStart(2, "0")}`}</text></svg>
        {done && <div style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 14, justifyContent: "center", transform: `scale(${pop(t, a + BAR, 10, 220)})` }}>
          <Avatar who={w1} size={50} /><span style={{ fontFamily: SANS, fontSize: 30, fontWeight: 600, color: C.glow, letterSpacing: "-0.02em", whiteSpace: "normal", lineHeight: 1.15 }}>{out}</span></div>}
      </div>; })}
  </Frame>;
};

// ═════════════════════════════════════════════════════════════════════════════
// 13 · bars 70–84 · what it means: for tenants, for landlords, for everyone
const For: React.FC<{ a: number; z: number; who: Who; head: string; items: string[]; photo: string }> = ({ a, z, who, head, items, photo }) => {
  const t = useT(), out = lerp(t, z - 0.22, z, 0, 1);
  return <Frame a={a} z={z} ay={interpolate(t, [a, z], [220, -220], clamp)} push={0.05}>
    <div style={{ ...full, opacity: 1 - out }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 760, height: 1080, overflow: "hidden", opacity: 0.4 * lerp(t, a - 0.05, a + 0.4, 0, 1), maskImage: "linear-gradient(90deg, black 40%, transparent)", WebkitMaskImage: "linear-gradient(90deg, black 40%, transparent)" }}>
        <Img src={staticFile(photo)} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "sepia(.35) brightness(.6)", transform: `scale(${1.05 + lin(t, a, z, 0, 0.1)})` }} /></div>
      <div style={{ position: "absolute", left: 200, top: 370, transform: `scale(${pop(t, a - 0.05, 12, 170)})` }}><Avatar who={who} size={340} glow={0.5} /></div>
      <div style={{ position: "absolute", left: 760, top: 300 }}>
        <Drop words={head.split(" ")} at={a - 0.06} size={92} weight={600} pill={[head.split(" ").length - 1]} />
        <div style={{ marginTop: 50 }}>{items.map((s, k) => { const at = a + BAR * 0.5 + k * BAR * 0.75, p = pop(t, at, 12, 190);
          return <div key={k} style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 30, opacity: Math.min(1, p * 1.5), transform: `translateX(${(1 - p) * 80}px)` }}>
            <span style={{ width: 52, height: 52, borderRadius: 26, background: PEOPLE[who].color, display: "grid", placeItems: "center", flex: "none" }}><Mark size={30} color={C.ink} /></span>
            <span style={{ fontFamily: SANS, fontSize: 44, fontWeight: 400, color: C.core, letterSpacing: "-0.03em" }}>{s}</span></div>; })}</div>
      </div>
    </div>
  </Frame>;
};
const ForTenants: React.FC = () => <For a={T(70)} z={T(74)} who="maya" head="For tenants" photo="img/empty-flat.jpg"
  items={["Your deposit never sits in their account.", "Dispute line by line, not all or nothing.", "Leaving early? Hand the lease on."]} />;
const ForLandlords: React.FC = () => <For a={T(74)} z={T(78)} who="raj" head="For landlords" photo="img/keys.jpg"
  items={["Deductions backed by evidence.", "You approve who takes over.", "Undisputed lines pay out at once."]} />;
const Everyone: React.FC = () => {
  const t = useT(), tl = B("record", "timeline"), n = B("record", "nft");
  const STD: [string, string][] = [["NEP-171", "the lease is an NFT"], ["NEP-141", "stablecoin deposits"], ["NEP-413", "signed vault access"], ["NEAR accounts", "readable parties"]];
  const chips = t >= T(81, 8);
  return <>
    {!chips && <Screen shot="record" url={U("/lease?id=0")} a={T(78)} z={T(81, 8)} enter ao={0.8} note="no wallet needed · anyone can open lease #0"
      frames={[[T(78), mark("record", "top")], [T(79, 8), mark("record", "top")], [T(79, 10), mark("record", "timeline")]]}
      cam={[[T(78), 1.1, 640, 340], [T(79, 4), 1.7, n[0] + 100, n[1] + 20], [T(79, 10), 1.25, tl[0], tl[1] - 40], [T(81, 8), 1.4, tl[0], tl[1] + 60]]} />}
    {!chips && <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 170, background: "linear-gradient(180deg, rgba(11,10,6,.92), rgba(11,10,6,0))" }} />}
    {!chips && <Centre y={78}><Drop words={["For", "everyone:", "every", "step", "is", "public."]} at={T(78, 4)} size={58} pill={[4, 5]} weight={600} /></Centre>}
    {chips && <Frame a={T(81, 8)} z={T(84)} ay={140} push={0.05}>
      <Centre y={300}><NearMark size={140} color={C.core} /></Centre>
      <Centre y={470} style={{ ...fade(t, T(81, 10)) }}><span style={{ fontFamily: SANS, fontSize: 56, fontWeight: 600, color: C.core, letterSpacing: "-0.04em" }}>Built on NEAR standards</span></Centre>
      <div style={{ position: "absolute", left: 160, right: 160, top: 600, display: "flex", gap: 26, justifyContent: "center" }}>
        {STD.map(([k, v], i) => { const p = pop(t, T(82) + i * BAR / 4, 11, 200);
          return <div key={k} style={{ width: 370, padding: "28px 30px", borderRadius: 24, background: i === 0 ? C.glow : "rgba(240,238,228,.07)", border: i === 0 ? "none" : "1px solid rgba(240,238,228,.14)",
            opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 140}px) rotate(${(1 - p) * (i % 2 ? 8 : -8)}deg)` }}>
            <div style={{ fontFamily: MONO, fontSize: 34, fontWeight: 500, color: i === 0 ? C.ink : C.glow }}>{k}</div>
            <div style={{ fontFamily: SANS, fontSize: 28, color: i === 0 ? C.ink : C.core, marginTop: 10 }}>{v}</div></div>; })}
      </div>
    </Frame>}
  </>;
};

// ═════════════════════════════════════════════════════════════════════════════
// 14 · bars 84–98 · the finale: "Fair for both sides", the product in flashes, one NFT through every stage, the orbit
const Both: React.FC = () => {
  const t = useT(), meet = lerp(t, T(84, 4), T(85, 12), 0, 1, inOut);
  return <Frame a={T(84)} z={T(86)} ay={-100} push={0.06} flood={0.1 * meet}>
    <div style={{ position: "absolute", left: interpolate(meet, [0, 1], [120, 600]), top: 380 }}><Avatar who="maya" size={240} glow={meet} /></div>
    <div style={{ position: "absolute", left: interpolate(meet, [0, 1], [1560, 1080]), top: 380 }}><Avatar who="raj" size={240} glow={meet} /></div>
    <Centre y={250}><Drop words={["Fair", "for", "both", "sides."]} at={T(84) - 0.06} size={110} pill={[2, 3]} weight={600} /></Centre>
    {t >= T(85, 8) && <Centre y={830} style={{ ...fade(t, T(85, 8)) }}><Mono size={30} color={C.core}>and for whoever takes over the lease</Mono></Centre>}
  </Frame>;
};
const FLASH: [string, number, string][] = [["fund", 6, "Locked"], ["approve", 17, "Approved"], ["handover", 5, "Handed over"], ["vault", 6, "Access moved"], ["claim", 35, "Claimed"], ["dispute", 27, "Disputed"], ["rule", 31, "Ruled"], ["withdraw", 5, "Paid"]];
const Flashes: React.FC = () => {
  const t = useT(), k = Math.min(7, Math.floor((t - T(86)) / (BAR / 2))), at = T(86) + k * BAR / 2, p = pop(t, at - 0.03, 13, 230), side = k % 2 ? 1 : -1, [shot, fr, label] = FLASH[k];
  return <Frame a={T(86)} z={T(90)} ay={interpolate(t, [T(86), T(90)], [-200, 200], clamp)} flood={0.12 * hit(t, T(86), 3)} push={0.04}>
    <div style={{ ...full, perspective: 1600 }}>
      <div style={{ ...full, transform: `translateX(${(1 - p) * side * 700}px) rotateY(${(1 - p) * side * -30 + side * 6}deg) scale(${0.78 + 0.04 * lin(t, at, at + BAR / 2, 0, 1)})` }}>
        <Browser src={capSrc(shot, fr)} url={URL_APP} />
      </div>
    </div>
    <div style={{ position: "absolute", left: 0, right: 0, top: 960, textAlign: "center", transform: `scale(${0.9 + 0.1 * p})` }}>
      <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 64, letterSpacing: "-0.04em", padding: "6px 28px", borderRadius: 20, background: GRAD, color: C.ink }}>{label}</span></div>
  </Frame>;
};
const STAGES: Stage[] = ["locked", "claim", "dispute", "closed"];
const Orbit: React.FC = () => {
  const t = useT(), title = t < T(94);
  const orbit = lerp(t, T(93), T(97, 8), 0, 1, (x) => x), col = lerp(t, T(96, 4), T(97, 10), 0, 1, inOut), flood = lerp(t, T(97, 6), T(98), 0, 1, inOut);
  const ppl: Who[] = ["maya", "raj", "leo", "priya"];
  return <Frame a={T(90)} z={T(98)} ay={interpolate(t, [T(90), T(98)], [240, 0], clamp)} flood={flood} push={0.02}>
    {title && <Centre y={170} style={{ opacity: 1 - lerp(t, T(93, 8), T(94), 0, 1) }}><Drop words={["One", "NFT.", "Every", "stage", "of", "the", "lease."]} at={T(90) - 0.06} size={72} pill={[0, 1]} weight={600} /></Centre>}
    {STAGES.map((s, i) => { const p = pop(t, T(90, 4) + i * BAR / 2, 12, 180), a0 = (i / 4) * Math.PI * 2 - Math.PI / 2 + orbit * 2.6, r = interpolate(orbit, [0, 0.15, 1], [0, 330, 260]) * (1 - col);
      const rowX = 960 + (i - 1.5) * 400, x = orbit > 0 ? interpolate(lerp(t, T(93), T(93, 12), 0, 1, inOut), [0, 1], [rowX, 960 + Math.cos(a0) * r * 1.35]) : rowX, y = orbit > 0 ? interpolate(lerp(t, T(93), T(93, 12), 0, 1, inOut), [0, 1], [580, 560 + Math.sin(a0) * r * 0.85]) : 580;
      const sz = 320 * (1 - 0.75 * col) * (orbit > 0 ? interpolate(lerp(t, T(93), T(93, 12), 0, 1), [0, 1], [1, 0.62]) : 1);
      return <div key={s} style={{ position: "absolute", left: x - sz / 2, top: y - sz * 0.58, opacity: Math.min(1, p * 1.5) * (1 - col), transform: `translateY(${(1 - p) * 300}px) rotate(${(1 - p) * 20 + noise2D(`s${i}`, t * 0.5, 0) * 3}deg)` }}>
        <NftCard stage={s} size={sz} /></div>; })}
    {ppl.map((w, i) => { const a0 = (i / 4) * Math.PI * 2 + Math.PI / 4 - orbit * 2.0, r = 470 * (1 - col), p = pop(t, T(94) + i * BAR / 4, 12, 180);
      return t < T(94) ? null : <div key={w} style={{ position: "absolute", left: 960 + Math.cos(a0) * r * 1.4 - 60, top: 560 + Math.sin(a0) * r * 0.82 - 60, opacity: (1 - col) * Math.min(1, p * 1.5), transform: `scale(${p * (1 - col * 0.6)})` }}><Avatar who={w} size={120} /></div>; })}
    {t >= T(94) && <Centre y={560} style={{ transform: `scale(${pop(t, T(94), 12, 160) * (1 + 0.5 * col)})` }}><Mark size={170 + 60 * col} color={C.glow} /></Centre>}
  </Frame>;
};

// ═════════════════════════════════════════════════════════════════════════════
// 15 · bars 98–106 · the flood recedes; the end card
const End: React.FC = () => {
  const t = useT(), recede = lerp(t, T(98), T(99, 8), 1, 0, inOut), n = Math.max(0, Math.min(8, Math.floor((t - T(99, 2)) * 16))), slide = lerp(t, T(99), T(99, 10), 0, 1, inOut);
  const url = "fairnest.adoranto737.workers.dev", un = Math.max(0, Math.min(url.length, 3 + Math.floor((t - T(100, 8)) * 26))), fl = noise2D("ef", t * 0.35, 0) * 8;
  return <Frame a={T(98)} z={T(106) + 1} flood={recede} ay={interpolate(t, [T(98), T(106)], [80, -40], clamp)} ao={1 - 0.45 * lerp(t, T(100), T(102), 0, 1)} push={0.02}>
    <div style={{ ...full, transform: `translateY(${fl}px)` }}>
      <Centre y={430} style={{ gap: 44 * slide }}>
        <div style={{ transform: `scale(${1 + 0.3 * (1 - slide)})` }}><Mark size={200} color={recede > 0.5 ? C.ink : C.glow} /></div>
        {n > 0 && <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 200, letterSpacing: "-0.055em", color: C.core, display: "flex", overflow: "hidden", paddingBottom: 16 }}>
          {"FairNest".split("").map((ch, k) => <span key={k} style={{ display: "inline-block", opacity: k < n ? 1 : 0, transform: `translateY(${k < n ? 0 : 50}%)` }}>{ch}</span>)}</span>}
      </Centre>
      {t >= T(100) - 0.06 && <Centre y={640}><Drop words={["Your", "deposit,", "held", "by", "the", "rules."]} at={T(100) - 0.06} size={70} pill={[4, 5]} weight={400} /></Centre>}
      {t >= T(100, 8) && <Centre y={790} style={{ ...fade(t, T(100, 8)) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 34px", borderRadius: 999, background: "rgba(240,238,228,.08)", border: "1.5px solid rgba(240,238,228,.16)", fontFamily: MONO, fontSize: 36, color: C.core }}>
          {url.slice(0, un)}<span style={{ width: 4, height: 40, background: C.glow, opacity: un < url.length || Math.floor(t * 2.6) % 2 ? 1 : 0 }} /></div></Centre>}
      {t >= T(101, 8) && <Centre y={910} style={{ gap: 14, ...fade(t, T(101, 8)) }}><NearMark size={30} /><Mono size={26} color={C.dim}>Live on NEAR testnet</Mono></Centre>}
    </div>
  </Frame>;
};

// ═════════════════════════════════════════════════════════════════════════════
const ACTS: [number, number, React.FC][] = [
  [0, T(4), Hook], [T(4), T(16), Problem], [T(16), T(18), Question], [T(18), T(24), Reveal],
  [T(24), T(25, 8), LockA], [T(25, 8), T(28, 12), LockB], [T(28, 12), T(30, 8), LockC], [T(30, 8), T(33), LockD],
  [T(33), T(34, 8), HandA], [T(34, 8), T(36, 4), HandB], [T(36, 4), T(38, 4), HandC], [T(38, 4), T(40), HandD], [T(40), T(41, 4), HandE], [T(41, 4), T(42), MoveOut],
  [T(42), T(44), ClaimA], [T(44), T(47, 8), ClaimB], [T(47, 8), T(49, 8), DisputeA], [T(49, 8), T(52, 4), DisputeB], [T(52, 4), T(54), DisputeC],
  [T(54), T(55, 12), RuleA], [T(55, 12), T(58, 8), RuleB], [T(58, 8), T(60), RuleC], [T(60), T(62), PayA], [T(62), T(64), PayB],
  [T(64), T(70), Deadlines], [T(70), T(74), ForTenants], [T(74), T(78), ForLandlords], [T(78), T(84), Everyone],
  [T(84), T(86), Both], [T(86), T(90), Flashes], [T(90), T(98), Orbit], [T(98), 999, End],
];
export const Film: React.FC = () => {
  const { fps } = useVideoConfig(), t = useT();
  return <AbsoluteFill style={{ background: C.void }}>
    <Audio src={staticFile(FILM.music)} volume={(f) => interpolate(f / fps, [0, 0.02, FILM.total - 0.5, FILM.total], [0, 1, 1, 0], clamp)} />
    {ACTS.map(([a, z, Sc]) => t >= a && t < z ? <div key={a} style={full}><Sc /></div> : null)}
    <Finish />
  </AbsoluteFill>;
};
