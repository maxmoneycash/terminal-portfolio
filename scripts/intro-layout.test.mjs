import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { mediaLayout } from '../intro-film/src/mediaLayout.ts';
const clips = JSON.parse(readFileSync(new URL('../intro-film/clips.json', import.meta.url))).clips;
const stills = JSON.parse(readFileSync(new URL('../intro-film/stills.json', import.meta.url))).stills;
const ratios = Object.values({...clips, ...stills}).map(({crop}) => crop[2] / crop[3]);
for (const [W, H] of [[1280,720], [540,960]]) {
  test(`media remains fully visible without internal bars at ${W}x${H}`, () => {
    for (const a of ratios) for (const b of ratios) {
      for (const input of [[a],[a,b]]) {
        const chrome = input.map((_,i) => i ? 33 : 58);
        const boxes = mediaLayout(input, W, H, chrome);
        for (let i = 0; i < boxes.length; i++) {
          const {x,y,w,h} = boxes[i];
          assert.ok(x >= 0 && y >= 0 && x+w <= W && y+h <= H-30, JSON.stringify({W,H,input,boxes}));
          assert.ok(Math.abs((w-6) / input[i] - (h-chrome[i])) <= 2, 'Frame must follow the content ratio');
          assert.ok(w >= 140 && h >= 90, 'Media must have useful screen area');
        }
        if (boxes.length === 2) {
          const [a,b] = boxes;
          assert.ok(a.x+a.w <= b.x || b.x+b.w <= a.x || a.y+a.h <= b.y || b.y+b.h <= a.y, 'Related views must not cover one another');
        }
      }
    }
  });
}
