import { useCurrentFrame } from "remotion";
import { easeInOut, easeOut, progress } from "../lib";
import { Balloon, Camera, ClipWindow, Desktop, Sfx, useOrientation } from "../xp";

/** Aptos tools open one after another while the tray reports the connection. */
export function Mainnet() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const BALLOON = 30;

  const wins = portrait
    ? [
        { id: "aptos-block-machine", title: "Block Machine - Aptos mainnet", x: 6, y: 14, w: W - 12, h: 330, at: 0 },
        { id: "aptos-velociraptr", title: "Velociraptr", x: W - 252, y: 300, w: 246, h: 430, at: 7 },
        { id: "aptos-validator-globe", title: "Aptos validators", x: 6, y: 372, w: 300, h: 300, at: 14 },
        { id: "block-machine-profile", title: "Transaction profile", x: 30, y: 640, w: 420, h: 200, at: 21 },
      ]
    : [
        { id: "aptos-block-machine", title: "Block Machine - Aptos mainnet", x: 18, y: 14, w: 830, h: 470, at: 0 },
        { id: "aptos-velociraptr", title: "Velociraptr - consensus, live", x: 868, y: 10, w: 392, h: 640, at: 7 },
        { id: "aptos-validator-globe", title: "Aptos validators", x: 446, y: 268, w: 520, h: 392, at: 14 },
        { id: "block-machine-profile", title: "Transaction profile", x: 36, y: 420, w: 560, h: 240, at: 21 },
      ];
  const last = wins.length - 1;

  const bw = portrait ? 330 : 350;
  const bx = W - bw - (portrait ? 10 : 22);
  const by = H - 30 - (portrait ? 120 : 108);

  return (
    <Camera
      keys={[
        // Start inside Block Machine's live block grid, then pull back as
        // the other Aptos tools open around it.
        { f: 0, v: { x: portrait ? 200 : 300, y: portrait ? 120 : 150, z: portrait ? 2.0 : 2.1 } },
        { f: 26, v: { x: W / 2, y: H / 2, z: 1.0 }, ease: easeOut },
        { f: 96, v: { x: portrait ? W / 2 : W * 0.6, y: portrait ? H * 0.62 : H * 0.6, z: portrait ? 1.1 : 1.16 }, ease: easeInOut },
      ]}
    >
      <Desktop tasks={wins.slice(0, 3).map((w, i) => ({ title: w.title, active: i === last }))}>
        {wins.map((w, i) => (
          <ClipWindow key={w.id} {...w} id={w.id as never} active={frame < (wins[i + 1]?.at ?? 1e9)} />
        ))}
        {wins.map((w) => <Sfx key={`s-${w.id}`} at={w.at} name="restore" volume={0.35} />)}
        <Sfx at={BALLOON} name="balloon" volume={0.6} />
        {frame >= BALLOON ? (
          <Balloon x={bx} y={by} w={bw} title="Aptos Mainnet is now connected" tailX={bw - 58} scale={1.2} style={{ opacity: progress(frame, BALLOON, 5) }}>
            <div style={{ fontSize: 13 }}>Speed: every block</div>
            <div style={{ fontSize: 13 }}>Signal Strength: Excellent</div>
          </Balloon>
        ) : null}
      </Desktop>
    </Camera>
  );
}
