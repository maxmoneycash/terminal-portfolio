import { useContext } from "react";
import { useCurrentFrame } from "remotion";
import { BEAT } from "../beat";
import { caretVisible } from "../lib";
import { cueAt } from "../morseCue";
import { AppWindow, asset, Desktop, SceneStart, useOrientation } from "../xp";
import { PowerSdrScreen, type RadioState } from "../../../src/radio/PowerSdrScreen";

const RECORDED = new Date(2026, 9, 8, 15, 14, 0);
/** Both windows minimize on the last beat before drop 1. */
const OUT = 8 * BEAT - 9;

/**
 * KK6OQA's radio, sound on: the callsign goes out in Morse while the decoder
 * spells it out large enough to read along. Then it minimizes for the work.
 */
export function Radio() {
  const frame = useCurrentFrame();
  const sceneStart = useContext(SceneStart);
  const { W, H, portrait } = useOrientation();
  const morse = cueAt("radio", sceneStart + frame);

  const state: RadioState = {
    t: frame / 30,
    key: morse.key,
    keyAt: (seconds: number) => cueAt("radio", sceneStart + seconds * 30).key,
    sending: morse.sending,
    decoded: morse.text,
    now: new Date(RECORDED.getTime() + (frame / 30) * 1000),
    vfoA: 14.025,
    vfoB: 14.025,
    band: "20",
    mode: "CW",
    zoom: 1,
    muted: false,
    wpm: 36,
    pitch: 622,
  };

  const designW = portrait ? 540 : 846;
  const designH = portrait ? 890 : 690;
  const scale = Math.min(1, (W - 20) / designW, (H - 50) / designH);
  const left = (W - designW * scale) / 2;
  const top = (H - 30 - designH * scale) / 2;
  const fit = (box: {x: number; y: number; w: number; h: number}) => ({
    x: left + box.x * scale, y: top + box.y * scale, w: box.w * scale, h: box.h * scale, chromeScale: scale,
  });
  const radio = fit(portrait ? { x: 10, y: 18, w: 520, h: 702 } : { x: 20, y: 12, w: 806, h: 526 });
  const decoder = fit(portrait ? { x: 20, y: 734, w: 500, h: 120 } : { x: 173, y: 558, w: 500, h: 102 });
  const taskX = portrait ? 140 : 200;
  const text = morse.text;

  return (
    <Desktop
      tasks={frame < OUT + 7 ? [
        { title: "KK6OQA Radio", icon: asset("desktop/radio.svg"), active: true },
        { title: "CW Decoder", icon: asset("start-menu/notepad.webp") },
      ] : []}
    >
      <AppWindow
        {...radio}
        at={0}
        out={OUT}
        taskX={taskX}
        title="KK6OQA Radio"
        icon={asset("desktop/radio.svg")}
        chrome={{ menu: ["Setup", "Memory", "Wave", "Equalizer", "XVTRs", "CWX"], status: "KK6OQA · 20 m CW · 36 WPM" }}
        bodyStyle={{ background: "#1c1d20", overflow: "hidden" }}
      >
        {portrait ? <PowerSdrScreen state={state} compact /> : <PowerSdrScreen state={state} />}
      </AppWindow>
      <AppWindow
        {...decoder}
        at={6}
        out={OUT + 2}
        taskX={taskX + 160}
        enter={portrait ? "bottom" : "right"}
        title="CW Decoder - KK6OQA"
        icon={asset("start-menu/notepad.webp")}
        active={false}
        bodyStyle={{ background: "#020604", overflow: "hidden" }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: "12px 20px",
            textAlign: "center",
            color: "#7dff9b",
            textShadow: "0 0 10px rgb(80 255 140 / 0.55)",
            font: `700 ${portrait ? 46 : 44}px/1.22 Consolas, "Lucida Console", monospace`,
            letterSpacing: 0.5,
            wordBreak: "break-word",
          }}
        >
          {text}
          <span style={{ opacity: caretVisible(frame) ? 1 : 0 }}>█</span>
        </div>
      </AppWindow>
    </Desktop>
  );
}
