import { useCurrentFrame } from "remotion";
import { beats } from "../beat";
import { easeOut, progress } from "../lib";
import { Balloon, Camera, ClipWindow, Desktop, Sfx, useOrientation, wide } from "../xp";

/** A virus-surveillance workbench, and XP's antivirus balloon misreading it. */
export function Nipah() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const GENOME = beats(1);
  const BALLOON = beats(2);
  // Heights follow each recording's shape.
  const main = portrait ? { x: 6, y: 20, w: W - 12 } : { x: 24, y: 16, w: 930 };
  const genome = portrait ? { x: 26, y: 380, w: W - 40 } : { x: 520, y: 150, w: 740 };
  const bw = portrait ? 330 : 360;
  const bx = W - bw - (portrait ? 10 : 22);
  const by = H - 30 - (portrait ? 126 : 112);

  return (
    <Camera
      keys={[
        { f: 0, v: wide(W, H) },
        { f: beats(4), v: { x: W / 2, y: H / 2, z: 1.04 }, ease: easeOut },
      ]}
    >
      <Desktop tasks={[{ title: "NipahScan" }, { title: "NipahScan - genome", active: true }]}>
        <ClipWindow id="nipahscan" {...main} title="NipahScan - Nipah virus surveillance" active={frame < GENOME} from={0.5} />
        <ClipWindow id="nipahscan-genome" {...genome} title="NipahScan - genome explorer" at={GENOME} />
        <Sfx at={GENOME} name="restore" volume={0.35} />
        <Sfx at={BALLOON} name="critical" volume={0.5} />
        {frame >= BALLOON ? (
          <Balloon x={bx} y={by} w={bw} icon="shield" title="Virus scan complete" tailX={bw - 58} scale={1.2} style={{ opacity: progress(frame, BALLOON, 3), transform: `scale(${0.9 + 0.1 * progress(frame, BALLOON, 5, easeOut)})`, transformOrigin: `${bw - 58}px 100%` }}>
            <div style={{ fontSize: 13 }}>NipahScan found 1 virus.</div>
            <div style={{ fontSize: 13 }}>It&apos;s the one it was looking for.</div>
          </Balloon>
        ) : null}
      </Desktop>
    </Camera>
  );
}
