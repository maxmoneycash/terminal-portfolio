import { useCurrentFrame } from "remotion";
import { easeOut, progress, typed } from "../lib";
import { Balloon, Camera, Cursor, Desktop, Sfx, useOrientation } from "../xp";

/**
 * First look at the desktop. The tray announces the T-Deck that Lilyshark
 * turns into a packet sniffer; the camera leans in on the balloon.
 */
export function Arrival() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const BALLOON = 14;
  const shown = frame >= BALLOON;
  const body = typed("Lilyshark is installed. The radio is now a packet sniffer.", frame, BALLOON + 8, 34);

  const bw = portrait ? 340 : 360;
  const bx = W - bw - (portrait ? 14 : 22);
  const by = H - 30 - (portrait ? 132 : 112);
  const tail = bw - (portrait ? 46 : 62);

  return (
    <Camera
      keys={[
        { f: 0, v: { x: W / 2, y: H / 2, z: 1 } },
        { f: 10, v: { x: W / 2, y: H / 2, z: 1 } },
        { f: 80, v: { x: bx + bw / 2, y: by + 50, z: portrait ? 1.3 : 1.42 }, ease: easeOut },
        { f: 120, v: { x: bx + bw / 2, y: by + 50, z: portrait ? 1.36 : 1.48 } },
      ]}
    >
      <Desktop>
        <Sfx at={BALLOON} name="balloon" volume={0.6} />
        {shown ? (
          <Balloon
            x={bx}
            y={by}
            w={bw}
            title="Found New Hardware"
            tailX={tail}
            scale={1.25}
            style={{ opacity: progress(frame, BALLOON, 5) }}
          >
            <b style={{ fontSize: 15 }}>LILYGO T-Deck Plus</b>
            <div style={{ fontSize: 14, minHeight: 38 }}>{body}</div>
          </Balloon>
        ) : null}
        <Cursor
          path={[
            { f: 0, v: { x: W * 0.52, y: H * 0.42 } },
            { f: 40, v: { x: W * 0.62, y: H * 0.58 } },
            { f: 90, v: { x: bx + bw * 0.4, y: by - 18 } },
          ]}
        />
      </Desktop>
    </Camera>
  );
}

/** Keeps a slight drift on wide shots so the frame never sits dead still. */
export function drift(frame: number, amount = 0.04) {
  return 1 + amount * progress(frame, 0, 150, easeOut);
}
