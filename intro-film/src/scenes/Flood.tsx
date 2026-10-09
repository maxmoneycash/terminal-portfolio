import { Img, useCurrentFrame } from "remotion";
import { beats } from "../beat";
import { caretVisible, easeIn, easeOut, progress, typed, typingLength } from "../lib";
import { asset, Camera, Clip, Cursor, Desktop, Sfx, useOrientation, Window, WindowStamp, XPButton } from "../xp";

/** Every recording in the film: the Demo Reel set plus Lilyshark, commits.sh and yank. */
export const ALL_DEMOS = [
  ["aptos-vs-megaeth", "Aptos vs MegaETH"],
  ["sol2move-boringvault", "Sol2Move - BoringVault"],
  ["aptos-block-machine", "Aptos Block Machine"],
  ["nipahscan", "NipahScan"],
  ["aptos-hft-demo", "Aptos HFT demo"],
  ["decibrrr-live", "Decibrrr, live on Decibel"],
  ["seam-dex", "Seam"],
  ["aptos-velociraptr", "Aptos Velociraptr"],
  ["aptos-load-test", "Aptos testnet under load"],
  ["sol2move-generated-code", "Sol2Move - generated Move"],
  ["fee-market-simulator", "Fee markets under load"],
  ["shelby-pulse", "Shelby Pulse"],
  ["peptide-tracker", "Peptide tracker"],
  ["decibrrr-points", "Decibrrr"],
  ["wick-markets-ride", "Wick Markets: Ride"],
  ["emoji-candlestick-charts", "Emoji Candlestick Charts"],
  ["temper-trade", "Temper Trade"],
  ["aptos-validator-globe", "Aptos validator globe"],
  ["maxxp-desktop", "MaxXP: live developer stats"],
  ["commits-sh-menubar", "commits.sh in the menu bar"],
  ["aptos-vs-megaeth-rerun", "Aptos vs MegaETH, another run"],
  ["sol2move-first-run", "Sol2Move, first run"],
  ["aptos-testnet-nodes", "Aptos testnet node comparison"],
  ["lilyshark-intro", "Lilyshark"],
  ["lilyshark-traffic", "Lilyshark - traffic"],
  ["commits-sh-popover", "commits.sh - menu bar"],
  ["commits-sh-ticker", "commits.sh - $MAXMONEYCASH"],
  ["yank-clone", "yank - getone.one"],
  ["yank-apart", "yank - pulling the page apart"],
  ["devenv-timelapse", "claude ~/RF-SIGINT - timelapse"],
] as const;

const LINE = "Close all your windows";

/**
 * "You have 30 windows open." OK opens every demo at once; a giant title bar
 * types the order to close them, a giant cursor obeys, and the desktop clears.
 */
export function Flood() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const OK = beats(1) - 4;
  const dialogOpen = frame < OK + 3;

  // From beat 1, windows open with an accelerating rhythm.
  const opens: number[] = [];
  let t = beats(1);
  for (let i = 0; i < ALL_DEMOS.length; i += 1) {
    opens.push(Math.round(t));
    t += Math.max(0.8, 2.4 - i * 0.08);
  }
  const allOpen = opens[opens.length - 1];
  const TITLE = allOpen + 2;
  const typedLine = typed(LINE, frame, TITLE + 2, 40);
  const CURSOR_IN = TITLE + 2 + typingLength(LINE, 40) + 1;
  // The giant cursor closes everything on beat 6.
  const CLICK = beats(6);
  const closeStep = 0.4; // frames per window while closing
  const closedAll = CLICK + 3 + ALL_DEMOS.length * closeStep;

  const ww = portrait ? 380 : 620;
  const wh = portrait ? 290 : 400;
  const stepX = portrait ? 6 : 26;
  const stepY = portrait ? 24 : 18;
  const place = (i: number) => {
    const col = Math.floor(i / (portrait ? 24 : 12));
    const k = i % (portrait ? 24 : 12);
    return portrait
      ? { x: 10 + k * stepX + col * 40, y: 16 + k * stepY }
      : { x: 40 + k * stepX + col * 300, y: 20 + k * stepY + col * 24 };
  };

  const big = portrait
    ? { x: 12, y: 80, w: W - 24, h: 64, scale: 1.55 }
    : { x: 44, y: 64, w: 760, h: 84, scale: 2.4 };
  const bigClose = { x: big.x + big.w - 16.5 * big.scale, y: big.y + 15 * big.scale };
  const showBig = frame >= TITLE && frame < closedAll + 2;

  const shake = progress(frame, OK, allOpen - OK) * (1 - progress(frame, CLICK, 4)) * 1.6;

  return (
    <Camera
      shake={shake}
      keys={[
        { f: 0, v: { x: W / 2, y: H / 2, z: 1.02 } },
        { f: allOpen, v: { x: W / 2, y: H / 2, z: 1.06 }, ease: easeIn },
        { f: CLICK, v: { x: W / 2, y: H / 2, z: 1.06 } },
        { f: closedAll + 10, v: { x: W / 2, y: H / 2, z: 1 }, ease: easeOut },
      ]}
    >
      <Desktop tasks={frame >= OK && frame < closedAll ? [{ title: `${opens.filter((o) => frame >= o).length} windows`, active: true }] : []}>
        {ALL_DEMOS.map(([id, title], i) => {
          if (frame < opens[i]) return null;
          const closeAt = CLICK + 3 + (ALL_DEMOS.length - 1 - i) * closeStep;
          if (frame >= closeAt) return null;
          const p = place(i);
          // Only the top few windows show live video; the rest are covered.
          const live = i >= ALL_DEMOS.length - 4 || opens[i + 4] === undefined || frame < opens[i + 4];
          return live ? (
            <Window key={id} x={p.x} y={p.y} w={ww} h={wh} title={title} icon={asset("desktop/projects.webp")} active={i === ALL_DEMOS.length - 1 || frame < (opens[i + 1] ?? 1e9)} bodyStyle={{ background: "#111" }}>
              <Clip id={id} thumb={portrait} from={0.3} />
            </Window>
          ) : (
            <WindowStamp key={id} id={id} x={p.x} y={p.y} w={ww} h={wh} title={title} active={false} />
          );
        })}

        <Sfx at={0} name="ding" volume={0.55} />
        <Sfx at={OK} name="start" volume={0.7} />
        {opens.map((o, i) => <Sfx key={`pop-${i}`} at={o} name="balloon" volume={0.25 + 0.015 * i} />)}
        <Sfx at={CLICK} name="start" volume={0.9} />
        <Sfx at={CLICK + 2} name="minimize" volume={0.6} />
        {dialogOpen ? (
          <Window
            x={(W - 300) / 2}
            y={(H - 30 - 150) / 2}
            w={300}
            h={140}
            title="MaxXP"
            buttons="close"
            bodyStyle={{ background: "#ece9d8", padding: "16px 16px", fontSize: 13 }}
          >
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <Img src={asset("tray/info.webp")} style={{ width: 34, height: 34 }} />
              <span>You have {ALL_DEMOS.length} windows open.</span>
            </div>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 12, display: "flex", justifyContent: "center" }}>
              <XPButton state={frame >= OK ? "pressed" : frame >= OK - 8 ? "hot" : "default"}>OK</XPButton>
            </div>
          </Window>
        ) : null}

        {showBig ? (
          <div style={{ position: "absolute", left: big.x, top: big.y, width: big.w / big.scale, height: big.h / big.scale, transform: `scale(${big.scale})`, transformOrigin: "0 0" }}>
            <Window
              x={0}
              y={0}
              w={big.w / big.scale}
              h={big.h / big.scale}
              title={typedLine}
              titleCaret={frame < CLICK}
              closeState={frame >= CLICK ? "pressed" : frame >= CLICK - 8 ? "hot" : undefined}
              style={{ background: "transparent", boxShadow: "0 10px 26px rgb(0 18 70 / 0.4)" }}
            />
          </div>
        ) : null}

        {frame < OK + 24 ? (
          <Cursor
            path={[
              { f: 0, v: { x: W * 0.72, y: H * 0.78 } },
              { f: OK - 4, v: { x: W / 2 + 4, y: (H - 30 - 150) / 2 + 140 - 22 } },
              { f: OK + 24, v: { x: W / 2 + 60, y: H * 0.7 } },
            ]}
            clicks={[OK]}
          />
        ) : null}
        {frame >= CURSOR_IN - 2 && frame < closedAll + 18 ? (
          <Cursor
            size={portrait ? 96 : 150}
            path={[
              { f: CURSOR_IN - 2, v: { x: W + 40, y: H * 0.9 } },
              { f: CLICK - 2, v: { x: bigClose.x, y: bigClose.y }, ease: easeOut },
              { f: closedAll + 18, v: { x: bigClose.x + 40, y: bigClose.y + 90 } },
            ]}
            clicks={[CLICK]}
          />
        ) : null}
      </Desktop>
    </Camera>
  );
}
