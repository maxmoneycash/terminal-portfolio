# MaxXP intro film

A 71-second XP desktop film: Max's recorded signature, **KK6OQA** in Morse,
a 19-second Lilyshark feature, commits.sh, Orbital Works, six project chapters, larger pairs of
additional work, then a short window cascade and “your turn.” The live radio
app keeps its longer greeting; the film's cue is independent in `score.json`.

Lilyshark uses three longer extracts from `lilyshark-launch-v2.mp4` (the
T-Deck reveal, packet bytes, and spectrum), then the “below the noise” and
“airtime” shorts. Each gets its own large window. The portrait shorts are
cropped around the actual content, removing their empty outer margins.

The logical canvas is 1280×720 landscape or 540×960 portrait, rendered at
1920×1080 or 1080×1920. The whole desktop stays in frame. `mediaLayout.ts`
fits each window to the reviewed media crop and its chrome; portrait and
landscape use different arrangements, with no overlapping content until the
closing recap. Cuts and music share the 14-frame beat grid in `score.json`.

```sh
npm run intro:setup
npm run intro:prepare
npm run intro:render
npm run intro:publish
npm run intro:upload   # before pushing a commit that references new films
```

Run the renderer from `intro-film/` (the npm scripts do this), so it uses that
project's installed Remotion renderer. Match Node's architecture to the local
npm dependencies. This checkout uses native ARM Node 22.

`prepare.py` crops source recordings and screenshots into
`.intro-build/film/public`. `clips.json` and `stills.json` record source-pixel
crops and exact source names. Originals are found in `~/Screenshots`, iCloud
Screenshots, `~/Downloads`, or `~/Movies/Orbital Works`. Review each changed
crop across its entire time span: windows sometimes move in the source.
Never publish other desktop windows or unreviewed source footage.

The opening uses `src/lib/calligraphy.ts`, shared with the site's quill.
`scripts/signature/from_video.py` extracts ink arrival and pen movement from
the supplied signature recording, removes the notebook background, shortens
pauses, and retimes the writing to 5.6 seconds. It writes the content-hashed
ink atlas in `public/signature/` and `src/lib/signatureRecording.json`.
Portrait lines are separated by recorded stroke time, keeping the flourish
intact. The older manual trace tools remain available as source history.

The extraction and soundtrack need Python with NumPy, SciPy and Pillow
(`scripts/signature/requirements.txt`). The soundtrack also uses GarageBand's
Electro House Apple Loops in `/Library/Audio/Apple Loops/Apple/02 Electro House`.

```sh
# From the repository root, review frames from one reused bundle:
(cd intro-film && node stills.mjs portrait ../.intro-build/review 100 200 310 430)
# Layout bounds, aspect ratios, and overlap regression checks (Node 22+):
node --experimental-strip-types --test scripts/intro-layout.test.mjs
```

The MP4s stay out of git. `intro:publish` validates full decodes, web-encodes,
updates `IntroVideo.tsx`, and records SHA-256 hashes in `published.json`.
`intro:upload` stores them on the `intro-films` GitHub release; the site build
fetches and verifies those exact files. `intro:clean` removes reproducible
intermediates and preserves masters, published videos, and originals.

The site shows the intro on ordinary arrivals, saved app hashes, and reloads.
Specific shared project/video/site links still open their content directly.
Autoplay is attempted with sound and then muted. If the browser refuses, or
reduced-motion/data-saving is requested, a visible Play intro button remains.
A slow load or media error never silently dismisses the intro. Click the film
for sound; Skip or Escape opens the desktop.
