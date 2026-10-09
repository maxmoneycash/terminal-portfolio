import { useCurrentFrame } from "remotion";
import { easeInOut, easeOut } from "../lib";
import { asset, Camera, Clip, Desktop, Sfx, Still, useOrientation, Window } from "../xp";
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
  const TRAFFIC = 34;
  const PHOTO_AT = 66;

  // Address-bar chrome only: title 30 + address 25 + status 21 + frame 3.
  const site = portrait
    ? { x: 6, y: 10, w: W - 12, h: Math.round((W - 18) / SITE) + 79 }
    : { x: 16, y: 10, w: Math.round((H - 30 - 20 - 79) * SITE) + 6, h: H - 30 - 20 };
  const traffic = portrait
    ? { x: 6, y: 330, w: W - 12, h: Math.round((W - 18) / SITE) + 33 }
    : { x: 470, y: 140, w: 790, h: Math.round(784 / SITE) + 33 };
  const photo = portrait
    ? { x: 18, y: 560, w: W - 36, h: Math.round((W - 42) / PHOTO) + 33 + 34 }
    : { x: 120, y: 300, w: 560, h: Math.round(554 / PHOTO) + 33 + 34 };

  return (
    <Camera
      keys={[
        // Open on the hero copy being typed, then step back.
        { f: 0, v: { x: site.x + site.w * 0.24, y: site.y + site.h * 0.42, z: portrait ? 1.6 : 1.7 } },
        { f: 26, v: { x: W / 2, y: H / 2, z: 1 }, ease: easeOut },
        { f: TRAFFIC + 18, v: { x: traffic.x + traffic.w * 0.5, y: traffic.y + traffic.h * 0.45, z: portrait ? 1.1 : 1.25 }, ease: easeInOut },
        { f: PHOTO_AT + 14, v: { x: photo.x + photo.w * 0.5, y: photo.y + photo.h * 0.5, z: portrait ? 1.12 : 1.4 }, ease: easeInOut },
        { f: 110, v: { x: photo.x + photo.w * 0.5, y: photo.y + photo.h * 0.48, z: portrait ? 1.16 : 1.46 } },
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
          title="Lilyshark - Mesh Radio Analyzer - MaxXP Internet Explorer"
          icon={asset("desktop/projects.webp")}
          active={frame < TRAFFIC}
          chrome={{ address: "http://lilyshark.com/", status: "Done" }}
          bodyStyle={{ background: "#f7e4ee" }}
        >
          <Clip id="lilyshark-intro" />
        </Window>
        {frame >= TRAFFIC ? (
          <Window {...traffic} title="Lilyshark - [TRAFFIC] - sample-mesh-traffic.lscap" icon={asset("desktop/projects.webp")} active={frame < PHOTO_AT} bodyStyle={{ background: "#f7e4ee" }}>
            <Clip id="lilyshark-traffic" />
          </Window>
        ) : null}
        {frame >= PHOTO_AT ? (
          <Window {...photo} title="t-deck.png - Windows Picture and Fax Viewer" icon={asset("start-menu/photos.webp")} bodyStyle={{ background: "#fff", display: "flex", flexDirection: "column" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Still id="lilyshark-traffic" fit="cover" position="0% 0%" />
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
