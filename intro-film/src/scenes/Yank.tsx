import { Img, useCurrentFrame } from "remotion";
import { easeInOut, easeOut, progress } from "../lib";
import { asset, Camera, Clip, Cursor, Desktop, Sfx, useOrientation, Window } from "../xp";

const CLIP = 3372 / 1988;

/** MSN Messenger's slide-up toast from the tray. */
function MessengerToast({ x, y, w, rise }: { x: number; y: number; w: number; rise: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        border: "1px solid #3d6cc0",
        borderRadius: 3,
        background: "linear-gradient(180deg, #ffffff 0%, #e4edfc 55%, #c9dbf8 100%)",
        boxShadow: "2px 3px 8px rgb(0 20 80 / 0.35)",
        transform: `translateY(${(1 - rise) * 130}px)`,
        overflow: "hidden",
      }}
    >
      <div style={{ height: 18, padding: "0 6px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(180deg, #5b8fe2, #2b5fc6)", color: "#fff", fontSize: 11, fontWeight: 700 }}>
        <span>MSN Messenger</span>
        <span style={{ fontWeight: 400 }}>×</span>
      </div>
      <div style={{ display: "flex", gap: 10, padding: "10px 10px 12px" }}>
        <Img src={asset("start-menu/messenger.webp")} style={{ width: 36, height: 36, flex: "none" }} />
        <div style={{ fontSize: 12, lineHeight: 1.35 }}>
          <div><b>yank</b> says:</div>
          <div>Clone this website</div>
          <div style={{ color: "#1a4fc4", textDecoration: "underline" }}>https://getone.one/</div>
        </div>
      </div>
    </div>
  );
}

/**
 * yank, the website cloner: a Messenger toast asks for a clone, the real
 * recording plays in IE, then a second window pulls the page apart.
 */
export function Yank() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const CLICK = 22;
  const OPEN = CLICK + 2;
  const APART = 60;

  const tw = portrait ? 250 : 236;
  const toast = { x: W - tw - 6, y: H - 30 - 104 };
  const rise = progress(frame, 2, 9, easeOut);

  const one = portrait
    ? { x: 6, y: 200, w: W - 12, h: Math.round((W - 18) / CLIP) + 79 }
    : { x: 16, y: 10, w: 900, h: Math.round(894 / CLIP) + 79 };
  const two = portrait
    ? { x: 18, y: one.y + 230, w: W - 36, h: Math.round((W - 42) / CLIP) + 33 }
    : { x: 400, y: 150, w: 860, h: Math.round(854 / CLIP) + 33 };

  return (
    <Camera
      keys={[
        { f: 0, v: { x: toast.x + tw / 2, y: toast.y + 40, z: portrait ? 1.4 : 1.7 } },
        { f: OPEN, v: { x: toast.x + tw / 2, y: toast.y + 40, z: portrait ? 1.4 : 1.7 } },
        { f: OPEN + 14, v: { x: W / 2, y: H / 2, z: 1 }, ease: easeOut },
        { f: APART - 2, v: { x: one.x + one.w * 0.55, y: one.y + one.h * 0.5, z: portrait ? 1.15 : 1.12 }, ease: easeInOut },
        { f: APART + 16, v: { x: two.x + two.w * 0.45, y: two.y + two.h * 0.5, z: portrait ? 1.2 : 1.32 }, ease: easeOut },
        { f: 118, v: { x: two.x + two.w * 0.45, y: two.y + two.h * 0.5, z: portrait ? 1.24 : 1.38 } },
      ]}
    >
      <Desktop
        tasks={[
          ...(frame >= OPEN ? [{ title: "getone.one - yank", icon: asset("desktop/projects.webp"), active: frame < APART }] : []),
          ...(frame >= APART ? [{ title: "getone.one - pulling apart", active: true }] : []),
        ]}
      >
        {frame >= OPEN ? (
          <Window
            {...one}
            title="getone.one - yank - MaxXP Internet Explorer"
            icon={asset("desktop/projects.webp")}
            active={frame < APART}
            chrome={{ address: "http://yank.design/", status: "Comparing the copy with the live page..." }}
            bodyStyle={{ background: "#3b6fd0" }}
          >
            <Clip id="yank-clone" from={0.2} />
          </Window>
        ) : null}
        {frame >= APART ? (
          <Window {...two} title="getone.one - Pulling the page apart - yank" icon={asset("desktop/projects.webp")} bodyStyle={{ background: "#3b6fd0" }}>
            <Clip id="yank-apart" from={0.3} />
          </Window>
        ) : null}
        {frame < OPEN + 2 ? <MessengerToast {...toast} w={tw} rise={rise} /> : null}
        <Sfx at={2} name="messenger" volume={0.6} />
        <Sfx at={CLICK} name="start" volume={0.7} />
        <Sfx at={APART} name="restore" volume={0.4} />
        <Cursor
          path={[
            { f: 0, v: { x: W * 0.55, y: H * 0.55 } },
            { f: CLICK - 4, v: { x: toast.x + tw * 0.45, y: toast.y + 66 } },
            { f: 118, v: { x: W * 0.7, y: H * 0.35 } },
          ]}
          clicks={[CLICK]}
        />
      </Desktop>
    </Camera>
  );
}
