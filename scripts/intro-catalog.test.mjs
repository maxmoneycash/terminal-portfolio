import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import test from 'node:test';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const chapters = read('../src/intro/chapters.json');
const score = read('../intro-film/score.json');
const clips = read('../intro-film/clips.json').clips;

test('scenes and soundtrack use the same complete timeline', () => {
  assert.equal(new Set(chapters.map(chapter => chapter.id)).size, chapters.length);
  assert.ok(chapters.every(chapter => chapter.beats > 0 && chapter.label));
  const sections = [chapters[0].beats, chapters[1].beats,
    chapters.slice(2, 5).reduce((sum, chapter) => sum + chapter.beats, 0),
    chapters.slice(5, 11).reduce((sum, chapter) => sum + chapter.beats, 0), chapters[11].beats];
  assert.deepEqual(sections, score.sections.map(section => section.bars * 4));
  assert.deepEqual(score.morse.map(cue => cue.text), ['KK6OQA']);
});

test('Roman holds full frames without looping; commits retains the whole workspace', () => {
  const shotSeconds = chapters.find(chapter => chapter.id === 'orbital').beats * score.framesPerBeat / 30 / 4;
  assert.ok(shotSeconds >= 3.5);
  for (const id of ['roman-apart', 'roman-optics', 'roman-detectors']) {
    assert.deepEqual(clips[id].crop, [0, 0, 1920, 1080]);
    assert.ok(clips[id].duration >= shotSeconds);
  }
  assert.equal(clips['lilyshark-max'].audio, true);
  assert.equal(clips['lilyshark-max'].speed ?? 1, 1, 'Keep Max’s natural voice');
  const commits = clips['commits-sh-workspace'];
  assert.deepEqual(commits.crop, [0, 0, 3456, 2234]);
  const seconds = chapters.find(chapter => chapter.id === 'commits').beats * score.framesPerBeat / 30;
  assert.ok(Math.abs(commits.duration / commits.speed - seconds) < .05);
});

test('responsive shots and soundtrack are pinned, with posters available immediately', () => {
  const media = read('../src/data/intro-media.json');
  const files = read('./release-media.json').files;
  assert.ok(Object.keys(media.clips).length >= 20);
  let hdBytes = 0, mobileBytes = 0;
  for (const clip of Object.values(media.clips)) {
    const hd = files[clip.src.slice(1)], mobile = files[clip.mobile.slice(1)];
    assert.ok(hd && mobile);
    hdBytes += hd.bytes; mobileBytes += mobile.bytes;
    assert.ok(existsSync(new URL(`../public${clip.poster}`, import.meta.url)));
  }
  assert.ok(mobileBytes < hdBytes * .75, 'Mobile playback must save meaningful bandwidth');
  assert.ok(files[media.soundtrack.slice(1)]);
  assert.equal(chapters.some(chapter => /land|presidio|tend|ohlone/i.test(chapter.id)), false);
  assert.equal(Object.keys(media.stills).some(id => /presidio|tend|ohlone/i.test(id)), false);
});

test('Lilyshark has its complete launch film, ten uncropped shorts, and a separate preview', () => {
  const videos = read('../src/data/lilyshark-videos.json').filter(v => v.date !== 'On camera');
  const media = read('./release-media.json').files;
  assert.equal(videos.length, 11);
  assert.equal(videos[0].durationSeconds, 90);
  assert.ok(videos[0].previewSrc);
  for (const [index, video] of videos.entries()) {
    assert.equal(video.width / video.height, index ? 9 / 16 : 16 / 9);
    assert.equal(video.hasAudio, true);
    if (index) assert.ok(video.durationSeconds >= 25 && video.durationSeconds <= 36);
    for (const src of [...video.sources.map(source => source.src), ...(video.previewSrc ? [video.previewSrc] : [])]) {
      assert.ok(media[src.slice(1)], `Missing release asset: ${src}`);
    }
    assert.ok(existsSync(new URL(`../public${video.poster}`, import.meta.url)));
  }
});

test('every clip used by a scene has a published responsive source', () => {
  const folder = new URL('../intro-film/src/scenes/', import.meta.url);
  const source = readdirSync(folder).filter(name => name.endsWith('.tsx')).map(name => readFileSync(new URL(name, folder), 'utf8')).join('\n');
  const tokens = new Set(source.match(/[a-z0-9][a-z0-9-]*/g));
  const media = read('../src/data/intro-media.json');
  for (const id of Object.keys(clips)) if (tokens.has(id)) assert.ok(media.clips[id], `Unpublished clip: ${id}`);
});

test('the Lilyshark library includes the recovered natural-speed camera explanations', () => {
  const videos = read('../src/data/lilyshark-videos.json').filter(v => v.date === 'On camera');
  const files = read('./release-media.json').files;
  assert.equal(videos.length, 3);
  for (const video of videos) {
    assert.equal(video.sourceFilename, 'P1010579.MOV');
    assert.equal(video.hasAudio, true);
    assert.ok(video.durationSeconds >= 12);
    assert.ok(files[video.sources[0].src.slice(1)]);
    assert.ok(existsSync(new URL(`../public${video.poster}`, import.meta.url)));
  }
});
