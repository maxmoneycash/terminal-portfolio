import { useContext } from "react";
import { useCurrentFrame } from "remotion";
import { BEAT } from "../beat";
import { caretVisible } from "../lib";
import { cueAt } from "../morseCue";
import { AppWindow, asset, Desktop, SceneStart, useOrientation } from "../xp";
import { PowerSdrScreen, type RadioState } from "../../../src/radio/PowerSdrScreen";

const RECORDED = new Date(2026, 9, 8, 15, 14, 0);
/** Both windows minimize on the last beat before drop 1. */
const OUT = 36 * BEAT - 9;

/**
 * KK6OQA's radio, sound on: the greeting goes out in Morse while the decoder
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
    wpm: 50,
    pitch: 622,
  };

  const radio = portrait ? { x: 6, y: 8, w: W - 12, h: 640 } : { x: 22, y: 30, w: 806, h: 526 };
  const decoder = portrait ? { x: 14, y: 664, w: W - 28, h: 250 } : { x: 846, y: 44, w: W - 846 - 22, h: 600 };
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
        chrome={{ menu: ["Setup", "Memory", "Wave", "Equalizer", "XVTRs", "CWX"], status: "KK6OQA · 20 m CW · 50 WPM" }}
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
            padding: portrait ? "14px 16px" : "22px 22px",
            color: "#7dff9b",
            textShadow: "0 0 10px rgb(80 255 140 / 0.55)",
            font: `700 ${portrait ? 30 : 40}px/1.22 Consolas, "Lucida Console", monospace`,
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
