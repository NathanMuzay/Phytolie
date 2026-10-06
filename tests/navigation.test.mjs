import test from 'node:test';
import assert from 'node:assert/strict';
import { pageFromHash, hashForPage } from '../src/navigation.ts';
test('Every screen has a reloadable address including encoded plant identifiers', () => {
  for (const page of ['home', 'garden', 'tasks', 'settings', 'caretaker', 'account', 'new', 'plant/plante été / 1', 'edit/plante été / 1']) {
    assert.equal(pageFromHash(hashForPage(page)), page);
  }
});
test('Unknown addresses and malformed encoding return home', () => {
  for (const hash of ['', '#/unknown', '#/plantes/%ZZ', '#/plantes/123/unexpected']) assert.equal(pageFromHash(hash), 'garden');
});
