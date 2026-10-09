import { useCurrentFrame } from "remotion";
import { easeInOut, easeOut, progress } from "../lib";
import { asset, Camera, Cursor, Desktop, Sfx, Still, stillRatio, useOrientation, Window } from "../xp";

/**
 * gadgets.sh, right after the T-Deck: the hardware catalog scrolls in
 * Internet Explorer, then a product card opens in its own window.
 */
export function Gadgets() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const CLICK = 58;
  const CARD = CLICK + 3;
  const scroll = progress(frame, 18, 36, easeInOut);

  // Address bar + status only: title 30, address 25, status 21, frame 3.
  const chrome = 79;
  const catalog = portrait
    ? { x: 6, y: 230, w: W - 12, h: Math.round((W - 18) / stillRatio("gadgets-catalog")) + chrome }
    : { x: 0, y: 0, w: W, h: H - 30 };
  const cardW = portrait ? W - 60 : 380;
  const cardH = Math.round((cardW - 6) / stillRatio("gadgets-huskylens")) + 33;
  const card = portrait
    ? { x: 30, y: Math.max(8, Math.round((H - 30 - cardH) / 2)), w: cardW, h: cardH }
    : { x: W - cardW - 40, y: 18, w: cardW, h: Math.min(cardH, H - 30 - 30) };
  // The T-Deck Plus card: second of the four product cards.
  const target = portrait
    ? { x: catalog.x + catalog.w * 0.42, y: catalog.y + 30 + 25 + (catalog.h - chrome) * 0.62 }
    : { x: W * 0.4, y: H * 0.62 };

  return (
    <Camera
      keys={portrait
        ? [
            { f: 0, v: { x: W * 0.36, y: catalog.y + 100, z: 1.7 } },
            { f: 24, v: { x: W / 2, y: H / 2, z: 1 }, ease: easeOut },
            { f: CARD + 16, v: { x: card.x + card.w / 2, y: card.y + card.h * 0.42, z: 1.12 }, ease: easeOut },
            { f: 105, v: { x: card.x + card.w / 2, y: card.y + card.h * 0.45, z: 1.16 } },
          ]
        : [
            { f: 0, v: { x: W * 0.3, y: H * 0.3, z: 2.0 } },
            { f: 22, v: { x: W / 2, y: H / 2, z: 1 }, ease: easeOut },
            { f: CARD + 16, v: { x: card.x + card.w / 2 - 80, y: H * 0.45, z: 1.3 }, ease: easeOut },
            { f: 105, v: { x: card.x + card.w / 2 - 60, y: H * 0.46, z: 1.36 } },
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
          style={portrait ? undefined : { borderRadius: 0 }}
          titleStyle={portrait ? undefined : { borderRadius: 0 }}
          title="gadgets.sh - Find your next gadget - MaxXP Internet Explorer"
          icon={asset("desktop/projects.webp")}
          active={frame < CARD}
          chrome={{ address: "http://gadgets.sh/devices", status: frame < CARD ? "Done" : "Opening page http://gadgets.sh/d/huskylens-2..." }}
          bodyStyle={{ background: "#141414" }}
        >
          <Still id="gadgets-catalog" fit="cover" position={`50% ${portrait ? 0 : scroll * 100}%`} />
        </Window>
        {frame >= CARD ? (
          <Window {...card} title="HUSKYLENS 2 - gadgets.sh" icon={asset("desktop/projects.webp")} bodyStyle={{ background: "#141414" }} style={{ opacity: progress(frame, CARD, 3) }}>
            <Still id="gadgets-huskylens" fit="cover" position="50% 0%" />
          </Window>
        ) : null}
        <Sfx at={CLICK} name="start" volume={0.7} />
        <Sfx at={CARD} name="restore" volume={0.4} />
        <Cursor
          path={[
            { f: 0, v: { x: W * 0.62, y: H * 0.3 } },
            { f: CLICK - 6, v: target },
            { f: 105, v: { x: target.x + 20, y: target.y + 40 } },
          ]}
          kind="hand"
          clicks={[CLICK]}
        />
      </Desktop>
    </Camera>
  );
}
