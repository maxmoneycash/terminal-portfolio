import { useCurrentFrame } from "remotion";
import { beats } from "../beat";
import { caretVisible, easeInOut, easeOut, progress, typed } from "../lib";
import { asset, Camera, Clip, clipInfo, Desktop, shotOf, useOrientation, wide, Window } from "../xp";

const CLIP = 2400 / 1506;
const FRAMES = beats(8);
// The 9-minute session (cut to 8 s at 68.75x) plays faster to fit 8 beats.
const RATE = (clipInfo("devenv-timelapse").duration * 30) / 68.75 / FRAMES;
const SPEED = Math.round(68.75 * RATE);
const TITLE = `claude ~/RF-SIGINT · 9 minutes in ${Math.round(FRAMES / 30)} seconds`;

/** Taskbar time: the clock races through the session the clip compresses. */
function clock(frame: number) {
  const start = 14 * 60 + 14; // 3:14 PM, when the recording starts
  const minutes = start + Math.floor((clipInfo("devenv-timelapse").duration / 60) * (frame / FRAMES));
  return `3:${String(minutes % 60).padStart(2, "0")} PM`;
}

/**
 * Back to the code: a real nine-minute Claude Code session on
 * spectra, with commits.sh streaming beside it, played as a timelapse.
 */
export function Timelapse() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const title = typed(TITLE, frame, 2, 60);
  const badge = progress(frame, 6, 5, easeOut);

  // As large as the screen allows at the clip's own shape.
  const body = portrait ? { w: W - 18, h: Math.round((W - 18) / CLIP) } : { h: H - 30 - 16 - 33, w: Math.round((H - 30 - 16 - 33) * CLIP) };
  const win = { x: Math.round((W - body.w - 6) / 2), y: portrait ? 250 : 8, w: body.w + 6, h: body.h + 33 };

  return (
    <Camera
      keys={[
        { f: 0, v: wide(W, H) },
        { f: FRAMES, v: shotOf(win, W, H, portrait, 40), ease: easeInOut },
      ]}
    >
      <Desktop clock={clock(frame)} tasks={[{ title: "cmd.exe - claude ~/RF-SIGINT", icon: asset("start-menu/cmd.webp"), active: true }]}>
        <Window
          {...win}
          appear={0}
          title={
            <>
              {title}
              {title.length < TITLE.length ? <span style={{ opacity: caretVisible(frame) ? 1 : 0 }}>|</span> : null}
            </>
          }
          icon={asset("start-menu/cmd.webp")}
          bodyStyle={{ background: "#000" }}
        >
          <Clip id="devenv-timelapse" rate={RATE} />
          <span
            className="mono"
            style={{
              position: "absolute",
              top: portrait ? 8 : 12,
              left: portrait ? 8 : 12,
              padding: portrait ? "3px 7px" : "4px 10px",
              borderRadius: 3,
              background: "rgb(0 0 0 / 0.72)",
              color: "#9df58c",
              fontSize: portrait ? 13 : 16,
              opacity: badge,
              transform: `scale(${0.9 + 0.1 * badge})`,
              transformOrigin: "0 0",
            }}
          >
            ▶▶ {SPEED}×
          </span>
        </Window>
      </Desktop>
    </Camera>
  );
}
