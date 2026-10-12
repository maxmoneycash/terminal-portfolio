/** The closing acceleration: large pairs on the beat, then the desktop handoff. */
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { useWebPlayback } from "../playback";
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
function Media({ item }: { item: Item }) {
  return item.clip ? <Clip id={item.clip} thumb /> : <Still id={item.still!} />;
}

export function Overload() {
  const frame = useCurrentFrame();
  const web = useWebPlayback();
  const { W, H, portrait } = useOrientation();
  const page = Math.min(PAGES.length - 1, Math.floor(frame / BAR));
  const items = PAGES[page];
  const clear = PAGES.length * BAR;
  const tasks = frame < clear ? items.map(item => ({ title: item.title, icon: asset("desktop/projects.webp"), active: true })) : [];
  return (
    <Desktop tasks={tasks}>
      {PAGES.map((pair, pageIndex) => {
        const pairBoxes = mediaLayout(pair.map(ratioOf), W, H);
        return <Sequence key={pageIndex} from={pageIndex * BAR} durationInFrames={BAR} premountFor={web ? 60 : 0}>
          {pair.map((item, i) => <AppWindow key={i} {...pairBoxes[i]} at={i * 4} out={BAR - 7}
            title={item.title} icon={asset("desktop/projects.webp")} enter={i ? "right" : "left"}>
            <Media item={item} />
          </AppWindow>)}
        </Sequence>;
      })}
      {PAGES.map((_, i) => <Sfx key={i} at={i * BAR} name="minimize" volume={0.18} />)}
      <Sfx at={clear - 7} name="minimize" volume={0.5} />
      {frame >= clear && <AbsoluteFill style={{ display: "grid", placeItems: "center", opacity: 1 - progress(frame, (PAGES.length + 1) * BAR - 10, 10) }}>
        <div className="welcome-type" style={{ fontSize: portrait ? 62 : 92, textAlign: "center" }}>
          your{frame >= clear + BEAT ? " turn." : ""}
        </div>
      </AbsoluteFill>}
    </Desktop>
  );
}
