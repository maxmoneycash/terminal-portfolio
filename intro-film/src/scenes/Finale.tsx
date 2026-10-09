import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BEAT, beats } from "../beat";
import { progress } from "../lib";
import { Desktop, useOrientation } from "../xp";
import { WelcomeWords } from "./Login";

/** Clean desktop and the handoff line; the live desktop takes over after. */
export function Finale() {
  const frame = useCurrentFrame();
  const { portrait } = useOrientation();
  // "your" lands on the final hit, "turn." a beat later, then the live desktop takes over.
  const fade = 1 - progress(frame, beats(3), 12);
  return (
    <Desktop>
      <AbsoluteFill style={{ display: "grid", placeItems: "center", opacity: fade }}>
        <WelcomeWords words={["your", "turn."]} at={0} every={BEAT} size={portrait ? 60 : 84} align="center" />
      </AbsoluteFill>
    </Desktop>
  );
}
