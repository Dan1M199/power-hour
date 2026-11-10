import assert from 'node:assert/strict';
import { swipeStep } from '../src/swipe.js';

assert.equal(swipeStep(-100, 5, 200), 1, 'left advances');
assert.equal(swipeStep(100, -5, 200), -1, 'right goes back');
assert.equal(swipeStep(-30, 0, 100), 0, 'a small tap movement stays a tap');
assert.equal(swipeStep(-80, 120, 200), 0, 'vertical scrolling cannot navigate');
assert.equal(swipeStep(80, 60, 200), 0, 'ambiguous diagonal movement cannot navigate');
assert.equal(swipeStep(-150, 0, 900), 0, 'a long hold cannot navigate');
console.log('ok   swipe direction and scroll guards');
