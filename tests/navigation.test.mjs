import test from 'node:test';
import assert from 'node:assert/strict';
import { pageFromHash, hashForPage, invitationFromHash } from '../src/app/navigation.ts';
test('Every screen has a reloadable address including encoded plant identifiers', () => {
  for (const page of ['home', 'garden', 'tasks', 'settings', 'preferences', 'privacy', 'caretaker', 'account', 'new', 'plant/plante été / 1', 'edit/plante été / 1']) {
    assert.equal(pageFromHash(hashForPage(page)), page);
  }
});
test('Unknown addresses and malformed encoding return home', () => {
  for (const hash of ['', '#/unknown', '#/plantes/%ZZ', '#/plantes/123/unexpected']) assert.equal(pageFromHash(hash), 'garden');
});

test('Invitation links preserve caretaker routing and only extract valid codes', () => {
  const code = 'a'.repeat(43);
  const hash = `#/personne-de-confiance?invitation=${code}`;
  assert.equal(pageFromHash(hash), 'caretaker');
  assert.equal(invitationFromHash(hash), code);
  assert.equal(invitationFromHash('#/personne-de-confiance?invitation=bad'), '');
});
