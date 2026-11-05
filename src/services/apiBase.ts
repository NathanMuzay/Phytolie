let expoHost: string | undefined;
let webOrigin: string | undefined;

export function configureApiHost(host: string | undefined, browserOrigin?: string) {
  expoHost = host;
  webOrigin = browserOrigin;
}

export function demoApiBase(host: string | undefined): string | undefined {
  if (!host) return undefined;
  // Expo's tunnel manifest uses host:port; public exp.direct URLs use HTTPS.
  const url = new URL(host.includes('://') ? host : `http://${host}`);
  if (url.hostname.endsWith('.exp.direct')) { url.protocol = 'https:'; url.port = ''; }
  return `${url.origin}/folia-api`;
}

// Development uses the computer that served Expo, rather than an old DHCP
// address. Only local hosts qualify; tunnels use the dedicated demo proxy.
export function localApiBase(host: string | undefined, port = '8787'): string | undefined {
  if (!host) return undefined;
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('EXPO_PUBLIC_API_PORT doit être compris entre 1 et 65535.');
  let url: URL;
  try { url = new URL(host.includes('://') ? host : `http://${host}`); } catch { return undefined; }
  if (url.username || url.password || !['http:', 'https:'].includes(url.protocol)) return undefined;
  const name = url.hostname.toLowerCase();
  const ipv4 = name.split('.').map(Number);
  const privateIPv4 = /^\d+\.\d+\.\d+\.\d+$/.test(name) && ipv4.every(octet => octet >= 0 && octet <= 255)
    && (ipv4[0] === 10 || (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31) || (ipv4[0] === 192 && ipv4[1] === 168) || ipv4[0] === 127);
  if (!(privateIPv4 || name === 'localhost' || name === '[::1]' || name.endsWith('.local'))) return undefined;
  url.port = String(Number(port));
  return url.origin;
}

export function getApiBase(): string | undefined {
  const demo = process.env.EXPO_PUBLIC_API_VIA_EXPO === '1';
  const automatic = process.env.NODE_ENV !== 'production' && process.env.EXPO_PUBLIC_API_AUTO_LOCAL === '1';
  const local = !demo && automatic ? localApiBase(webOrigin ?? expoHost, process.env.EXPO_PUBLIC_API_PORT || '8787') : undefined;
  const base = demo ? demoApiBase(expoHost) : local ?? process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');
  if (base) {
    const url = new URL(base);
    if (url.username || url.password || !['https:', 'http:'].includes(url.protocol) || (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')) throw new Error('Adresse API invalide : HTTPS obligatoire en production.');
  }
  return base;
}
