import { Img, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import { BanknoteOpening } from "../../../src/intro/BanknoteOpening";
import openingMedia from "../../../src/intro/openingMedia.json";
import { useInk } from "../Calligraphy";
import { useOrientation } from "../xp";

/** The same banknote montage and recorded pen used during the site's loading. */
export function Sign() {
  const frame = useCurrentFrame();
  const { W, H } = useOrientation();
  const ink = useInk();
  return <BanknoteOpening frame={frame} width={W} height={H} ink={ink} Image={Img} asset={staticFile}
    motion={<OffthreadVideo src={staticFile(openingMedia.src)} muted
      playbackRate={openingMedia.duration / (openingMedia.frames / 30)}
      style={{ width: "100%", height: "100%", objectFit: "cover" }} />} />;
}
