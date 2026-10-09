/**
 * KK6OQA Radio: an SDR console and a TS-2000 station view that greet the
 * visitor in CW. The greeting plays on the audio clock when sound is allowed
 * (a gesture has unlocked it); otherwise the radio keys silently and START
 * sends it with sound.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MenuBar, type WindowMenu } from "../components/MenuBar";
import { getSystemVolume, readyAudioContext, subscribeVolume } from "../xp/audio";
import { playCw, type CwPlayback } from "./cw";
import { decoded, keyed, timeline, unitSeconds } from "./morse";
import { BANDS, PowerSdrScreen, type Band, type RadioState } from "./PowerSdrScreen";
import { GREETING, PITCH_HZ, VFO_A, VFO_B, WPM } from "./station";

const HamStationScreen = lazy(() => import("./HamStationScreen").then((m) => ({ default: m.HamStationScreen })));

const STAGE = { sdr: { w: 800, h: 451 }, station: { w: 900, h: 468 } };
const COMPACT_BELOW = 620;

type Send = { kind: "audio"; playback: CwPlayback } | { kind: "silent"; start: number };

/** Keep keying where the audio was, without the tone (mute or volume 0). */
function toSilent(current: Send | null): Send | null {
  if (current?.kind !== "audio") return current;
  current.playback.stop();
  const elapsed = current.playback.context.currentTime - current.playback.start;
  return { kind: "silent", start: performance.now() / 1000 - elapsed };
}

export function RadioApp({ active, greet = false }: { active: boolean; greet?: boolean }) {
  const [view, setView] = useState<"sdr" | "station">("sdr");
  const [band, setBand] = useState("20");
  const [vfoA, setVfoA] = useState(VFO_A);
  const [mode, setMode] = useState("CW");
  const [muted, setMuted] = useState(false);
  const [wpm, setWpm] = useState(WPM);
  const [send, setSend] = useState<Send | null>(null);
  const [now, setNow] = useState(() => performance.now());
  const [size, setSize] = useState({ w: 0, h: 0 });
  const bootRef = useRef(performance.now());
  const rootRef = useRef<HTMLDivElement>(null);
  const greetedRef = useRef(false);
  const line = useMemo(() => timeline(GREETING), []);
  const unit = unitSeconds(wpm);

  // Animation clock: ~30 fps while the window is visible.
  useEffect(() => {
    if (!active && !send) return;
    let frame = 0;
    let last = 0;
    const tick = (time: number) => {
      if (time - last > 32) {
        last = time;
        setNow(time);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, send]);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Starting and stopping the tone are side effects, so they run here, not
  // inside state updaters: React may call an updater twice, which would
  // start a second oscillator that STOP can't reach.
  const sendRef = useRef<Send | null>(null);
  const commit = useCallback((next: Send | null) => {
    sendRef.current = next;
    setSend(next);
  }, []);

  const stop = useCallback(() => {
    const current = sendRef.current;
    if (current?.kind === "audio") current.playback.stop();
    commit(null);
  }, [commit]);

  const silence = useCallback(() => commit(toSilent(sendRef.current)), [commit]);

  const start = useCallback((withSound = true) => {
    const current = sendRef.current;
    if (current?.kind === "audio") current.playback.stop();
    const context = withSound && !muted && getSystemVolume() > 0 ? readyAudioContext() : null;
    if (context) {
      const level = 0.22 * (getSystemVolume() / 100);
      commit({ kind: "audio", playback: playCw(context, line, { wpm, pitch: PITCH_HZ, level }) });
    } else {
      commit({ kind: "silent", start: performance.now() / 1000 });
    }
  }, [commit, line, muted, wpm]);

  // Greet once when opened at login.
  useEffect(() => {
    if (!greet || greetedRef.current) return;
    const id = window.setTimeout(() => {
      greetedRef.current = true;
      start();
    }, 700);
    return () => window.clearTimeout(id);
  }, [greet, start]);

  // Turning the volume to zero mid-greeting keeps the keying, drops the tone.
  useEffect(() => {
    const unsubscribe = subscribeVolume((percent) => {
      if (percent === 0) silence();
    });
    return () => { unsubscribe(); };
  }, [silence]);

  useEffect(() => () => stop(), [stop]);

  // Units sent at any moment on the page clock (seconds), for the keying
  // now and the waterfall's history. Audio sends run on the audio clock.
  const audioOffset = send?.kind === "audio" ? send.playback.context.currentTime - performance.now() / 1000 : 0;
  const unitsAt = (pageSeconds: number) => {
    if (!send) return -1;
    return send.kind === "audio" ? (pageSeconds + audioOffset - send.playback.start) / unit : (pageSeconds - send.start) / unit;
  };
  const sentUnits = unitsAt(now / 1000);
  const sending = send !== null && sentUnits < line.units + 2;
  useEffect(() => {
    if (send && sentUnits > line.units + 30) commit(null);
  }, [commit, send, sentUnits, line.units]);

  const keyAt = (radioSeconds: number) => {
    const units = unitsAt(bootRef.current / 1000 + radioSeconds);
    return units >= 0 && units < line.units && keyed(line, units) ? 1 : 0;
  };
  const state: RadioState = {
    t: (now - bootRef.current) / 1000,
    key: sending && keyed(line, sentUnits) ? 1 : 0,
    keyAt,
    sending,
    decoded: send ? decoded(line, GREETING, sentUnits) : "",
    now: new Date(),
    vfoA,
    vfoB: VFO_B,
    band,
    mode,
    zoom: 1,
    muted,
    wpm,
    pitch: PITCH_HZ,
  };

  const controls = {
    onStart: () => (sending ? stop() : start()),
    onBand: (b: Band) => { setBand(b.id); setVfoA(b.mhz); },
    onMode: setMode,
    onTune: (delta: number) => setVfoA((value) => Math.max(0.1, +(value + delta).toFixed(6))),
    onMute: () => { setMuted((m) => !m); silence(); },
  };

  const menus: WindowMenu[] = view === "sdr"
    ? [
        { label: "Setup", items: [{ label: "SDR Console", checked: true }, { label: "TS-2000 Station", onSelect: () => setView("station") }] },
        { label: "Memory", items: BANDS.map((b) => ({ label: `${b.id} m  ${b.mhz.toFixed(3)} MHz`, onSelect: () => controls.onBand(b), checked: b.id === band })) },
        { label: "Wave", items: [{ label: sending ? "Stop" : "Send greeting", onSelect: controls.onStart }] },
        { label: "Equalizer", items: [{ label: "Flat", checked: true, disabled: true }] },
        { label: "XVTRs", items: [{ label: "No transverters", disabled: true }] },
        { label: "CWX", items: [
          { label: sending ? "Stop sending" : "Send greeting", onSelect: controls.onStart },
          "separator",
          ...[20, 25, 30].map((speed) => ({ label: `${speed} WPM`, checked: wpm === speed, onSelect: () => { stop(); setWpm(speed); } })),
        ] },
      ]
    : [
        { label: "File", items: [{ label: sending ? "Stop" : "Send greeting", onSelect: controls.onStart }] },
        { label: "View/Modify", items: [{ label: "SDR Console", onSelect: () => setView("sdr") }, { label: "TS-2000 Station", checked: true }] },
        { label: "Scan/Lock", items: [{ label: "Quick Memory Scan", disabled: true }] },
        { label: "CallSign/Lookup", items: [{ label: "KK6OQA on QRZ.com", href: "https://www.qrz.com/db/KK6OQA" }] },
        { label: "Help", items: [{ label: "About KK6OQA Radio", disabled: true }] },
      ];

  const compact = size.w > 0 && size.w < COMPACT_BELOW;
  const stage = STAGE[view];
  const scale = size.w ? Math.min(size.w / stage.w, Math.max(0.3, size.h / stage.h)) : 1;

  return (
    <div className={`radio-app${compact ? " is-compact" : ""}`}>
      <MenuBar menus={menus} ariaLabel="KK6OQA Radio menu" />
      {view === "station" ? <span className="radio-license">Ham Station of: KK6OQA · Maxwell Mohammadi</span> : null}
      <div className="radio-viewport" ref={rootRef}>
        {compact ? (
          view === "sdr" ? <PowerSdrScreen state={state} compact controls={controls} /> : (
            <Suspense fallback={null}><HamStationScreen state={state} compact controls={controls} /></Suspense>
          )
        ) : (
          <div className="radio-stage" style={{ width: stage.w * scale, height: stage.h * scale }}>
            <div style={{ width: stage.w, height: stage.h, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
              {view === "sdr" ? <PowerSdrScreen state={state} controls={controls} /> : (
                <Suspense fallback={null}><HamStationScreen state={state} controls={controls} /></Suspense>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
