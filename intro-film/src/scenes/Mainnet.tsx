import { useCurrentFrame } from "remotion";
import { beats } from "../beat";
import { easeOut, progress } from "../lib";
import { Balloon, Camera, ClipWindow, Desktop, Sfx, useOrientation, wide } from "../xp";

/** Aptos tools open on the eighth notes while the tray reports the connection. Each window takes its recording's shape. */
export function Mainnet() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const BALLOON = beats(2);

  const wins = portrait
    ? [
        { id: "aptos-block-machine", title: "Block Machine - Aptos mainnet", x: 6, y: 14, w: W - 12, at: 0 },
        { id: "aptos-velociraptr", title: "Velociraptr", x: W - 226, y: 300, w: 220, at: 7 },
        { id: "aptos-validator-globe", title: "Aptos validators", x: 6, y: 372, w: 300, at: 14 },
        { id: "block-machine-profile", title: "Transaction profile", x: 20, y: 650, w: 440, at: 21 },
      ]
    : [
        { id: "aptos-block-machine", title: "Block Machine - Aptos mainnet", x: 18, y: 14, w: 830, at: 0 },
        { id: "aptos-velociraptr", title: "Velociraptr - consensus, live", x: 939, y: 10, w: 327, at: 7 },
        { id: "aptos-validator-globe", title: "Aptos validators", x: 446, y: 280, w: 480, at: 14 },
        { id: "block-machine-profile", title: "Transaction profile", x: 36, y: 418, w: 560, at: 21 },
      ];
  const last = wins.length - 1;

  const bw = portrait ? 330 : 350;
  const bx = W - bw - (portrait ? 10 : 22);
  const by = H - 30 - (portrait ? 120 : 108);

  return (
    <Camera
      keys={[
        { f: 0, v: { x: W * 0.45, y: H * 0.42, z: 1.1 } },
        { f: beats(2), v: wide(W, H), ease: easeOut },
      ]}
    >
      <Desktop tasks={wins.slice(0, 3).map((w, i) => ({ title: w.title, active: i === last }))}>
        {wins.map((w, i) => (
          <ClipWindow key={w.id} {...w} id={w.id as never} active={frame < (wins[i + 1]?.at ?? 1e9)} />
        ))}
        {wins.map((w) => <Sfx key={`s-${w.id}`} at={w.at} name="restore" volume={0.35} />)}
        <Sfx at={BALLOON} name="balloon" volume={0.6} />
        {frame >= BALLOON ? (
          <Balloon x={bx} y={by} w={bw} title="Aptos Mainnet is now connected" tailX={bw - 58} scale={1.2} style={{ opacity: progress(frame, BALLOON, 3), transform: `scale(${0.9 + 0.1 * progress(frame, BALLOON, 5, easeOut)})`, transformOrigin: `${bw - 58}px 100%` }}>
            <div style={{ fontSize: 13 }}>Speed: every block</div>
            <div style={{ fontSize: 13 }}>Signal Strength: Excellent</div>
          </Balloon>
        ) : null}
      </Desktop>
    </Camera>
  );
}
