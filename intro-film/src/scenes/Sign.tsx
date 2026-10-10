import { AbsoluteFill, useCurrentFrame } from "remotion";
import score from "../../score.json";
import { BEAT } from "../beat";
import { Calligraphy } from "../Calligraphy";
import { progress } from "../lib";
import { AppWindow, asset, Desktop, useOrientation } from "../xp";

const WRITE = score.calligraphy;
/** The window closes on the last beat of the opening bars. */
const CLOSE = 15 * BEAT - 4;

/**
 * The opening: a big Paint canvas, front and centre, where the quill writes
 * "Maxwell Mohammadi" stroke by stroke. When the name is done, it closes.
 */
export function Sign() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const win = portrait ? { x: 10, y: 250, w: W - 20, h: 400 } : { x: 54, y: 92, w: W - 108, h: 470 };
  const sigW = portrait ? win.w - 60 : win.w - 120;
  const fadeIn = progress(frame, 0, 8);
  return (
    <Desktop tasks={frame < CLOSE + 7 ? [{ title: "Maxwell Mohammadi - Paint", icon: asset("start-menu/paint.webp"), active: true }] : []}>
      <AppWindow
        {...win}
        at={2}
        out={CLOSE}
        exit="close"
        title="Maxwell Mohammadi - Paint"
        icon={asset("start-menu/paint.webp")}
        chrome={{ menu: ["File", "Edit", "View", "Image", "Colors", "Help"] }}
        bodyStyle={{
          background: "radial-gradient(120% 90% at 50% 40%, #fffdf7 0%, #fbf6ea 60%, #f1e9d6 100%)",
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
        }}
      >
        <div style={{ transform: portrait ? "translateY(4%)" : "translateY(2%)" }}>
          <Calligraphy progress={Math.max(0, (frame - WRITE.start) / WRITE.frames)} width={sigW} twoLines={portrait} quill={portrait ? 0.62 : 1} />
        </div>
      </AppWindow>
      <AbsoluteFill style={{ background: "#000", opacity: 1 - fadeIn, pointerEvents: "none" }} />
    </Desktop>
  );
}
