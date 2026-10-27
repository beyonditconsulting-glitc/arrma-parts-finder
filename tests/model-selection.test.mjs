import test from 'node:test';
import assert from 'node:assert/strict';
import { allModels, allVersions, catalogVehicle, models, versionsForModel, vehicleModel, searchPartsByModel } from '../src/catalog.ts';

test('models and source version labels remain separate and include all options', () => {
  assert.equal(vehicleModel(catalogVehicle), 'Kraton');
  assert.ok(models.includes('Kraton'));
  assert.ok(models.includes('Typhon'));
  assert.equal(versionsForModel('Kraton')[0], allVersions);
  assert.ok(versionsForModel('Kraton').includes(catalogVehicle));
  assert.ok(!versionsForModel('Typhon').includes(catalogVehicle));
});
test('all versions includes the exact version results without cross-model leakage', () => {
  const exact = searchPartsByModel('ARA320754', 'Kraton', catalogVehicle);
  assert.ok(exact.length > 0);
  assert.ok(searchPartsByModel('ARA320754', 'Kraton', allVersions).length >= exact.length);
  assert.equal(searchPartsByModel('ARA320754', 'Typhon', catalogVehicle).length, 0);
  assert.ok(searchPartsByModel('ARA320754', allModels, allVersions).length > 0);
});
