import { useCurrentFrame } from "remotion";
import { easeOut, progress } from "../lib";
import { Balloon, Camera, ClipWindow, Desktop, Sfx, useOrientation } from "../xp";

/** A virus-surveillance workbench, and XP's antivirus balloon misreading it. */
export function Nipah() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const BALLOON = 26;
  const main = portrait
    ? { x: 6, y: 20, w: W - 12, h: 420 }
    : { x: 24, y: 16, w: 930, h: 600 };
  const genome = portrait
    ? { x: 26, y: 380, w: W - 40, h: 380 }
    : { x: 520, y: 150, w: 740, h: 500 };
  const bw = portrait ? 330 : 360;
  const bx = W - bw - (portrait ? 10 : 22);
  const by = H - 30 - (portrait ? 126 : 112);

  return (
    <Camera
      keys={[
        { f: 0, v: { x: main.x + main.w * 0.35, y: main.y + main.h * 0.4, z: portrait ? 1.35 : 1.4 } },
        { f: 14, v: { x: W / 2, y: H / 2, z: 1.0 }, ease: easeOut },
        { f: 90, v: { x: bx + bw * 0.3, y: by - 40, z: portrait ? 1.3 : 1.45 }, ease: easeOut },
      ]}
    >
      <Desktop tasks={[{ title: "NipahScan" }, { title: "NipahScan - genome", active: true }]}>
        <ClipWindow id="nipahscan" {...main} title="NipahScan - Nipah virus surveillance" active={frame < 12} from={0.5} />
        <ClipWindow id="nipahscan-genome" {...genome} title="NipahScan - genome explorer" at={12} />
        <Sfx at={12} name="restore" volume={0.35} />
        <Sfx at={BALLOON} name="critical" volume={0.5} />
        {frame >= BALLOON ? (
          <Balloon x={bx} y={by} w={bw} icon="shield" title="Virus scan complete" tailX={bw - 58} scale={1.2} style={{ opacity: progress(frame, BALLOON, 5) }}>
            <div style={{ fontSize: 13 }}>NipahScan found 1 virus.</div>
            <div style={{ fontSize: 13 }}>It&apos;s the one it was looking for.</div>
          </Balloon>
        ) : null}
      </Desktop>
    </Camera>
  );
}
