import assert from 'node:assert/strict';
import test from 'node:test';
import { playbackRecovery, recoveryFrame } from '../src/intro/playbackHealth.ts';

test('a frozen picture recovers while an advancing soundtrack stays in sync', () => {
  const sample = { stalledFor: 1600, buffering: false, playing: true, hidden: false };
  assert.equal(playbackRecovery(sample), 'clock');
  assert.equal(recoveryFrame(360, 13.6, 2240, false), 408);
  assert.equal(playbackRecovery({ ...sample, stalledFor: 400 }), null);
});

test('ordinary clip buffering can finish, but a hung request is retried in place', () => {
  const sample = { stalledFor: 2000, buffering: true, playing: true, hidden: false };
  assert.equal(playbackRecovery(sample), null);
  assert.equal(playbackRecovery({ ...sample, stalledFor: 8000 }), 'media');
  assert.equal(recoveryFrame(378, 19, 2240, true), 378);
});

test('a deliberate pause or background tab never triggers recovery', () => {
  const sample = { stalledFor: 30000, buffering: false, playing: false, hidden: false };
  assert.equal(playbackRecovery(sample), null);
  assert.equal(playbackRecovery({ ...sample, playing: true, hidden: true }), null);
});

test('recovery never rewinds or seeks past the final frame', () => {
  assert.equal(recoveryFrame(900, 2, 2240, false), 900);
  assert.equal(recoveryFrame(900, undefined, 2240, false), 900);
  assert.equal(recoveryFrame(900, NaN, 2240, false), 900);
  assert.equal(recoveryFrame(2238, 80, 2240, false), 2239);
});
