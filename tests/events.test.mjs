import test from 'node:test';
import assert from 'node:assert/strict';
import { lastFriday, nextFriday } from '../src/eventDates.ts';

test('last Friday calculation handles years and short months', () => {
  assert.equal(lastFriday(2026, 10), 30);
  assert.equal(lastFriday(2027, 2), 26);
  assert.equal(lastFriday(2027, 12), 31);
});
test('next giveaway uses the Pacific calendar day and rolls over after Friday', () => {
  assert.equal(nextFriday(new Date('2026-10-31T02:00:00Z')), 'October 30, 2026');
  assert.equal(nextFriday(new Date('2026-10-31T08:00:00Z')), 'November 27, 2026');
  assert.equal(nextFriday(new Date('2026-12-26T12:00:00Z')), 'January 29, 2027');
});
