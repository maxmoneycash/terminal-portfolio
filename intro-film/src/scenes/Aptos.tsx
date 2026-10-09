import { useCurrentFrame } from "remotion";
import { caretVisible, easeInOut, easeOut, progress, typed } from "../lib";
import { asset, Camera, Clip, Desktop, Sfx, useOrientation, Window } from "../xp";

const URL = "aptos-polymarket.vercel.app";

/**
 * Extreme close-up on the address bar as the URL is typed, then a pull back
 * to the benchmark filling the whole screen.
 */
export function Aptos() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const ENTER = 30;
  const loaded = frame >= ENTER + 2;
  // The page paints once the camera has pulled back out of the close-up:
  // a full-size recording under a 3x zoom is the heaviest frame in the film.
  const painted = frame >= ENTER + 6;
  const address = typed(URL, frame, 3, 34);
  // The address field sits below the title bar, toolbar and menu.
  const fieldY = 30 + 21 + 38 + 12;
  // Left edge of the typed URL; the close-up keeps it in view as it grows.
  const textX = 80;
  const pan = progress(frame, ENTER + 6, 110, easeInOut);

  return (
    <Camera
      keys={[
        { f: 0, v: { x: textX + (portrait ? 70 : 105), y: fieldY, z: portrait ? 2.5 : 3.3 } },
        { f: ENTER - 2, v: { x: textX + (portrait ? 140 : 150), y: fieldY, z: portrait ? 2.4 : 3.0 } },
        { f: ENTER + 22, v: { x: W / 2, y: H / 2, z: 1 }, ease: easeOut },
        { f: 126, v: { x: portrait ? W / 2 : W * 0.4, y: H * 0.48, z: portrait ? 1.02 : 1.12 } },
      ]}
    >
      <Desktop tasks={[{ title: loaded ? "Aptos vs MegaETH" : "about:blank", icon: asset("desktop/projects.webp"), active: true }]}>
        <Sfx at={ENTER} name="start" volume={0.7} />
        <Window
          x={0}
          y={0}
          w={W}
          h={H - 30}
          style={{ borderRadius: 0 }}
          titleStyle={{ borderRadius: 0 }}
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
        >
          {painted ? (
            <Clip
              id="aptos-vs-megaeth"
              from={0.4}
              position={portrait ? `${pan * 100}% 0%` : "50% 0%"}
              style={{ opacity: progress(frame, ENTER + 6, 4) }}
            />
          ) : null}
        </Window>
      </Desktop>
    </Camera>
  );
}
