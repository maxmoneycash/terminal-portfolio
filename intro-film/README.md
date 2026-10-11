# MaxXP intro film

A 74.7-second XP desktop film: a banknote montage under Max's recorded signature, **KK6OQA** in Morse,
a 16.8-second Lilyshark feature, a full-workspace commits.sh timelapse, Orbital Works,
six project chapters, larger pairs of
additional work, then “your turn.” The live radio
app keeps its longer greeting; the film's cue is independent in `score.json`.

Lilyshark opens with Max speaking, then shows the T-Deck reveal, spectrum, and
packet bytes from `lilyshark-launch-v2.mp4`. His natural-speed voice continues
under the device footage, with the music lowered. Short captions on the desktop
explain what the project is and why he built it. The full launch film, ten
animated shorts, and three camera explanations remain available in Demo Reel.

The camera takes were found in `~/Documents/Eric Photos/P1010579 edits/`.
Their README describes time-compressed speech; the newer preferences in
`~/lilyshark/docs/content/editing-preferences.md` ask for a natural voice.
`scripts/prepare-lilyshark-camera.py` therefore cuts complete phrases from the
original `~/Documents/Eric Photos/P1010579.MOV` at 1.00x. Audio gets a fixed
10 dB gain and peak protection; no pitch or word-timing changes. Allow iCloud to download
that original before cutting. Previous edits remain intact.

Roman follows a four-shot explanation: internal assembly, the optical path,
the filter/detector array, and a clearly labeled simulated sky image from the
app. The 3D footage retains its full source frame; the image is cropped to the
actual image area of the app screenshot.

The browser plays the shared composition through `@remotion/player`. Its logical
canvas matches the actual viewport aspect ratio, using a height of 720 for
landscape and a width of 540 for portrait. The wallpaper and taskbar fill the
screen; `mediaLayout.ts` fits windows to the media ratio without stretching or
cropping recordings. Resizing preserves playback position. Only Skip remains
visible during playback; Space pauses/resumes and M toggles sound.

```sh
npm run intro:web     # requires original recordings, ffmpeg, Python dependencies
npm run media:upload # upload the pinned shots and soundtrack before pushing
```

For optional fixed-aspect exports:
```sh
npm run intro:setup
npm run intro:render
npm run intro:publish
npm run intro:upload
```

Run the renderer from `intro-film/` (the npm scripts do this), so it uses that
project's installed Remotion renderer. Match Node's architecture to the local
npm dependencies. This checkout uses native ARM Node 22.

`prepare.py` crops source recordings and screenshots into
`.intro-build/film/public`. `clips.json` and `stills.json` record source-pixel
crops and exact source names. Originals are found in `~/Screenshots`, iCloud
Screenshots, `~/Downloads`, or `~/Movies/Orbital Works`. Review each changed
crop across its entire time span: windows sometimes move in the source.
Review source footage before publishing. The September 26 commits recording is an
explicit full-desktop exception: preserve its entire frame and timeline. The film
uses a 7.47-second timelapse; the Demo Reel uses the same source at 24× speed.
Its `frames` flag predecodes the dense timelapse to full-frame JPEGs during
preparation, avoiding repeated high-resolution video extraction while rendering.
The remaining phone-film clips use `portraitFrames` at 1080 pixels wide or their
native width when smaller, retaining the full view at the final output resolution.

The opening uses `src/intro/BanknoteOpening.tsx` and `src/lib/calligraphy.ts`,
shared with the immediate loading montage and the site's quill. The supplied dollar-bill motion clip opens into four
banknote engravings under the recorded ink; portrait
stacks the two words. Source credits live in `public/intro-art/SOURCES.md`.
The loading montage waits for the ink to decode before starting its clock.
The browser player joins that clock, so the first writing strokes are never
skipped or replayed. Reduced motion keeps the footage paused behind Play intro
while the requested signature writes. The opening has no text, border, progress
line, or waveform transition.
`scripts/signature/from_video.py` extracts ink arrival and pen movement from
the supplied signature recording, removes the notebook background, shortens
pauses, and retimes the writing using `score.json` (currently 3.13 seconds). It writes the content-hashed
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

MP4s and M4As stay out of git. `scripts/prepare-intro-web.py` emits individual
HD/mobile shots, posters, and the score, pinning SHA-256 hashes in
`scripts/release-media.json`. The site build fetches and verifies those exact
assets. Upcoming scenes and shots premount one second ahead to reduce buffering. Offline `intro:publish` exports are separate and are not downloaded by
the website build. `intro:clean` preserves masters and original recordings.

The site shows the intro on ordinary arrivals, saved app hashes, and reloads.
Specific shared project/video/site links still open their content directly.
Playback starts muted and a click enables sound. Reduced-motion/data-saving
preferences show a Play intro button.
A slow load or media error never silently dismisses the intro. Click the film
for sound; Skip or Escape opens the desktop.

`python3 intro-film/prepare-opening.py` rebuilds the 3.2-second motion layer from
`ScreenRecording_10-11-2025 12.mov`, trimming its black/UI tail. Its manifest is
`src/intro/openingMedia.json`; `npm run media:upload` publishes every asset in
`scripts/release-media.json` before deployment. Original captures in
`intro-film/captures/` are retained for a future review; Tend, Presidio Atlas,
and Ohlone Unicode are excluded from the current intro and curated showcase.
