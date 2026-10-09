import { Img, useCurrentFrame } from "remotion";
import { easeOut, progress } from "../lib";
import { asset, Camera, Clip, Cursor, Desktop, Sfx, useOrientation, Window, XPButton } from "../xp";

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
  const DIALOG = 22;
  const CLICK = 74;
  const dialogOpen = frame >= DIALOG && frame < CLICK + 4;
  const replaced = frame >= CLICK + 4;

  const win = portrait ? { x: 8, y: 14, w: W - 16, h: H - 30 - 28 } : { x: 40, y: 20, w: W - 80, h: H - 30 - 40 };
  const dw = portrait ? 470 : 470;
  const dh = 286;
  const dx = (W - dw) / 2;
  const dy = portrait ? 420 : (H - 30 - dh) / 2 + 10;
  const yesAll = { x: dx + 192, y: dy + dh - 24 };

  return (
    <Camera
      keys={[
        { f: 0, v: { x: W / 2, y: H / 2, z: 1.06 } },
        { f: DIALOG + 10, v: { x: dx + dw / 2, y: dy + dh / 2, z: portrait ? 1.1 : 1.32 }, ease: easeOut },
        { f: CLICK, v: { x: dx + dw / 2, y: dy + dh / 2 + 10, z: portrait ? 1.14 : 1.4 } },
        { f: CLICK + 16, v: { x: W / 2, y: H / 2, z: 1.04 }, ease: easeOut },
        { f: 132, v: { x: portrait ? W / 2 : W * 0.42, y: portrait ? H * 0.4 : H * 0.42, z: portrait ? 1.12 : 1.16 } },
      ]}
    >
      <Desktop tasks={[{ title: replaced ? "BoringVault.move - Sol2Move" : "Sol2Move", icon: asset("start-menu/cmd.webp"), active: true }]}>
        <Window
          {...win}
          title={replaced ? "BoringVault.move - Sol2Move" : "Sol2Move - Solidity to Move"}
          icon={asset("start-menu/cmd.webp")}
          active={!dialogOpen}
          bodyStyle={{ background: "#141414" }}
        >
          {replaced ? <Clip id="sol2move-generated-code" from={0.2} position="0% 0%" /> : <Clip id="sol2move-first-run" from={0.3} position="0% 0%" />}
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
            style={{ opacity: progress(frame, DIALOG, 3) }}
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
            { f: CLICK + 30, v: { x: yesAll.x + 40, y: yesAll.y + 70 } },
          ]}
          clicks={[CLICK]}
        />
      </Desktop>
    </Camera>
  );
}
