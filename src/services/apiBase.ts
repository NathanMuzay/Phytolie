let demoHost: string | undefined;

export function configureDemoApiHost(host: string | undefined) {
  demoHost = host;
}

export function demoApiBase(host: string | undefined): string | undefined {
  if (!host) return undefined;
  // Expo's tunnel manifest uses host:port; public exp.direct URLs use HTTPS.
  const url = new URL(host.includes('://') ? host : `http://${host}`);
  if (url.hostname.endsWith('.exp.direct')) { url.protocol = 'https:'; url.port = ''; }
  return `${url.origin}/folia-api`;
}

export function getApiBase(): string | undefined {
  if (process.env.EXPO_PUBLIC_API_VIA_EXPO === '1') return demoApiBase(demoHost);
  return process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');
}
