/**
 * KK6OQA's SDR console in the PowerSDR style, cut down to what matters: one
 * START key, VFO A, an LED meter, a glowing spectrum over a scrolling
 * waterfall, a handful of bands and modes, and the CW decoder. Pure function
 * of `state` (no clocks of its own), so the intro film can render it frame by
 * frame. `compact` restacks it for phones.
 */
import type { CSSProperties, ReactNode, WheelEvent } from "react";
import { LedMeter, Panadapter, Waterfall } from "./Spectrum";
import { sMeter, sToDbm } from "./signal";
import "./radio.css";

export type Band = { id: string; mhz: number; label: string };
export const BANDS: Band[] = [
  { id: "160", mhz: 1.81, label: "160M CW Sub-Band" },
  { id: "80", mhz: 3.53, label: "80M CW Sub-Band" },
  { id: "40", mhz: 7.03, label: "40M CW Sub-Band" },
  { id: "20", mhz: 14.025, label: "20M CW Sub-Band" },
  { id: "15", mhz: 21.025, label: "15M CW Sub-Band" },
  { id: "10", mhz: 28.025, label: "10M CW Sub-Band" },
  { id: "6", mhz: 50.069, label: "6M Beacon Sub-Band" },
];
export const MODES = ["CW", "USB", "LSB"];

export type RadioState = {
  /** Seconds since the radio started; drives every animation. */
  t: number;
  /** Key level now, 0 (up) to 1 (down). */
  key: number;
  /** Key level at any time on the same clock: the waterfall draws the history. */
  keyAt: (t: number) => number;
  /** A transmission is in progress (MOX). */
  sending: boolean;
  /** CW text decoded so far. */
  decoded: string;
  now: Date;
  vfoA: number;
  vfoB: number;
  band: string;
  mode: string;
  zoom: number;
  muted: boolean;
  wpm: number;
  pitch: number;
};

export type RadioControls = {
  onStart?: () => void;
  onBand?: (band: Band) => void;
  onMode?: (mode: string) => void;
  onTune?: (deltaMhz: number) => void;
  onMute?: () => void;
};

const at = (x: number, y: number, w?: number, h?: number): CSSProperties => ({ position: "absolute", left: x, top: y, width: w, height: h });

function Btn({ x, y, w = 44, h = 28, children, on, onClick, big, style }: {
  x?: number; y?: number; w?: number; h?: number; children: ReactNode; on?: boolean; onClick?: () => void; big?: boolean; style?: CSSProperties;
}) {
  const pos = x === undefined ? undefined : at(x, y ?? 0, w, h);
  return (
    <button type="button" className={`sdr-btn${on ? " is-on" : ""}${big ? " is-big" : ""}`} style={{ ...pos, ...style }} onClick={onClick} tabIndex={onClick ? 0 : -1} aria-pressed={on}>
      <span>{children}</span>
      <i />
    </button>
  );
}

function Group({ x, y, w, h, label }: { x: number; y: number; w: number; h: number; label?: ReactNode }) {
  return (
    <div className="sdr-group" style={at(x, y, w, h)}>
      {label ? <span className="sdr-group-label">{label}</span> : null}
    </div>
  );
}

const freqText = (mhz: number) => mhz.toFixed(6);
const clock = (now: Date) => `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

/** The decoder shows the tail of what has been sent, with a blinking block. */
function Decoder({ state }: { state: RadioState }) {
  const text = state.decoded;
  const tail = text.length > 26 ? text.slice(-26) : text;
  const caret = state.sending && Math.floor(state.t * 2.5) % 2 === 0;
  return (
    <div className="sdr-decoder">
      {tail || <span className="sdr-decoder-idle">RX · 73 de KK6OQA</span>}
      {state.sending ? <b style={{ opacity: caret ? 1 : 0 }} /> : null}
    </div>
  );
}

export function PowerSdrScreen({ state, compact = false, controls = {} }: { state: RadioState; compact?: boolean; controls?: RadioControls }) {
  const band = BANDS.find((b) => b.id === state.band);
  const s = sMeter(state.t, state.key);
  const dbm = Math.round(sToDbm(s));
  const keyed = state.key > 0.5;
  const tuneWheel = controls.onTune
    ? (event: WheelEvent) => {
        event.preventDefault();
        controls.onTune?.((event.deltaY > 0 ? -1 : 1) * 0.0001);
      }
    : undefined;
  const readout = keyed ? "100 W" : `${dbm} dBm`;

  if (compact) {
    return (
      <div className="sdr sdr-compact">
        <div className="sdr-c-row">
          <Btn on={state.sending} onClick={controls.onStart} style={{ flex: 1 }}>{state.sending ? "STOP" : "START"}</Btn>
          <div className={`sdr-tx${keyed ? " is-keyed" : ""}`} style={{ width: 64 }}>TX</div>
          <Btn on={state.muted} onClick={controls.onMute} style={{ width: 64 }}>MUT</Btn>
        </div>
        <div className="sdr-group sdr-c-vfo">
          <span className="sdr-group-label">VFO A · KK6OQA</span>
          <div className="sdr-display" onWheel={tuneWheel}>{freqText(state.vfoA)}</div>
          <div className="sdr-status">{band?.label}</div>
        </div>
        <div className="sdr-c-meter">
          <div className="sdr-readout">{readout}</div>
          <LedMeter s={s} segments={24} />
        </div>
        <div className="sdr-c-scope">
          <Panadapter t={state.t} keyAt={state.keyAt} vfo={state.vfoA} width={360} height={150} id="pan-c" />
          <Waterfall t={state.t} keyAt={state.keyAt} width={360} height={150} rows={64} />
        </div>
        <Decoder state={state} />
        <div className="sdr-c-grid is-bands">
          {BANDS.map((b) => <Btn key={b.id} on={b.id === state.band} onClick={() => controls.onBand?.(b)}>{b.id}</Btn>)}
        </div>
        <div className="sdr-c-grid is-modes">
          {MODES.map((m) => <Btn key={m} on={m === state.mode} onClick={() => controls.onMode?.(m)}>{m}</Btn>)}
        </div>
      </div>
    );
  }

  return (
    <div className="sdr sdr-stage">
      <Btn x={10} y={10} w={72} h={58} big on={state.sending} onClick={controls.onStart}>{state.sending ? "STOP" : "START"}</Btn>

      <Group x={92} y={6} w={330} h={66} label="VFO A · KK6OQA" />
      <div className="sdr-display" style={at(100, 15, 240, 34)} onWheel={tuneWheel}>{freqText(state.vfoA)}</div>
      <div className={`sdr-tx${keyed ? " is-keyed" : ""}`} style={at(346, 15, 68, 34)}>TX</div>
      <div className="sdr-status" style={at(100, 52, 314, 15)}>
        <span>{band?.label}</span>
        <span className="sdr-status-right">{state.mode} · {state.wpm} WPM · {state.pitch} Hz</span>
      </div>

      <Group x={432} y={6} w={360} h={66} label="RX1 Meter" />
      <div className="sdr-readout" style={at(440, 15, 112, 34)}>{readout}</div>
      <div style={at(560, 17, 224, 26)}><LedMeter s={s} /></div>
      <div className="sdr-led-scale" style={at(560, 46, 224, 14)}>
        {["1", "3", "5", "7", "9", "+20", "+40", "+60"].map((label) => <span key={label} className={label.startsWith("+") ? "is-over" : undefined}>{label}</span>)}
      </div>

      <div className="sdr-scope" style={at(8, 80, 784, 290)}>
        <Panadapter t={state.t} keyAt={state.keyAt} vfo={state.vfoA} width={784} height={150} zoom={state.zoom} />
        <Waterfall t={state.t} keyAt={state.keyAt} width={784} height={140} />
      </div>

      {BANDS.map((b, i) => (
        <Btn key={b.id} x={10 + i * 48} y={380} w={44} h={28} on={b.id === state.band} onClick={() => controls.onBand?.(b)}>{b.id}</Btn>
      ))}
      {MODES.map((m, i) => (
        <Btn key={m} x={356 + i * 48} y={380} w={44} h={28} on={m === state.mode} onClick={() => controls.onMode?.(m)}>{m}</Btn>
      ))}
      <span className="sdr-foot" style={at(12, 418, 486, 20)}>
        <span>LOC {clock(state.now)}</span>
        <span>{state.now.toLocaleDateString("en-US")}</span>
        <span>{state.muted ? "Monitor muted" : "Monitor on"}</span>
      </span>
      <Group x={508} y={378} w={284} h={64} label="CW Decoder" />
      <div style={at(516, 388, 268, 46)}><Decoder state={state} /></div>
    </div>
  );
}
