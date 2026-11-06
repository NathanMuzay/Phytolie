import test from 'node:test';
import assert from 'node:assert/strict';
import { guestInvitationFromUrl, invitationCode, invitationLink } from '../src/features/caretakers/invitation.ts';
const code = 'a'.repeat(43);
test('Guest routes extract complete Web links and native deep links without a login state', () => {
  for (const url of [`http://localhost:8081/#/personne-de-confiance?invitation=${code}`, `https://app.example.test/sub/#/personne-de-confiance?invitation=${code}`, `phytolie://personne-de-confiance?invitation=${code}`, `exp://192.168.1.2:8081/--/personne-de-confiance?invitation=${code}`]) {
    assert.equal(guestInvitationFromUrl(url), code);
    assert.equal(invitationCode(` ${url} `), code);
  }
  assert.equal(invitationCode(code), code);
  assert.equal(guestInvitationFromUrl('https://app.example.test/#/'), null);
  assert.equal(guestInvitationFromUrl('https://app.example.test/#/personne-de-confiance?invitation=bad'), '');
  assert.equal(guestInvitationFromUrl('https://app.example.test/?invitation='), '');
  assert.equal(invitationCode('not a link'), '');
});
test('Invitations produce full browser/mobile links with subpaths and tunnel HTTPS, or a pasteable code', () => {
  const link = invitationLink(code, 'https://app.example.test/sub/');
  assert.equal(link, `https://app.example.test/sub/#/personne-de-confiance?invitation=${code}`);
  assert.equal(invitationCode(link), code);
  assert.equal(invitationLink(code), code);
  assert.equal(invitationLink(code, '10.1.2.3:8081'), `http://10.1.2.3:8081/#/personne-de-confiance?invitation=${code}`);
  assert.ok(invitationLink(code, 'abc.exp.direct:443').startsWith('https://abc.exp.direct/'));
  assert.throws(() => invitationLink(code, 'javascript:alert(1)'));
  assert.throws(() => invitationLink(code, 'https://name:password@app.example.test/'));
});
