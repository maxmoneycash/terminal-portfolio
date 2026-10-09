import { useContext } from "react";
import { useCurrentFrame } from "remotion";
import { BEAT, beats } from "../beat";
import { easeInOut, easeOut, progress, typed } from "../lib";
import { cueAt } from "../morseCue";
import { FilmSignature } from "../Signature";
import { asset, Balloon, Camera, Desktop, SceneStart, shotOf, useOrientation, wide, Window } from "../xp";
import { PowerSdrScreen, type RadioState } from "../../../src/radio/PowerSdrScreen";

/** Overshooting window entrance: XP's open, with a slam that lands on the beat. */
function slam(frame: number, at: number) {
  if (frame < at) return { opacity: 0, transform: "scale(0.6)" };
  const t = Math.min(1, (frame - at) / 7);
  const back = 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2; // easeOutBack
  const scale = 0.6 + 0.4 * back;
  return { opacity: Math.min(1, t * 2.5), transform: `translateY(${(1 - t) * 26}px) rotate(${(1 - t) * -3}deg) scale(${scale})` };
}

const RECORDED = new Date(2026, 9, 8, 15, 14, 0);

/**
 * The first drop: KK6OQA's radio slams onto the desktop sending "DE KK6OQA"
 * on 32nd notes, the quill window pops on beat 4 and writes the name, and
 * the T-Deck the next scene is about announces itself on beat 10.
 */
export function Station() {
  const frame = useCurrentFrame();
  const sceneStart = useContext(SceneStart);
  const { W, H, portrait } = useOrientation();
  const morse = cueAt("station", sceneStart + frame);
  const QUILL = beats(4);
  const BALLOON = beats(10);

  const state: RadioState = {
    t: frame / 30,
    key: morse.key,
    // The waterfall's history: the same cue at earlier frames.
    keyAt: (seconds: number) => cueAt("station", sceneStart + seconds * 30).key,
    sending: morse.sending,
    decoded: morse.text,
    now: new Date(RECORDED.getTime() + (frame / 30) * 1000),
    vfoA: 14.025,
    vfoB: 14.025,
    band: "20",
    mode: "CW",
    zoom: 1,
    muted: false,
    wpm: 21,
    pitch: 622,
  };

  // Landscape: the console at its native 800 x 451 inside the Luna frame.
  const radio = portrait ? { x: 6, y: 10, w: W - 12, h: 712 } : { x: 34, y: 22, w: 806, h: 526 };
  const quill = portrait ? { x: 30, y: 730, w: W - 60, h: 170 } : { x: 866, y: 64, w: 390, h: 196 };
  const balloon = { w: portrait ? 330 : 360 };
  const bx = W - balloon.w - (portrait ? 14 : 22);
  const by = H - 30 - (portrait ? 132 : 112);
  const body = typed("Lilyshark is installed. The radio is now a packet sniffer.", frame, BALLOON + 3, 60);

  return (
    <Camera
      keys={[
        { f: 0, v: shotOf(radio, W, H, portrait) },
        { f: QUILL, v: shotOf(radio, W, H, portrait) },
        { f: QUILL + 10, v: wide(W, H), ease: easeOut },
        { f: beats(12), v: { x: W / 2, y: H / 2 + 6, z: 1.03 }, ease: easeInOut },
      ]}
    >
      <Desktop
        tasks={[
          { title: "KK6OQA Radio", icon: asset("desktop/radio.svg"), active: frame < QUILL },
          ...(frame >= QUILL ? [{ title: "signature.bmp - Paint", icon: asset("start-menu/paint.webp"), active: true }] : []),
        ]}
      >
        <Window
          {...radio}
          title="KK6OQA Radio"
          icon={asset("desktop/radio.svg")}
          active={frame < QUILL}
          chrome={{
            menu: ["Setup", "Memory", "Wave", "Equalizer", "XVTRs", "CWX"],
            status: "KK6OQA · 20 m CW · 73 de Max",
          }}
          bodyStyle={{ background: "#1c1d20", overflow: "hidden" }}
          style={slam(frame, 0)}
        >
          {portrait ? (
            <PowerSdrScreen state={state} compact />
          ) : (
            <PowerSdrScreen state={state} />
          )}
        </Window>
        {frame >= QUILL ? (
          <Window
            {...quill}
            title="signature.bmp - Paint"
            icon={asset("start-menu/paint.webp")}
            chrome={{ status: "KK6OQA · Maxwell Mohammadi" }}
            bodyStyle={{ background: "#fff", display: "grid", placeItems: "center", overflow: "hidden" }}
            style={slam(frame, QUILL)}
          >
            <div style={{ transform: "translateY(-12%)" }}>
              <FilmSignature progress={progress(frame, QUILL + 4, beats(5), easeInOut)} width={(quill.w - 6) * 1.32} quill={portrait ? 84 : 96} />
            </div>
          </Window>
        ) : null}
        {frame >= BALLOON ? (
          <Balloon
            x={bx}
            y={by}
            w={balloon.w}
            title="Found New Hardware"
            tailX={balloon.w - 62}
            scale={1.25}
            style={{ opacity: progress(frame, BALLOON, 3), transform: `scale(${0.9 + 0.1 * progress(frame, BALLOON, 5, easeOut)})`, transformOrigin: `${balloon.w - 62}px 100%` }}
          >
            <b style={{ fontSize: 15 }}>LILYGO T-Deck Plus</b>
            <div style={{ fontSize: 14, minHeight: 38 }}>{body}</div>
          </Balloon>
        ) : null}
      </Desktop>
    </Camera>
  );
}

export const STATION_BEATS = 12;
export const STATION_FRAMES = STATION_BEATS * BEAT;
