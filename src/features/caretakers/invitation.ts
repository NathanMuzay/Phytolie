const validCode = (value: string) => /^[A-Za-z0-9_-]{43}$/.test(value);
// null means a normal application address; an empty string means an invalid link.
export function guestInvitationFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const hash = new URLSearchParams(url.hash.split('?')[1] ?? '');
    const params = hash.has('invitation') ? hash : url.searchParams;
    if (!params.has('invitation')) return null;
    const code = params.get('invitation') ?? '';
    return validCode(code) ? code : '';
  } catch { return null; }
}
export function invitationCode(value: string): string {
  const trimmed = value.trim();
  return validCode(trimmed) ? trimmed : guestInvitationFromUrl(trimmed) ?? '';
}
export function invitationLink(code: string, base?: string): string {
  if (!base) return code;
  const url = new URL(base.includes('://') ? base : `http://${base}`);
  if (url.username || url.password || !['http:', 'https:'].includes(url.protocol)) throw new Error('Adresse Web de partage invalide.');
  if (url.hostname.endsWith('.exp.direct')) { url.protocol = 'https:'; url.port = ''; }
  url.search = ''; url.hash = `/personne-de-confiance?invitation=${code}`;
  return url.href;
}
