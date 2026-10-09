import { useCurrentFrame } from "remotion";
import { beats } from "../beat";
import { caretVisible, easeInOut, progress, typed } from "../lib";
import { asset, Camera, Clip, clipRatio, Desktop, Sfx, shotOf, useOrientation, wide, Window } from "../xp";

const URL = "aptos-polymarket.vercel.app";
// IE chrome: title 30 + menu 21 + toolbar 38 + address 25 + status 21 + frame 3.
const CHROME = 138;

/**
 * The URL is typed into Internet Explorer and Enter lands on beat 2: the
 * benchmark fills a window shaped like the recording, the desktop around it.
 */
export function Aptos() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const ENTER = beats(2);
  const loaded = frame >= ENTER;
  const address = typed(URL, frame, 2, 45);

  const body = portrait
    ? { w: W - 18, h: Math.round((W - 18) / clipRatio("aptos-vs-megaeth")) }
    : { h: H - 30 - 16 - CHROME, w: Math.round((H - 30 - 16 - CHROME) * clipRatio("aptos-vs-megaeth")) };
  const win = { x: Math.round((W - body.w - 6) / 2), y: portrait ? 200 : 8, w: body.w + 6, h: body.h + CHROME };

  return (
    <Camera
      keys={[
        { f: 0, v: shotOf(win, W, H, portrait) },
        { f: beats(6), v: shotOf(win, W, H, portrait) },
        { f: beats(8), v: wide(W, H), ease: easeInOut },
      ]}
    >
      <Desktop tasks={[{ title: loaded ? "Aptos vs MegaETH" : "about:blank", icon: asset("desktop/projects.webp"), active: true }]}>
        <Sfx at={ENTER - 2} name="start" volume={0.7} />
        <Window
          {...win}
          appear={0}
          title={loaded ? "Aptos vs MegaETH - MaxXP Internet Explorer" : "about:blank - MaxXP Internet Explorer"}
          icon={asset("desktop/projects.webp")}
          chrome={{
            menu: ["File", "Edit", "View", "Favorites", "Tools", "Help"],
            toolbar: true,
            address: (
              <span>
                http://{address}
                {frame < ENTER ? <span style={{ opacity: caretVisible(frame) ? 1 : 0 }}>|</span> : null}
              </span>
            ),
            status: (
              <span style={{ display: "flex", width: "100%", justifyContent: "space-between" }}>
                <span>{loaded ? "Done" : "Opening page http://" + address + "..."}</span>
                <span>Internet</span>
              </span>
            ),
          }}
          bodyStyle={{ background: loaded ? "#0b0d12" : "#fff" }}
        >
          {loaded ? <Clip id="aptos-vs-megaeth" from={0.4} style={{ opacity: progress(frame, ENTER, 3) }} /> : null}
        </Window>
      </Desktop>
    </Camera>
  );
}
