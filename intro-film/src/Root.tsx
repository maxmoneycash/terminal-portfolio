import { Composition } from "remotion";
import { FILM_FRAMES, Film } from "./Film";
import { FPS } from "./lib";

// Logical sizes; renders use --scale 1.5 (landscape) and 2 (portrait),
// so XP's 96-DPI metrics land at 1920×1080 and 1080×1920.
export function Root() {
  return (
    <>
      <Composition id="IntroLandscape" component={Film} durationInFrames={FILM_FRAMES} fps={FPS} width={1280} height={720} />
      <Composition id="IntroPortrait" component={Film} durationInFrames={FILM_FRAMES} fps={FPS} width={540} height={960} />
    </>
  );
}
