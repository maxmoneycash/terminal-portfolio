import { Img, staticFile, useCurrentFrame } from "remotion";
import { BanknoteOpening } from "../../../src/intro/BanknoteOpening";
import { useInk } from "../Calligraphy";
import { useOrientation } from "../xp";

/** The same banknote montage and recorded pen used during the site's loading. */
export function Sign() {
  const frame = useCurrentFrame();
  const { W, H } = useOrientation();
  const ink = useInk();
  return <BanknoteOpening frame={frame} width={W} height={H} ink={ink} Image={Img} asset={staticFile} />;
}
