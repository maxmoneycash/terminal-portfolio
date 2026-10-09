import { useCurrentFrame } from "remotion";
import { beats } from "../beat";
import { easeInOut, easeOut } from "../lib";
import { asset, Camera, Clip, Desktop, Sfx, shotOf, Still, useOrientation, wide, Window } from "../xp";
import { ViewerToolbar } from "./Pictures";

const SITE = 1.61; // lilyshark recordings, width / height
const PHOTO = 1.65; // the T-Deck traffic screenshot

/**
 * The hardware the balloon announced: the Lilyshark site, its live traffic
 * view, then a photo of the analyzer running on two T-Decks.
 */
export function Lilyshark() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const TRAFFIC = beats(2);
  const PHOTO_AT = beats(5);

  // Address-bar chrome only: title 30 + address 25 + status 21 + frame 3.
  const site = portrait
    ? { x: 6, y: 10, w: W - 12, h: Math.round((W - 18) / SITE) + 79 }
    : { x: 16, y: 10, w: Math.round((H - 30 - 20 - 79) * SITE) + 6, h: H - 30 - 20 };
  const traffic = portrait
    ? { x: 6, y: 330, w: W - 12, h: Math.round((W - 18) / SITE) + 33 }
    : { x: 470, y: 140, w: 790, h: Math.round(784 / SITE) + 33 };
  const photo = portrait
    ? { x: 18, y: 560, w: W - 36, h: Math.round((W - 42) / PHOTO) + 33 + 34 }
    : { x: 120, y: 268, w: 560, h: Math.round(554 / PHOTO) + 33 + 34 };

  return (
    <Camera
      keys={[
        { f: 0, v: shotOf(site, W, H, portrait) },
        { f: TRAFFIC, v: shotOf(site, W, H, portrait) },
        { f: TRAFFIC + 10, v: shotOf(traffic, W, H, portrait), ease: easeOut },
        { f: PHOTO_AT, v: shotOf(traffic, W, H, portrait), ease: easeInOut },
        { f: PHOTO_AT + 10, v: shotOf(photo, W, H, portrait), ease: easeOut },
        { f: beats(8), v: wide(W, H), ease: easeInOut },
      ]}
    >
      <Desktop
        tasks={[
          { title: "Lilyshark - Mesh Radio Analyzer", icon: asset("desktop/projects.webp"), active: frame < TRAFFIC },
          ...(frame >= TRAFFIC ? [{ title: "Lilyshark - [TRAFFIC]", active: frame < PHOTO_AT }] : []),
          ...(frame >= PHOTO_AT ? [{ title: "t-deck.png", active: true }] : []),
        ]}
      >
        <Window
          {...site}
          appear={0}
          title="Lilyshark - Mesh Radio Analyzer - MaxXP Internet Explorer"
          icon={asset("desktop/projects.webp")}
          active={frame < TRAFFIC}
          chrome={{ address: "http://lilyshark.com/", status: "Done" }}
          bodyStyle={{ background: "#f7e4ee" }}
        >
          <Clip id="lilyshark-intro" />
        </Window>
        {frame >= TRAFFIC ? (
          <Window {...traffic} appear={TRAFFIC} title="Lilyshark - [TRAFFIC] - sample-mesh-traffic.lscap" icon={asset("desktop/projects.webp")} active={frame < PHOTO_AT} bodyStyle={{ background: "#f7e4ee" }}>
            <Clip id="lilyshark-traffic" />
          </Window>
        ) : null}
        {frame >= PHOTO_AT ? (
          <Window {...photo} appear={PHOTO_AT} title="t-deck.png - Windows Picture and Fax Viewer" icon={asset("start-menu/photos.webp")} bodyStyle={{ background: "#fff", display: "flex", flexDirection: "column" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Still id="lilyshark-traffic" />
            </div>
            <ViewerToolbar small />
          </Window>
        ) : null}
        <Sfx at={TRAFFIC} name="restore" volume={0.4} />
        <Sfx at={PHOTO_AT} name="restore" volume={0.4} />
      </Desktop>
    </Camera>
  );
}
