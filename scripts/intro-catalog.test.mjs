import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const chapters = read('../src/intro/chapters.json');
const score = read('../intro-film/score.json');
const clips = read('../intro-film/clips.json').clips;

test('chapter navigation and soundtrack use the same complete timeline', () => {
  assert.equal(new Set(chapters.map(chapter => chapter.id)).size, chapters.length);
  assert.ok(chapters.every(chapter => chapter.beats > 0 && chapter.label));
  const sections = [chapters[0].beats, chapters[1].beats,
    chapters.slice(2, 6).reduce((sum, chapter) => sum + chapter.beats, 0),
    chapters.slice(6, 12).reduce((sum, chapter) => sum + chapter.beats, 0), chapters[12].beats];
  assert.deepEqual(sections, score.sections.map(section => section.bars * 4));
  assert.deepEqual(score.morse.map(cue => cue.text), ['KK6OQA']);
});

test('Roman holds full frames without looping; commits retains the whole workspace', () => {
  const shotSeconds = chapters.find(chapter => chapter.id === 'orbital').beats * score.framesPerBeat / 30 / 3;
  assert.ok(shotSeconds >= 3.5);
  for (const id of ['roman-earth', 'roman-apart', 'roman-wheel']) {
    assert.deepEqual(clips[id].crop, [0, 0, 1920, 1080]);
    assert.ok(clips[id].duration >= shotSeconds);
  }
  const commits = clips['commits-sh-workspace'];
  assert.deepEqual(commits.crop, [0, 0, 3456, 2234]);
  const seconds = chapters.find(chapter => chapter.id === 'commits').beats * score.framesPerBeat / 30;
  assert.ok(Math.abs(commits.duration / commits.speed - seconds) < .05);
});

test('both orientations have separate, substantially smaller mobile files pinned to the release', () => {
  const sources = read('../src/data/intro-sources.json');
  const files = read('../intro-film/published.json').files;
  for (const orient of ['landscape', 'portrait']) {
    const source = sources[orient];
    assert.notEqual(source.mobile, source.hd);
    const hd = files[source.hd.split('/').pop()];
    const mobile = files[source.mobile.split('/').pop()];
    assert.ok(hd && mobile);
    assert.ok(mobile.bytes < hd.bytes * .65, `${orient} mobile encode must save at least 35%`);
    assert.ok(existsSync(new URL(`../public${source.poster}`, import.meta.url)));
  }
});

test('Lilyshark has its complete launch film, ten uncropped shorts, and a separate preview', () => {
  const videos = read('../src/data/lilyshark-videos.json');
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
