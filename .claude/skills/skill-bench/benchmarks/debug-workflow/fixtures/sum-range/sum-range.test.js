import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sumRange } from './sum-range.js';

test('sumRange is inclusive of the end value', () => {
  assert.equal(sumRange(1, 5), 15); // 1+2+3+4+5
});
