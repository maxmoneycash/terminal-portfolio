import { useCurrentFrame } from "remotion";
import { beats } from "../beat";
import { easeInOut, easeOut, progress } from "../lib";
import { asset, Camera, Cursor, Desktop, Sfx, shotOf, Still, stillRatio, useOrientation, wide, Window } from "../xp";

/**
 * gadgets.sh, right after the T-Deck: the hardware catalog in Internet
 * Explorer, then the cursor opens a product page in its own window on beat 4.
 * Both windows take their screenshot's shape, so nothing is cut off.
 */
export function Gadgets() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const CARD = beats(2);
  const CLICK = CARD - 3;

  // Address bar + status only: title 30, address 25, status 21, frame 3.
  const chrome = 79;
  const catalogBody = portrait
    ? { w: W - 18, h: Math.round((W - 18) / stillRatio("gadgets-catalog")) }
    : { h: H - 30 - 16 - chrome, w: Math.round((H - 30 - 16 - chrome) * stillRatio("gadgets-catalog")) };
  const catalog = { x: portrait ? 6 : 16, y: portrait ? 150 : 8, w: catalogBody.w + 6, h: catalogBody.h + chrome };

  const cardBody = portrait
    ? { w: W - 66, h: Math.round((W - 66) / stillRatio("gadgets-huskylens")) }
    : { h: H - 30 - 24 - 33, w: Math.round((H - 30 - 24 - 33) * stillRatio("gadgets-huskylens")) };
  const card = portrait
    ? { x: 30, y: Math.max(8, Math.round((H - 30 - cardBody.h - 33) / 2)), w: cardBody.w + 6, h: cardBody.h + 33 }
    : { x: W - cardBody.w - 6 - 24, y: 12, w: cardBody.w + 6, h: cardBody.h + 33 };
  // The T-Deck Plus card: second of the four product cards.
  const target = { x: catalog.x + 3 + catalogBody.w * 0.4, y: catalog.y + 55 + catalogBody.h * 0.62 };

  return (
    <Camera
      keys={[
        { f: 0, v: shotOf(catalog, W, H, portrait) },
        { f: CLICK, v: shotOf(catalog, W, H, portrait), ease: easeInOut },
        { f: CARD + 10, v: shotOf(card, W, H, portrait), ease: easeOut },
        { f: beats(4), v: wide(W, H), ease: easeInOut },
      ]}
    >
      <Desktop
        tasks={[
          { title: "gadgets.sh - MaxXP Internet Explorer", icon: asset("desktop/projects.webp"), active: frame < CARD },
          ...(frame >= CARD ? [{ title: "HUSKYLENS 2 - gadgets.sh", active: true }] : []),
        ]}
      >
        <Window
          {...catalog}
          appear={0}
          title="gadgets.sh - Find your next gadget - MaxXP Internet Explorer"
          icon={asset("desktop/projects.webp")}
          active={frame < CARD}
          chrome={{ address: "http://gadgets.sh/devices", status: frame < CARD ? "Done" : "Opening page http://gadgets.sh/d/huskylens-2..." }}
          bodyStyle={{ background: "#141414" }}
        >
          <Still id="gadgets-catalog" />
        </Window>
        {frame >= CARD ? (
          <Window {...card} appear={CARD} title="HUSKYLENS 2 - gadgets.sh" icon={asset("desktop/projects.webp")} bodyStyle={{ background: "#141414" }} style={{ opacity: progress(frame, CARD, 3) }}>
            <Still id="gadgets-huskylens" />
          </Window>
        ) : null}
        <Sfx at={CLICK} name="start" volume={0.7} />
        <Sfx at={CARD} name="restore" volume={0.4} />
        <Cursor
          path={[
            { f: 0, v: { x: W * 0.62, y: H * 0.3 } },
            { f: CLICK - 6, v: target },
            { f: beats(4), v: { x: target.x + 20, y: target.y + 40 } },
          ]}
          kind="hand"
          clicks={[CLICK]}
        />
      </Desktop>
    </Camera>
  );
}
