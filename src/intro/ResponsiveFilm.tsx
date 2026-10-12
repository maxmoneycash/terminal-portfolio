import { useEffect, useMemo, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { Film, FILM_FRAMES } from "../../intro-film/src/Film";
import { WebPlayback, type PlaybackMedia } from "../../intro-film/src/playback";
import media from "../data/intro-media.json";
import { filmDimensions } from "./filmDimensions";

function Composition(props: PlaybackMedia) {
  return <WebPlayback.Provider value={props}><Film /></WebPlayback.Provider>;
}

export default function ResponsiveFilm({ width, height, mobile, initialFrame, volume, onReady }: {
  width: number; height: number; mobile: boolean; initialFrame: number; volume: number;
  onReady: (player: PlayerRef | null) => void;
}) {
  const ref = useRef<PlayerRef>(null);
  const dimensions = filmDimensions(width, height);
  const inputProps = useMemo(() => ({ ...media, mobile }), [mobile]);
  useEffect(() => {
    onReady(ref.current);
    return () => onReady(null);
  }, [onReady]);
  // Keep the audio clock alive across buffering; native audio can otherwise keep
  // playing while the frame loop waits for a suspended Web Audio output clock.
  return <Player ref={ref} component={Composition} inputProps={inputProps}
    compositionWidth={dimensions.width} compositionHeight={dimensions.height}
    durationInFrames={FILM_FRAMES} fps={30} initialFrame={initialFrame}
    className="intro-film" style={{ width: "100%", height: "100%" }}
    controls={false} clickToPlay={false} doubleClickToFullscreen={false}
    spaceKeyToPlayOrPause={false} moveToBeginningWhenEnded={false}
    initiallyMuted initialVolume={volume} numberOfSharedAudioTags={0}
    _experimentalKeepAudioContextAlive
    errorFallback={() => null} renderLoading={() => null} />;
}
