import type { ElementType, ReactNode } from "react";
import score from "../../intro-film/score.json";
import openingMedia from "./openingMedia.json";
import { RecordedSignature } from "./RecordedSignature";

export const OPENING_FRAMES = score.sections[0].bars * 4 * score.framesPerBeat;
export const OPENING_SECONDS = OPENING_FRAMES / 30;
const SHOTS = ["gold", "seal", "blue", "swirl"];

/** One composition for the immediate loader and the rendered film. */
export function BanknoteOpening({ frame, width, height, ink, motion, Image = "img", asset = (path) => `/${path}` }: {
  frame: number;
  width: number;
  height: number;
  ink: HTMLImageElement | null;
  motion?: ReactNode;
  Image?: ElementType;
  asset?: (path: string) => string;
}) {
  const portrait = height > width;
  const shot = Math.min(SHOTS.length - 1, Math.max(0, Math.floor((frame - openingMedia.frames) / (OPENING_FRAMES - openingMedia.frames) * SHOTS.length)));
  const writing = Math.max(0, (frame - score.calligraphy.start) / score.calligraphy.frames);
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#e9e1ca", color: "#0d1a3d" }}>
      {SHOTS.map((name, i) => (
        <Image key={name} src={asset(`intro-art/${name}.webp`)} alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
            objectPosition: "50% 50%", opacity: i === shot ? 1 : 0,
            filter: "saturate(0.55) sepia(0.15)", transform: `scale(${1.025 + (frame % 16) / 16 * 0.015})` }} />
      ))}
      {frame < openingMedia.frames && <div style={{ position: "absolute", inset: 0, overflow: "hidden",
        filter: "sepia(.3) contrast(.92)" }}>{motion}</div>}
      {/* The engraving remains visible at the edges; quiet paper behind the ink. */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 48% 54%, rgb(246 239 218 / .94) 0%, rgb(246 239 218 / .82) 30%, rgb(234 222 191 / .28) 78%), linear-gradient(0deg, rgb(240 230 204 / .8), transparent 25%, transparent 85%, rgb(240 230 204 / .35))" }} />
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", transform: `translateY(${portrait ? 1 : 5}%)` }}>
        <RecordedSignature ink={ink} progress={writing} width={width * (portrait ? 0.79 : 0.78)}
          twoLines={portrait} quill={portrait ? 0.58 : 0.82} Image={Image} quillSrc={asset("quill-pen-transparent.png")} />
      </div>
    </div>
  );
}
