/** The closing acceleration: large pairs on the beat, then a brief XP cascade. */
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BAR, BEAT } from "../beat";
import { mediaLayout } from "../mediaLayout";
import { progress } from "../lib";
import { AppWindow, asset, Clip, clipRatio, Desktop, Sfx, Still, stillRatio, useOrientation } from "../xp";
import type clipManifest from "../../clips.json";
import type stillManifest from "../../stills.json";

type Item = { title: string; clip?: keyof typeof clipManifest.clips; still?: keyof typeof stillManifest.stills };
const PAGES: Item[][] = [
  [{ title: "Whop Finance", still: "whop-finance" }, { title: "Peptide Tracker", clip: "peptide-tracker" }],
  [{ title: "cash.trading", still: "cash-trading-btc" }, { title: "Wick Markets", clip: "wick-markets-ride" }],
  [{ title: "Content Rewards", still: "content-rewards" }, { title: "turbotokens", still: "turbotokens" }],
  [{ title: "Seam — liquidity", clip: "seam-dex" }, { title: "Shelby Pulse", clip: "shelby-pulse" }],
  [{ title: "Emoji Candlestick Charts", clip: "emoji-candlestick-charts" }, { title: "Temper Trade", clip: "temper-trade" }],
];
const ratioOf = (item: Item) => item.clip ? clipRatio(item.clip) : stillRatio(item.still!);
function Media({ item }: { item: Item }) { return item.clip ? <Clip id={item.clip} /> : <Still id={item.still!} />; }

export function Overload() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const page = Math.min(PAGES.length - 1, Math.floor(frame / BAR));
  const items = PAGES[page];
  const boxes = mediaLayout(items.map(ratioOf), W, H);
  const recap = frame >= PAGES.length * BAR;
  const clear = (PAGES.length + 1) * BAR;
  const tasks = frame < clear ? items.map(item => ({ title: item.title, icon: asset("desktop/projects.webp"), active: true })) : [];
  return (
    <Desktop tasks={tasks}>
      {!recap && items.map((item, i) => (
        <AppWindow key={`${page}-${i}`} {...boxes[i]} at={page * BAR + i * 4} out={(page + 1) * BAR - 7}
          title={item.title} icon={asset("desktop/projects.webp")} enter={i ? "right" : "left"}>
          <Media item={item} />
        </AppWindow>
      ))}
      {/* Only the recap overlaps: every one of these projects already had a large view. */}
      {recap && PAGES.flat().map((item, i) => {
        const ratio = ratioOf(item);
        const h = portrait ? 350 : 400;
        const w = Math.min(portrait ? W - 60 : 700, (h - 33) * ratio + 6);
        const height = (w - 6) / ratio + 33;
        return <AppWindow key={item.title} x={portrait ? 18 + i * 3 : 50 + i * 42} y={portrait ? 60 + i * 26 : 36 + i * 12}
          w={w} h={height} at={PAGES.length * BAR + i * 3} out={clear - 7} title={item.title} icon={asset("desktop/projects.webp")}>
          <Media item={item} />
        </AppWindow>;
      })}
      {PAGES.map((_, i) => <Sfx key={i} at={i * BAR} name="minimize" volume={0.18} />)}
      <Sfx at={clear - 7} name="minimize" volume={0.5} />
      {frame >= clear && <AbsoluteFill style={{ display: "grid", placeItems: "center", opacity: 1 - progress(frame, (PAGES.length + 2) * BAR - 10, 10) }}>
        <div className="welcome-type" style={{ fontSize: portrait ? 62 : 92, textAlign: "center" }}>
          your{frame >= clear + BEAT ? " turn." : ""}
        </div>
      </AbsoluteFill>}
    </Desktop>
  );
}
