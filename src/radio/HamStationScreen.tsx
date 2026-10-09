/**
 * KK6OQA's TS-2000 station view in the classic HamStation style, trimmed to
 * the essentials: Windows Classic chrome, the magenta VFO, an analog S-meter,
 * the green scope, the CW text and five buttons. Like the SDR view it is a
 * pure function of `state`, so the intro film can render it too.
 */
import type { CSSProperties, ReactNode } from "react";
import { CALLSIGN } from "./station";
import { sMeter, spectrum } from "./signal";
import type { RadioControls, RadioState } from "./PowerSdrScreen";
import "./radio.css";

const at = (x: number, y: number, w?: number, h?: number): CSSProperties => ({ position: "absolute", left: x, top: y, width: w, height: h });

function Btn({ x, y, w, h = 18, children, on, dim, onClick, style }: {
  x?: number; y?: number; w?: number; h?: number; children: ReactNode; on?: boolean; dim?: boolean; onClick?: () => void; style?: CSSProperties;
}) {
  const pos = x === undefined ? undefined : at(x, y ?? 0, w, h);
  return (
    <button type="button" className={`hs-btn${on ? " is-on" : ""}${dim ? " is-dim" : ""}`} style={{ ...pos, ...style }} onClick={onClick} tabIndex={onClick ? 0 : -1}>
      {children}
    </button>
  );
}

function Field({ x, y, w, h = 20, children, kind = "sunken", style }: { x: number; y: number; w: number; h?: number; children?: ReactNode; kind?: "sunken" | "black" | "white" | "cyan"; style?: CSSProperties }) {
  return <div className={`hs-field is-${kind}`} style={{ ...at(x, y, w, h), ...style }}>{children}</div>;
}

const longDate = (now: Date) => now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
const hms = (h: number, m: number, s: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

/** The big analog S-meter: S1-S9 in white, +10..+40 in red, a red needle. */
export function SMeterDial({ s, width, height }: { s: number; width: number; height: number }) {
  const cx = width / 2;
  const cy = height * 0.78;
  const r = width * 0.43;
  // S0 at 200°, S9 at 270° (straight up is 270° in SVG terms), +40 at 340°.
  const angleOf = (v: number) => (v <= 9 ? 198 + (v / 9) * 78 : 276 + ((v - 9) / 4) * 64) * (Math.PI / 180);
  const point = (v: number, radius: number) => ({ x: cx + Math.cos(angleOf(v)) * radius, y: cy + Math.sin(angleOf(v)) * radius });
  const needle = point(Math.min(13, Math.max(0, s)), r * 1.02);
  const over = Math.max(0, Math.round((s - 9) * 10));
  const reading = `S${String(Math.min(9, Math.max(0, Math.round(s)))).padStart(2, "0")}+${String(over).padStart(2, "0")}db`;
  const arc = (from: number, to: number) => {
    const a = point(from, r);
    const b = point(to, r);
    return `M ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y}`;
  };
  return (
    <svg className="hs-dial" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <radialGradient id="hs-dial-bg" cx="50%" cy="40%" r="75%">
          <stop offset="0" stopColor="#3a3a3a" />
          <stop offset="0.6" stopColor="#161616" />
          <stop offset="1" stopColor="#050505" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width={width} height={height} fill="url(#hs-dial-bg)" />
      <path d={arc(0.3, 9)} fill="none" stroke="#fff" strokeWidth="4" />
      <path d={arc(9, 13)} fill="none" stroke="#e01818" strokeWidth="4" />
      {Array.from({ length: 27 }, (_, i) => {
        const v = 0.3 + i * 0.5;
        const a = point(v, r);
        const b = point(v, r - (i % 2 ? 9 : 13));
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={v > 9 ? "#e01818" : "#fff"} strokeWidth="2" />;
      })}
      {[1, 3, 5, 7, 9].map((v) => {
        const p = point(v, r + 12);
        return <text key={v} x={p.x} y={p.y + 4} textAnchor="middle" className="hs-dial-num">{v}</text>;
      })}
      {[["+10", 10], ["+20", 11], ["+30", 12], ["+40", 13]].map(([label, v]) => {
        const p = point(v as number, r + 16);
        return <text key={label} x={p.x} y={p.y + 4} textAnchor="middle" className="hs-dial-num">{label}</text>;
      })}
      {[["100", 9.8], ["120", 10.8], ["130", 11.9]].map(([label, v]) => {
        const p = point(v as number, r - 26);
        return <text key={label} x={p.x} y={p.y + 4} textAnchor="middle" className="hs-dial-num is-small">{label}</text>;
      })}
      <text x={cx} y={height * 0.16} textAnchor="middle" className="hs-dial-reading">{reading}</text>
      <text x={cx} y={height * 0.72} textAnchor="middle" className="hs-dial-logo">{CALLSIGN} Station</text>
      <rect x="0" y={height * 0.8} width={width} height={height * 0.2} fill="#0b0b0b" />
      {Array.from({ length: 8 }, (_, i) => <line key={i} x1="0" y1={height * 0.8 + i * 4 + 2} x2={width} y2={height * 0.8 + i * 4 + 2} stroke="#1c1c1c" />)}
      <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke="#e3120f" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="11" fill="#060606" stroke="#555" strokeWidth="2" />
    </svg>
  );
}

/** The green scope with the yellow trace fill (main and mini versions). */
export function GreenScope({ state, width, height, span = 0.027, labels = true, mini = false }: {
  state: RadioState; width: number; height: number; span?: number; labels?: boolean; mini?: boolean;
}) {
  const bins = Math.round(width / (mini ? 3 : 2.4));
  const levels = spectrum(state.t * 0.8 + (mini ? 3 : 0), bins, { key: state.key, carrierAt: 0.5, floor: -118, busy: 1.4 });
  const yOf = (db: number) => height - 14 - ((db + 135) / 100) * (height - 20) * 1.15;
  const pts = levels.map((db, i) => `${((i / (bins - 1)) * width).toFixed(1)},${Math.max(4, Math.min(height - 10, yOf(db))).toFixed(1)}`);
  const centre = state.vfoA;
  const cols = Math.round(width / 21);
  const rows = Math.round(height / 13.5);
  return (
    <svg className="hs-scope" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <rect x="0" y="0" width={width} height={height} fill="#0a7f0a" />
      {Array.from({ length: cols + 1 }, (_, i) => <line key={`v${i}`} x1={i * (width / cols)} y1="0" x2={i * (width / cols)} y2={height} stroke="#7fd27f" strokeOpacity="0.55" />)}
      {Array.from({ length: rows + 1 }, (_, i) => <line key={`h${i}`} x1="0" y1={i * (height / rows)} x2={width} y2={i * (height / rows)} stroke="#7fd27f" strokeOpacity="0.55" />)}
      {Array.from({ length: Math.round(height / 6) }, (_, i) => <line key={`t${i}`} x1="0" y1={i * 6 + 3} x2="7" y2={i * 6 + 3} stroke="#d7f2d7" />)}
      <polygon points={`0,${height - 10} ${pts.join(" ")} ${width},${height - 10}`} fill="#f4f40c" />
      <line x1={width / 2} y1="0" x2={width / 2} y2={height} stroke="#d1261b" strokeWidth="2" />
      {!mini ? Array.from({ length: Math.round(width / 6) }, (_, i) => <rect key={`r${i}`} x={i * 6 + 1} y={height - 9} width="3" height="7" fill={i % 2 ? "#d84a14" : "#f0d60c"} />) : null}
      {labels ? (
        <>
          <text x="4" y="12" className="hs-scope-text">{(centre - span / 2).toFixed(4)}</text>
          <text x={width - 4} y="12" textAnchor="end" className="hs-scope-text">{(centre + span / 2).toFixed(4)}</text>
          <text x={width / 2} y="16" textAnchor="middle" className="hs-scope-text">{centre.toFixed(4)} Medium Res</text>
          <text x={width / 2} y="34" textAnchor="middle" className="hs-scope-text">54 kHz @0.22kHz/div</text>
          <text x={width / 2} y="52" textAnchor="middle" className="hs-scope-text">Filter=Dflt, AutoZ</text>
          <text x="14" y={height - 16} className="hs-scope-text is-faint">Scale 275</text>
          <text x={width - 14} y={height - 16} textAnchor="end" className="hs-scope-text is-faint">VAGC 9</text>
        </>
      ) : null}
    </svg>
  );
}

/** S-units bar meter in the black panel. */
function SUnits({ s }: { s: number }) {
  const x = (v: number) => 8 + (v <= 9 ? (v / 9) * 70 : 70 + ((v - 9) / 4) * 34);
  return (
    <div className="hs-sunits" style={at(16, 52, 118, 76)}>
      <span className="hs-sunits-label">S-units</span>
      <span className="hs-sunits-over">+20 +40 +60</span>
      <i className="hs-sunits-bar is-white" />
      <i className="hs-sunits-bar is-red" />
      <b style={{ left: x(Math.min(13, s * 0.6)), background: "#ea1f1f" }} />
      <b style={{ left: x(Math.min(13, s)), background: "#22d6e6" }} />
      <span className="hs-sunits-scale">0 1 3 5 7 9 <em>+20 +40</em></span>
    </div>
  );
}

export function HamStationScreen({ state, compact = false, controls = {} }: { state: RadioState; compact?: boolean; controls?: RadioControls }) {
  const s = sMeter(state.t, state.key);
  const now = state.now;
  const utc = hms(now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
  const loc = hms(now.getHours(), now.getMinutes(), now.getSeconds());
  const freq = state.vfoA.toFixed(6);
  const tx = state.sending;
  const keyed = state.key > 0.5;
  const message = state.decoded ? (state.decoded.length > 30 ? `…${state.decoded.slice(-29)}` : state.decoded) : "blank";
  const bandLo = Math.floor(state.vfoA * 10) / 10;

  if (compact) {
    return (
      <div className="hs hs-compact">
        <div className="hs-c-row">
          <Field x={0} y={0} w={0} kind="black" style={{ position: "static", flex: 1.2 }}>{freq}</Field>
          <Field x={0} y={0} w={0} kind="white" style={{ position: "static", flex: 0.6 }}>{tx ? "Tx" : "Rx"}</Field>
          <Field x={0} y={0} w={0} kind="cyan" style={{ position: "static", flex: 1 }}>{CALLSIGN}</Field>
        </div>
        <div className="hs-c-panel">
          <div className="hs-c-vfo">
            <span className="hs-c-sub">CW · {state.wpm} WPM · {state.pitch} Hz</span>
            <div className="hs-bigfreq">{freq}</div>
            <span className="hs-c-sub">LOC {loc} · UTC {utc}</span>
          </div>
          <div className="hs-c-sig">
            <i className={`hs-sig is-rx${!keyed ? " is-lit" : ""}`} /><span>Rx SIG</span>
            <i className={`hs-sig is-tx${keyed ? " is-lit" : ""}`} /><span>Tx SIG</span>
          </div>
        </div>
        <div className="hs-c-dial"><SMeterDial s={s} width={360} height={250} /></div>
        <div className="hs-c-scope"><GreenScope state={state} width={360} height={150} /></div>
        <Field x={0} y={0} w={0} kind="white" style={{ position: "static", height: 26 }}>{message}</Field>
        <div className="hs-c-grid">
          <Btn on={tx} onClick={controls.onStart}>{tx ? "STOP CW" : "SEND CW"}</Btn>
          <Btn on={state.muted} onClick={controls.onMute}>MUTE</Btn>
          <Btn>◀BAND</Btn>
          <Btn>BAND ▶</Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="hs hs-stage">
      {/* Status row */}
      <Field x={8} y={8} w={62}>Mute: {state.muted ? "On" : "Off"}</Field>
      <Field x={74} y={9} w={70} kind="black">{freq}</Field>
      <Field x={150} y={9} w={64} kind="white">{tx ? "Tx" : "Rx"}</Field>
      <Field x={220} y={9} w={176} style={{ fontWeight: 700 }}>{longDate(now)}</Field>
      <Field x={402} y={9} w={92} kind="cyan" style={{ fontWeight: 700 }}>{CALLSIGN}</Field>
      <Field x={500} y={9} w={68}>MV:RIT</Field>
      <i className="hs-rule" style={at(0, 36, 900, 2)} />

      {/* Main black panel */}
      <div className="hs-panel" style={at(8, 42, 560, 96)} />
      <SUnits s={s} />
      <div className="hs-modecol" style={at(142, 48)}>
        <span className="is-green">{state.mode}</span><span className="is-green">{state.wpm}</span><span className="is-cyan">WPM</span>
        <span className="is-magenta">{state.pitch}</span><span className="is-magenta">Hz</span>
      </div>
      <div className="hs-meters" style={at(186, 48, 260)}>
        {[["TX", keyed ? "1" : "0"], ["AGC", "Med"], ["STEP", "10 Hz"], ["PWR", keyed ? "100" : "0"], ["SWR", keyed ? "1.1" : "-"]].map(([label, value]) => (
          <span key={label}><b>{label}</b><em>{value}</em></span>
        ))}
      </div>
      <div className="hs-bigfreq" style={at(186, 78, 250, 54)}>{freq}</div>
      <span className="hs-time" style={at(444, 52)}>LOC {loc}</span>
      <span className="hs-time" style={at(444, 68)}>UTC {utc}</span>
      <Field x={444} y={90} w={60} h={17} kind="black" style={{ color: "#20d6e6", fontWeight: 700, border: "1px solid #7a7a7a", fontSize: 11 }}>VFO-A1</Field>
      <i className={`hs-sig is-rx${!keyed ? " is-lit" : ""}`} style={at(538, 52, 24, 14)} />
      <span className="hs-sig-label" style={at(541, 68)}>Rx</span>
      <i className={`hs-sig is-tx${keyed ? " is-lit" : ""}`} style={at(538, 92, 24, 14)} />
      <span className="hs-sig-label" style={at(541, 108)}>Tx</span>

      {/* Band ruler */}
      <div className="hs-ruler" style={at(8, 142, 560, 22)}>
        {[0, 0.1, 0.2, 0.3, 0.4, 0.5].map((d) => <span key={d} style={{ left: ((d / 0.5) * 556) }}>{(bandLo + d).toFixed(1)}</span>)}
        <i className="hs-ruler-band" style={{ width: (0.35 / 0.5) * 556 }} />
        <i className="hs-ruler-rest" style={{ left: (0.35 / 0.5) * 556 }} />
        <b style={{ left: ((state.vfoA - bandLo) / 0.5) * 556 }} />
      </div>

      {/* Scope and decoded text */}
      <div style={at(8, 168, 560, 220)}><GreenScope state={state} width={560} height={220} /></div>
      <Field x={8} y={394} w={150} h={24} style={{ fontWeight: 700 }}>Q24&nbsp; {freq}</Field>
      <Field x={164} y={394} w={404} h={24} kind="white" style={{ fontWeight: 700 }}>{message}</Field>
      <Btn x={8} y={426} w={137} h={32} on={tx} onClick={controls.onStart}>{tx ? "STOP CW" : "SEND CW"}</Btn>
      <Btn x={149} y={426} w={137} h={32} on={state.muted} onClick={controls.onMute}>MUTE</Btn>
      <Btn x={290} y={426} w={137} h={32}>◀BAND</Btn>
      <Btn x={431} y={426} w={137} h={32}>BAND ▶</Btn>

      {/* S-meter dial and lookup */}
      <div className="hs-dial-wrap" style={at(580, 42, 310, 262)}><SMeterDial s={s} width={310} height={262} /></div>
      <fieldset className="hs-group" style={at(580, 314, 310, 144)}>
        <legend>Country Prefix Lookup</legend>
      </fieldset>
      <span className="hs-label is-bold is-big" style={at(594, 338)}>CallSign:</span>
      <Field x={594} y={358} w={150} h={24} kind="white" style={{ fontWeight: 700, fontSize: 15 }}>{CALLSIGN}</Field>
      <span className="hs-label is-bold is-big" style={at(594, 392)}>Country:</span>
      <Field x={594} y={412} w={150} h={24} style={{ fontWeight: 700 }}>United States</Field>
      <Btn x={760} y={358} w={116} h={24}>Lookup</Btn>
      <span className="hs-label" style={at(760, 392, 116)}>Grid CM87 · CQ 3</span>
    </div>
  );
}
