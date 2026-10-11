/**
 * The quill follows the recorded "Max Mohammadi" signature with the same
 * timing and renderer as the site's quill window (src/lib/calligraphy).
 * The quill rides the pen and lifts between strokes. Pure function of progress.
 */
import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import { loadInk, signature } from "../../src/lib/calligraphy";

let inkCache: HTMLImageElement | null = null;
let loading: Promise<HTMLImageElement> | null = null;

export function useInk() {
  const [ink, setInk] = useState<HTMLImageElement | null>(inkCache);
  const [handle] = useState(() => (inkCache ? null : delayRender("Loading the signature ink")));
  useEffect(() => {
    if (inkCache) return;
    loading ??= loadInk(staticFile(signature.atlas.slice(1)));
    void loading.then((image) => {
      inkCache = image;
      setInk(image);
      if (handle !== null) continueRender(handle);
    }).catch(cancelRender);
  }, [handle]);
  return ink;
}

export { RecordedSignature } from "../../src/intro/RecordedSignature";
