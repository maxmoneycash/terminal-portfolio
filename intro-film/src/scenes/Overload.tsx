/**
 * Drop 3, overload: everything else, tiled the way XP's "Tile Windows" does
 * it. Four windows a project every two beats, then nine-up a project a beat,
 * then sixteen-up a project every half beat: more work, faster, but every
 * window whole and none on top of another. Each grid minimizes to the
 * taskbar just before the next opens on its downbeat; at the end XP counts
 * the windows, they all minimize, and the desktop is clean for "your turn."
 */
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { BAR, BEAT } from "../beat";
import { easeOut, progress } from "../lib";
import { AppWindow, asset, Clip, Desktop, posterOf, Sfx, Still, useOrientation, XPButton } from "../xp";
import type clipManifest from "../../clips.json";
import type stillManifest from "../../stills.json";

type ClipId = keyof typeof clipManifest.clips;
type StillId = keyof typeof stillManifest.stills;
type Item = { title: string; clip?: ClipId; still?: StillId; from?: number };

const TIERS: { every: number; start: number; items: Item[] }[] = [
  {
    start: 0,
    every: 2 * BEAT,
    items: [
      { title: "claude - ~/RF-SIGINT", clip: "devenv-timelapse" },
      { title: "cash.trading — Decibel live orders", clip: "decibrrr-live" },
      { title: "Tend — tend.earth", still: "tend-home" },
      { title: "Content Rewards — new campaign", still: "content-rewards" },
    ],
  },
  {
    start: 2 * BAR,
    every: BEAT,
    items: [
      { title: "Whop Finance", still: "whop-finance" },
      { title: "Aptos Velociraptr", clip: "aptos-velociraptr" },
      { title: "turbotokens", still: "turbotokens" },
      { title: "Seam — liquidity", clip: "seam-dex" },
      { title: "tx-composer", still: "tx-composer" },
      { title: "Shelby Pulse", clip: "shelby-pulse" },
      { title: "Wick Markets — Ride", clip: "wick-markets-ride" },
      { title: "Peptide Tracker", clip: "peptide-tracker" },
    ],
  },
  {
    start: 4 * BAR,
    every: BEAT / 2,
    items: [
      { title: "Emoji Candlestick Charts", clip: "emoji-candlestick-charts" },
      { title: "cash.trading — BTC", still: "cash-trading-btc" },
      { title: "Temper Trade", clip: "temper-trade" },
      { title: "Fee markets under load", clip: "fee-market-simulator" },
      { title: "Aptos HFT demo", clip: "aptos-hft-demo" },
      { title: "Velociraptr vs Archon", still: "aptos-archon" },
      { title: "Aptos load test", clip: "aptos-load-test" },
      { title: "Block Machine — functions", clip: "block-machine-functions" },
      { title: "Whop Finance — SDK", still: "whop-finance-sdk" },
      { title: "Decibel — portfolio", clip: "decibrrr-points" },
      { title: "commits.sh — popover", clip: "commits-sh-popover" },
      { title: "Tend — donations", still: "tend-app" },
      { title: "NipahScan — genome", clip: "nipahscan-genome" },
      { title: "MaxXP", clip: "maxxp-desktop" },
      { title: "Block Machine — profile", clip: "block-machine-profile" },
      { title: "Roman — how it will see", still: "roman-see" },
    ],
  },
];

const DIALOG = 6 * BAR + 2 * BEAT;
const CLEAR = 7 * BAR;
const TITLE_H = 33;

type Placed = Item & { at: number; out: number; x: number; y: number; w: number; h: number; chrome: number; tier: number; live: boolean; key: number };

/** The largest window a tile of tw × th holds for content of this ratio. */
function fit(tw: number, th: number, ratio: number) {
  const w = Math.min(tw, (th - TITLE_H) * ratio + 6);
  return { w: Math.round(w), h: Math.round((w - 6) / ratio + TITLE_H) };
}

/**
 * XP's "Tile Windows": the column count that gives each window the most room,
 * every window fully on screen, none overlapping, a short last row centred.
 */
function tile(n: number, W: number, H: number) {
  const margin = 14;
  // Clear of the desktop icon column, so no icon peeks out half covered.
  const left = 92;
  const gap = 12;
  const areaW = W - left - margin;
  const areaH = H - 30 - 2 * margin;
  let best = { cols: 1, rows: n, size: 0 };
  for (let cols = 1; cols <= n; cols += 1) {
    const rows = Math.ceil(n / cols);
    const tw = (areaW - gap * (cols - 1)) / cols;
    const th = (areaH - gap * (rows - 1)) / rows;
    const { w, h } = fit(tw, th, 16 / 9);
    if (w * h > best.size) best = { cols, rows, size: w * h };
  }
  const { cols, rows } = best;
  const tw = (areaW - gap * (cols - 1)) / cols;
  const th = (areaH - gap * (rows - 1)) / rows;
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / cols);
    const inRow = row === rows - 1 ? n - row * cols : cols;
    const col = i % cols;
    const x = left + ((cols - inRow) * (tw + gap)) / 2 + col * (tw + gap);
    return { x, y: margin + row * (th + gap), tw, th };
  });
}

function layout(W: number, H: number): Placed[] {
  const placed: Placed[] = [];
  let key = 0;
  TIERS.forEach((tier, t) => {
    const tiles = tile(tier.items.length, W, H);
    // The page minimizes just before the next one starts, so each new grid opens on its downbeat.
    const next = TIERS[t + 1]?.start ?? CLEAR + 6;
    tier.items.forEach((item, i) => {
      const { x, y, tw, th } = tiles[i];
      // One size per grid, like XP's Tile Windows; a phone-shaped recording sits centred in it.
      const { w, h } = fit(tw, th, 16 / 9);
      placed.push({
        ...item,
        at: tier.start + i * tier.every,
        out: next - 6 + Math.floor((i * 4) / tier.items.length),
        x: Math.round(x + (tw - w) / 2),
        y: Math.round(y + (th - h) / 2),
        w,
        h,
        // Small windows get proportionally smaller chrome, so their titles still read.
        chrome: Math.min(1, Math.max(0.6, w / 360)),
        tier: t,
        // Decided per window, so nothing freezes mid-play: the densest page alternates.
        live: Boolean(item.clip) && (t < 2 || i % 2 === 0),
        key: key++,
      });
    });
  });
  return placed;
}

/** "your" on the final hit, "turn." a beat later: words land one at a time. */
function YourTurn({ at, size }: { at: number; size: number }) {
  const frame = useCurrentFrame();
  const words = ["your", "turn."];
  return (
    <div className="welcome-type" style={{ fontSize: size, textAlign: "center" }}>
      {words.map((word, i) => {
        const start = at + i * BEAT;
        if (frame < start) return null;
        const t = progress(frame, start, 5, easeOut);
        return (
          <span key={word} style={{ display: "inline-block", transform: `translateY(${(1 - t) * size * 0.12}px) scale(${0.96 + 0.04 * t})`, opacity: 0.3 + 0.7 * t }}>
            {word}
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </div>
  );
}

export function Overload() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const windows = layout(W, H);
  const open = windows.filter((win) => frame >= win.at);
  const taskX = portrait ? 200 : 420;
  const total = windows.length;

  const recent = open.slice(-4).map((win) => ({ title: win.title, icon: asset("desktop/projects.webp") }));
  const tasks = frame < CLEAR + 8 && open.length
    ? [...(open.length > 4 ? [{ title: `${open.length - 4} more windows`, icon: asset("desktop/projects.webp") }] : []), ...recent.map((t, i) => ({ ...t, active: i === recent.length - 1 }))]
    : [];

  return (
    <Desktop tasks={tasks}>
      {windows.map((win, n) => (
        <AppWindow
          key={win.key}
          x={win.x}
          y={win.y}
          w={win.w}
          h={win.h}
          at={win.at}
          out={win.out}
          taskX={taskX}
          chromeScale={win.chrome}
          title={win.title}
          icon={asset("desktop/projects.webp")}
          active={n === open.length - 1}
          bodyStyle={{ background: "#0b0b0b" }}
        >
          {win.still ? (
            <Still id={win.still} />
          ) : win.live ? (
            <Clip id={win.clip as ClipId} thumb={win.tier === 2} from={win.from ?? 0} />
          ) : (
            <Img src={posterOf(win.clip as ClipId)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
          )}
        </AppWindow>
      ))}
      <AppWindow
        x={(W - (portrait ? 320 : 360)) / 2}
        y={(H - 30 - 150) / 2}
        w={portrait ? 320 : 360}
        h={150}
        at={DIALOG}
        out={CLEAR - 4}
        exit="close"
        buttons="close"
        title="MaxXP"
        icon={asset("tray/info.webp")}
        bodyStyle={{ background: "#ece9d8" }}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "center", padding: "18px 18px 0", fontSize: 13 }}>
          <Img src={asset("tray/info.webp")} style={{ width: 32, height: 32 }} />
          <span>You have {total} windows open.</span>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 14, display: "grid", placeItems: "center" }}>
          <XPButton state={frame >= CLEAR - 6 ? "pressed" : "default"} width={84}>OK</XPButton>
        </div>
      </AppWindow>
      {TIERS.slice(1).map((tier) => <Sfx key={tier.start} at={tier.start - 6} name="minimize" volume={0.35} />)}
      <Sfx at={DIALOG} name="exclamation" volume={0.5} />
      <Sfx at={CLEAR - 6} name="minimize" volume={0.6} />
      {frame >= CLEAR + BEAT - 2 ? (
        <AbsoluteFill style={{ display: "grid", placeItems: "center", opacity: 1 - progress(frame, BAR * 8 - 12, 12) }}>
          <YourTurn at={CLEAR + BEAT} size={portrait ? 60 : 84} />
        </AbsoluteFill>
      ) : null}
    </Desktop>
  );
}
