import { Img, useCurrentFrame } from "remotion";
import { beats } from "../beat";
import { easeInOut } from "../lib";
import { asset, Camera, Clip, clipRatio, Cursor, Desktop, Sfx, shotOf, useOrientation, wide, Window, XPButton } from "../xp";

function FileRow({ name, detail, icon }: { name: string; detail: string; icon: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0 6px 38px" }}>
      <Img src={icon} style={{ width: 32, height: 32 }} />
      <div style={{ lineHeight: 1.4 }}>
        <b>{name}</b>
        <div style={{ color: "#333" }}>{detail}</div>
      </div>
    </div>
  );
}

/**
 * Sol2Move finishes a run; XP asks to replace the Solidity original with the
 * Move translation, and the cursor answers "Yes to All".
 */
export function Sol2Move() {
  const frame = useCurrentFrame();
  const { W, H, portrait } = useOrientation();
  const DIALOG = beats(1);
  const CLICK = beats(5);
  const dialogOpen = frame >= DIALOG && frame < CLICK + 4;
  const replaced = frame >= CLICK + 4;

  // The window takes the recording's shape, so the whole app stays in view.
  const ratio = clipRatio("sol2move-first-run");
  const body = portrait ? { w: W - 18, h: Math.round((W - 18) / ratio) } : { h: H - 30 - 16 - 33, w: Math.round((H - 30 - 16 - 33) * ratio) };
  const win = { x: Math.round((W - body.w - 6) / 2), y: portrait ? 150 : 8, w: body.w + 6, h: body.h + 33 };
  const dw = portrait ? 470 : 470;
  const dh = 286;
  const dx = (W - dw) / 2;
  const dy = portrait ? 420 : (H - 30 - dh) / 2 + 10;
  const yesAll = { x: dx + 192, y: dy + dh - 24 };

  return (
    <Camera
      keys={[
        { f: 0, v: shotOf(win, W, H, portrait) },
        { f: beats(8), v: wide(W, H), ease: easeInOut },
      ]}
    >
      <Desktop tasks={[{ title: replaced ? "BoringVault.move - Sol2Move" : "Sol2Move", icon: asset("start-menu/cmd.webp"), active: true }]}>
        <Window
          {...win}
          appear={0}
          title={replaced ? "BoringVault.move - Sol2Move" : "Sol2Move - Solidity to Move"}
          icon={asset("start-menu/cmd.webp")}
          active={!dialogOpen}
          bodyStyle={{ background: "#141414" }}
        >
          {replaced ? <Clip id="sol2move-generated-code" from={0.2} /> : <Clip id="sol2move-first-run" from={0.3} />}
        </Window>
        <Sfx at={DIALOG} name="exclamation" volume={0.55} />
        <Sfx at={CLICK} name="start" volume={0.7} />
        {dialogOpen ? (
          <Window
            x={dx}
            y={dy}
            w={dw}
            h={dh}
            title="Confirm File Replace"
            buttons="close"
            bodyStyle={{ background: "#ece9d8", padding: "12px 14px", fontSize: 12 }}
            appear={DIALOG}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Img src={asset("toolbar/folder.webp")} style={{ width: 30, height: 30 }} />
              <span>This folder already contains a file named &apos;BoringVault.sol&apos;.</span>
            </div>
            <div style={{ margin: "10px 0 0 40px" }}>Would you like to replace the existing file</div>
            <FileRow name="BoringVault.sol" detail="Solidity · Veda's vault contract" icon={asset("start-menu/notepad.webp")} />
            <div style={{ marginLeft: 40 }}>with this one?</div>
            <FileRow name="BoringVault.move" detail="Aptos Move · compile check passed" icon={asset("start-menu/notepad.webp")} />
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 10, display: "flex", justifyContent: "center", gap: 7 }}>
              <XPButton>Yes</XPButton>
              <XPButton state={frame >= CLICK ? "pressed" : frame >= CLICK - 14 ? "hot" : "default"}>Yes to All</XPButton>
              <XPButton>No</XPButton>
              <XPButton>Cancel</XPButton>
            </div>
          </Window>
        ) : null}
        <Cursor
          path={[
            { f: 0, v: { x: W * 0.8, y: H * 0.86 } },
            { f: DIALOG + 8, v: { x: W * 0.7, y: dy + dh + 40 } },
            { f: CLICK - 6, v: { x: yesAll.x + 10, y: yesAll.y + 4 } },
            { f: beats(8), v: { x: yesAll.x + 40, y: yesAll.y + 70 } },
          ]}
          clicks={[CLICK]}
        />
      </Desktop>
    </Camera>
  );
}
