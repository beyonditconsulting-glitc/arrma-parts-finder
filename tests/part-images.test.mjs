import test from 'node:test';
import assert from 'node:assert/strict';
import { selectPartImage } from '../src/partImages.ts';

const record = {
  partNumber: 'ARA123', imageUrl: 'https://example.com/image.jpg',
  sourceUrl: 'https://example.com/product', sourceName: 'Manufacturer',
  usageEvidence: 'Written permission on file', permission: 'approved',
};
test('only returns photos with exact part number and display rights evidence', () => {
  assert.equal(selectPartImage('ARA123', [{...record, permission:'pending'}]), undefined);
  assert.equal(selectPartImage('ARA123', [{...record, usageEvidence:''}]), undefined);
  assert.equal(selectPartImage('ARA123', [{...record, imageUrl:'http://example.com/image.jpg'}]), undefined);
  assert.equal(selectPartImage('ARA1234', [record]), undefined);
  assert.equal(selectPartImage(' ara123 ', [record]), record);
  assert.equal(selectPartImage(null, [record]), undefined);
});
