import { useCurrentFrame } from "remotion";
import { BEAT } from "../beat";
import { Clip, Desktop, Sfx, useOrientation, Window, WindowStamp } from "../xp";

/** XP Solitaire's victory cascade, with trading apps for cards. */
const CARDS = [
  { id: "decibrrr-live", title: "Decibrrr - live orders" },
  { id: "wick-markets-ride", title: "Wick Markets - Ride" },
  { id: "temper-trade", title: "Temper Trade" },
  { id: "commits-sh-ticker", title: "commits.sh - $MAXMONEYCASH" },
  { id: "emoji-candlestick-charts", title: "Emoji Candlestick Charts" },
  { id: "seam-dex", title: "Seam - liquidity" },
  { id: "shelby-pulse", title: "Shelby Pulse" },
  { id: "fee-market-simulator", title: "Fee markets under load" },
  { id: "decibrrr-points", title: "Decibrrr - portfolio" },
  { id: "peptide-tracker", title: "Peptide Tracker" },
] as const;

const EVERY = BEAT / 2; // one launch per eighth note
const STAMP = 2; // frames between trail stamps

type Body = { x: number; y: number };

/** Deterministic bounce: constant vx, gravity, damped floor bounces. */
function path(i: number, W: number, floor: number, w: number, frames: number): Body[] {
  const left = i % 4 !== 3;
  let x = W * (0.5 + 0.1 * (i % 4)) - w / 2;
  let y = 14;
  const vx = (left ? -1 : 1) * (6.5 + (i % 3) * 1.8);
  let vy = -2 - ((i * 7) % 5);
  const out: Body[] = [];
  for (let f = 0; f <= frames; f += 1) {
    out.push({ x, y });
    x += vx;
    vy += 1.05;
    y += vy;
    if (y > floor) {
      y = floor - (y - floor) * 0.6;
      vy = -Math.abs(vy) * 0.8;
    }
  }
  return out;
}

export function Cascade() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const w = portrait ? 210 : 290;
  const h = portrait ? 160 : 204;
  const floor = H - 30 - h;

  const stamps: { key: string; t: number; i: number; p: Body }[] = [];
  const heads: { i: number; p: Body }[] = [];
  CARDS.forEach((_, i) => {
    const launch = i * EVERY;
    if (frame < launch) return;
    const trail = path(i, W, floor, w, frame - launch);
    for (let f = 0; f < trail.length - 1; f += STAMP) {
      const p = trail[f];
      if (p.x > -w && p.x < W) stamps.push({ key: `${i}-${f}`, t: launch + f, i, p });
    }
    const p = trail[trail.length - 1];
    if (p.x > -w && p.x < W) heads.push({ i, p });
  });
  stamps.sort((a, b) => a.t - b.t || a.i - b.i);

  return (
    <Desktop tasks={[{ title: "Solitaire", active: true }]}>
      {CARDS.map((card, i) => <Sfx key={`s-${card.id}`} at={i * EVERY} name="minimize" volume={0.22} />)}
      {stamps.map(({ key, i, p }) => (
        <WindowStamp key={key} id={CARDS[i].id} title={CARDS[i].title} x={p.x} y={p.y} w={w} h={h} />
      ))}
      {heads.map(({ i, p }) => (
        <Window key={i} x={p.x} y={p.y} w={w} h={h} title={CARDS[i].title} bodyStyle={{ background: "#111" }}>
          <Clip id={CARDS[i].id} thumb from={0.5} />
        </Window>
      ))}
    </Desktop>
  );
}
