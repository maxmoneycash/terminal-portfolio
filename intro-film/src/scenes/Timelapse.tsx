import { useCurrentFrame } from "remotion";
import { caretVisible, easeInOut, easeOut, progress, typed } from "../lib";
import { asset, Camera, Clip, clipInfo, Desktop, Sfx, useOrientation, Window } from "../xp";

const CLIP = 2400 / 1506;
const TITLE = "claude ~/RF-SIGINT · 9 minutes in 8 seconds";

/** Taskbar time: the clock races through the session the clip compresses. */
function clock(frame: number, frames: number) {
  const start = 14 * 60 + 14; // 3:14 PM, when the recording starts
  const minutes = start + Math.floor((clipInfo("devenv-timelapse").duration / 60) * (frame / frames));
  return `3:${String(minutes % 60).padStart(2, "0")} PM`;
}

/**
 * The first thing on the desktop: a real nine-minute Claude Code session on
 * spectra, with commits.sh streaming beside it, played as a timelapse.
 */
export function Timelapse() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const title = typed(TITLE, frame, 4, 40);
  const badge = progress(frame, 10, 6, easeOut);

  // Landscape: as large as the screen allows at the clip's own shape.
  // Portrait: full width, then the camera pans from the code to commits.sh.
  const body = portrait ? { w: W - 18, h: Math.round((W - 18) / CLIP) } : { h: H - 30 - 16 - 33, w: Math.round((H - 30 - 16 - 33) * CLIP) };
  const win = { x: Math.round((W - body.w - 6) / 2), y: portrait ? 300 : 8, w: body.w + 6, h: body.h + 33 };
  const midY = win.y + win.h / 2;

  return (
    <Camera
      keys={portrait
        ? [
            { f: 0, v: { x: win.x + win.w * 0.3, y: midY, z: 1.75 } },
            { f: 120, v: { x: win.x + win.w * 0.36, y: midY, z: 1.65 }, ease: easeInOut },
            { f: 200, v: { x: win.x + win.w * 0.78, y: midY, z: 1.7 }, ease: easeInOut },
            { f: 236, v: { x: win.x + win.w * 0.8, y: midY, z: 1.74 } },
          ]
        : [
            { f: 0, v: { x: win.x + win.w * 0.32, y: win.y + win.h * 0.42, z: 1.55 } },
            { f: 70, v: { x: W / 2, y: (H - 30) / 2, z: 1 }, ease: easeOut },
            { f: 236, v: { x: win.x + win.w * 0.62, y: (H - 30) / 2 - 10, z: 1.08 }, ease: easeInOut },
          ]}
    >
      <Desktop
        clock={clock(frame, 236)}
        tasks={[{ title: "cmd.exe - claude ~/RF-SIGINT", icon: asset("start-menu/cmd.webp"), active: true }]}
      >
        {/* XP's logon chime: the desktop appears here first. */}
        <Sfx at={0} name="login" volume={0.8} />
        <Window
          {...win}
          title={
            <>
              {title}
              {title.length < TITLE.length ? <span style={{ opacity: caretVisible(frame) ? 1 : 0 }}>|</span> : null}
            </>
          }
          icon={asset("start-menu/cmd.webp")}
          bodyStyle={{ background: "#000" }}
        >
          <Clip id="devenv-timelapse" />
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
            ▶▶ 69×
          </span>
        </Window>
      </Desktop>
    </Camera>
  );
}

export const TIMELAPSE_FRAMES = 236;
