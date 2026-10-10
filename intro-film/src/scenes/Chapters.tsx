/**
 * The work, best first. Each project is one chapter: its windows open on the
 * downbeat, share the project's name in their titles and taskbar button, and
 * minimize together before the next project opens, so it is always clear
 * which recordings belong together.
 */
import { useCurrentFrame } from "remotion";
import { BAR, BEAT } from "../beat";
import { AppWindow, asset, Clip, clipRatio, Desktop, Montage, Still, stillRatio, useOrientation, type Enter } from "../xp";
import type clipManifest from "../../clips.json";
import type stillManifest from "../../stills.json";

type ClipId = keyof typeof clipManifest.clips;
type StillId = keyof typeof stillManifest.stills;

/** Window chrome heights: title bar + frame, and IE's address bar. */
const TITLE = 33;
const ADDRESS = 25;
const IE = asset("desktop/projects.webp");
const PLAYER = asset("start-menu/mediaPlayer.webp");

type Body =
  | { clip: ClipId; from?: number }
  | { still: StillId }
  | { montage: { id: ClipId; at: number }[] };

type Pane = {
  body: Body;
  title: string;
  /** Internet Explorer with this address. */
  url?: string;
  /** Width; height follows the content's shape. Landscape and portrait. */
  land: { x: number; y: number; w: number };
  port: { x: number; y: number; w: number };
  at?: number;
  enter?: Enter;
};

function ratioOf(body: Body) {
  if ("clip" in body) return clipRatio(body.clip);
  if ("still" in body) return stillRatio(body.still);
  return clipRatio(body.montage[0].id);
}

/** Films play in Media Player; sites and apps get MaxXP's project icon. */
const iconOf = (pane: Pane) => ("montage" in pane.body ? PLAYER : IE);

function Content({ body, until }: { body: Body; until: number }) {
  if ("clip" in body) return <Clip id={body.clip} from={body.from ?? 0} />;
  if ("still" in body) return <Still id={body.still} />;
  return <Montage shots={body.montage} until={until} />;
}

/** One project: its windows in, its name in the taskbar, then all minimize. */
function Chapter({ name, panes, length }: { name: string; panes: Pane[]; length: number }) {
  const frame = useCurrentFrame();
  const { portrait } = useOrientation();
  const out = length - 8;
  const taskX = portrait ? 150 : 190;
  return (
    <Desktop tasks={frame < out + 7 ? [{ title: name, icon: iconOf(panes[0]), active: true }] : []}>
      {panes.map((pane, i) => {
        const box = portrait ? pane.port : pane.land;
        const chrome = pane.url ? ADDRESS : 0;
        const h = Math.round((box.w - 6) / ratioOf(pane.body)) + TITLE + chrome;
        return (
          <AppWindow
            key={i}
            {...box}
            h={h}
            at={pane.at ?? 0}
            out={out + i}
            taskX={taskX}
            enter={pane.enter ?? "pop"}
            title={pane.title}
            icon={iconOf(pane)}
            active={i === panes.length - 1 || frame < (panes[i + 1]?.at ?? 0)}
            chrome={pane.url ? { address: pane.url } : undefined}
            bodyStyle={{ background: "#0b0b0b" }}
          >
            <Content body={pane.body} until={length} />
          </AppWindow>
        );
      })}
    </Desktop>
  );
}

/* ------------------------------------------------------------------ */
/* Drop 1: the best three                                              */
/* ------------------------------------------------------------------ */

export function Lilyshark() {
  return (
    <Chapter
      name="Lilyshark"
      length={3 * BAR}
      panes={[
        {
          title: "Lilyshark — LoRa mesh analyzer for the T-Deck",
          body: { montage: [{ id: "tdeck-hero", at: 0 }, { id: "tdeck-bytes", at: BAR }, { id: "tdeck-band", at: 2 * BAR }] },
          land: { x: 160, y: 22, w: 900 },
          port: { x: 10, y: 34, w: 520 },
        },
        {
          title: "Lilyshark - Mesh Radio Analyzer - Internet Explorer",
          url: "https://lilyshark.com/",
          body: { clip: "lilyshark-intro", from: 0.4 },
          land: { x: 772, y: 318, w: 472 },
          port: { x: 22, y: 392, w: 496 },
          at: BAR + 2 * BEAT,
          enter: "right",
        },
      ]}
    />
  );
}

export function Commits() {
  return (
    <Chapter
      name="commits.sh"
      length={2 * BAR}
      panes={[
        {
          title: "commits.sh — $MAXMONEYCASH - Internet Explorer",
          url: "https://commits.sh/maxmoneycash",
          body: { clip: "commits-sh-ticker" },
          land: { x: 70, y: 22, w: 660 },
          port: { x: 10, y: 20, w: 520 },
        },
        {
          title: "commits.sh — menu bar",
          body: { clip: "commits-sh-menubar" },
          land: { x: 860, y: 40, w: 340 },
          port: { x: 252, y: 472, w: 270 },
          at: BEAT + 6,
          enter: "top",
        },
      ]}
    />
  );
}

export function Orbital() {
  return (
    <Chapter
      name="Orbital Works"
      length={3 * BAR}
      panes={[
        {
          title: "Orbital Works — Nancy Grace Roman Space Telescope",
          body: { montage: [{ id: "roman-earth", at: 0 }, { id: "roman-apart", at: BAR }, { id: "roman-wheel", at: 2 * BAR }] },
          land: { x: 160, y: 22, w: 860 },
          port: { x: 10, y: 34, w: 520 },
        },
        {
          title: "Orbital Works - Internet Explorer",
          url: "https://orbital-works.vercel.app/",
          body: { clip: "orbital-site" },
          land: { x: 724, y: 300, w: 520 },
          port: { x: 22, y: 398, w: 496 },
          at: BAR,
          enter: "right",
        },
      ]}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Drop 2: a project a bar                                             */
/* ------------------------------------------------------------------ */

export function AptosMegaeth() {
  return (
    <Chapter
      name="Aptos vs MegaETH"
      length={BAR}
      panes={[{
        title: "Aptos vs MegaETH - Internet Explorer",
        url: "https://aptos-polymarket.vercel.app/",
        body: { clip: "aptos-vs-megaeth" },
        land: { x: 190, y: 36, w: 900 },
        port: { x: 10, y: 250, w: 520 },
      }]}
    />
  );
}

export function Sol2Move() {
  return (
    <Chapter
      name="Sol2Move"
      length={BAR}
      panes={[
        {
          title: "Sol2Move — Solidity to Aptos Move",
          body: { clip: "sol2move-first-run" },
          land: { x: 150, y: 40, w: 760 },
          port: { x: 10, y: 60, w: 520 },
          enter: "left",
        },
        {
          title: "Sol2Move — generated Move",
          body: { clip: "sol2move-generated-code" },
          land: { x: 850, y: 292, w: 380 },
          port: { x: 160, y: 500, w: 362 },
          at: BEAT + 4,
          enter: "right",
        },
      ]}
    />
  );
}

export function Yank() {
  return (
    <Chapter
      name="yank"
      length={BAR}
      panes={[{
        title: "yank — cloning getone.one - Internet Explorer",
        url: "https://yank.design/",
        body: { clip: "yank-clone" },
        land: { x: 190, y: 40, w: 900 },
        port: { x: 10, y: 270, w: 520 },
        enter: "right",
      }]}
    />
  );
}

export function Nipah() {
  return (
    <Chapter
      name="NipahScan"
      length={BAR}
      panes={[{
        title: "NipahScan — Nipah virus surveillance",
        body: { clip: "nipahscan" },
        land: { x: 190, y: 50, w: 900 },
        port: { x: 10, y: 290, w: 520 },
      }]}
    />
  );
}

export function Mainnet() {
  return (
    <Chapter
      name="Aptos mainnet"
      length={BAR}
      panes={[
        {
          title: "Aptos mainnet — Block Machine",
          body: { clip: "aptos-block-machine" },
          land: { x: 40, y: 40, w: 860 },
          port: { x: 10, y: 60, w: 520 },
          enter: "left",
        },
        {
          title: "Aptos mainnet — validators",
          body: { clip: "aptos-validator-globe" },
          land: { x: 820, y: 296, w: 420 },
          port: { x: 90, y: 440, w: 432 },
          at: BEAT + 4,
          enter: "bottom",
        },
      ]}
    />
  );
}

export function Gadgets() {
  return (
    <Chapter
      name="gadgets.sh"
      length={BAR}
      panes={[
        {
          title: "gadgets.sh - Internet Explorer",
          url: "https://gadgets.sh/",
          body: { still: "gadgets-catalog" },
          land: { x: 160, y: 40, w: 860 },
          port: { x: 10, y: 60, w: 520 },
          enter: "right",
        },
        {
          title: "gadgets.sh — HuskyLens 2",
          body: { still: "gadgets-huskylens" },
          land: { x: 970, y: 210, w: 270 },
          port: { x: 300, y: 420, w: 222 },
          at: BEAT + 4,
          enter: "bottom",
        },
      ]}
    />
  );
}
