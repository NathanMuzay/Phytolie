import { createHmac, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { HttpError } from './errors.mjs';

const list = value => (value || '').split(',').map(x => x.trim()).filter(Boolean);
const normalizeIP = value => value?.startsWith('::ffff:') ? value.slice(7) : value;
export function securityConfig(env = process.env) {
  if (env.NODE_ENV && !['production', 'development', 'test'].includes(env.NODE_ENV)) throw new Error('NODE_ENV invalide.');
  const production = env.NODE_ENV === 'production';
  if (env.FOLIA_ALLOW_REGISTRATION && !['true', 'false'].includes(env.FOLIA_ALLOW_REGISTRATION)) throw new Error('FOLIA_ALLOW_REGISTRATION attend true ou false.');
  const origins = list(env.FOLIA_ALLOWED_ORIGINS);
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.origin !== origin || url.username || url.password || (production && url.protocol !== 'https:') || !['http:', 'https:'].includes(url.protocol)) throw new Error('Origine CORS invalide. Utilisez une origine exacte, HTTPS en production.');
  }
  const proxies = list(env.FOLIA_TRUSTED_PROXIES).map(normalizeIP);
  if (proxies.some(ip => !isIP(ip))) throw new Error('FOLIA_TRUSTED_PROXIES attend des adresses IP exactes, sans CIDR.');
  const host = env.API_HOST || (production ? '127.0.0.1' : '0.0.0.0');
  if (production && !['127.0.0.1', '::1'].includes(host)) throw new Error('En production, API_HOST doit être une adresse loopback derrière le proxy HTTPS local.');
  if (production && !proxies.length) throw new Error('FOLIA_TRUSTED_PROXIES obligatoire en production.');
  if ((production || env.FOLIA_AUDIT_KEY) && !/^[a-fA-F0-9]{64}$/.test(env.FOLIA_AUDIT_KEY || '')) throw new Error('FOLIA_AUDIT_KEY doit contenir 64 caractères hexadécimaux (obligatoire en production).');
  if (production && env.FOLIA_AUDIT_KEY?.toLowerCase() === env.FOLIA_DATA_KEY?.toLowerCase()) throw new Error('Utilisez deux clés distinctes pour les données et les journaux.');
  function limit(name, fallback) {
    if (env[name] === undefined) return fallback;
    const number = Number(env[name]);
    if (!Number.isSafeInteger(number) || number < 1 || number > 100000) throw new Error(`${name} doit être un entier entre 1 et 100000.`);
    return number;
  }
  return { production, origins, proxies, host, allowRegistration: env.FOLIA_ALLOW_REGISTRATION === 'true' || (!production && env.FOLIA_ALLOW_REGISTRATION !== 'false'),
    auditKey: env.FOLIA_AUDIT_KEY ? Buffer.from(env.FOLIA_AUDIT_KEY, 'hex') : randomBytes(32),
    identifyDaily: limit('FOLIA_IDENTIFY_DAILY_LIMIT', 200),
    measureDaily: limit('FOLIA_MEASURE_DAILY_LIMIT', 100),
  };
}

// Single local reverse proxy only. Never trust client-supplied forwarding chains.
export function requestIdentity(request, config) {
  const peer = normalizeIP(request.socket.remoteAddress) || 'unknown';
  const trusted = config.proxies.includes(peer);
  const forwarded = request.headers['x-forwarded-for'];
  if (trusted && (typeof forwarded !== 'string' || !isIP(forwarded))) throw new HttpError(400, 'Adresse transmise par le proxy invalide.');
  const secure = !!request.socket.encrypted || (trusted && request.headers['x-forwarded-proto'] === 'https');
  if (config.production && !secure) throw new HttpError(403, 'Connexion HTTPS obligatoire.');
  return { ip: trusted ? normalizeIP(forwarded) : peer, secure };
}

export function securityHeaders(response, request, config, secure) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Vary', 'Origin');
  if (config.production && secure) response.setHeader('Strict-Transport-Security', 'max-age=31536000');
  const origin = request.headers.origin;
  const allowed = !origin || config.origins.includes(origin);
  if (origin && allowed) response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  response.setHeader('Access-Control-Expose-Headers', 'Retry-After, X-Request-ID');
  return allowed;
}

export function createSecurity(db, config) {
  db.exec(`CREATE TABLE IF NOT EXISTS security_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS security_limits_expiry ON security_limits(expires);`);
  const fingerprint = text => createHmac('sha256', config.auditKey).update(text).digest('hex');
  let nextCleanup = 0;
  const active = new Map();
  return {
    fingerprint,
    consume(scope, identity, max, windowMs, now = Date.now()) {
      if (now >= nextCleanup) { db.prepare('DELETE FROM security_limits WHERE expires<=?').run(now); nextCleanup = now + 60000; }
      const key = fingerprint(`${scope}:${identity}`);
      const row = db.prepare('SELECT count, expires FROM security_limits WHERE key=?').get(key);
      if (row && row.expires > now && row.count >= max) throw new HttpError(429, 'Limite atteinte. Réessayez plus tard.', Math.max(1, Math.ceil((row.expires - now) / 1000)));
      if (!row && db.prepare('SELECT COUNT(*) AS count FROM security_limits').get().count >= 20000) throw new HttpError(503, 'Service temporairement saturé.', 60);
      db.prepare(`INSERT INTO security_limits VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET
        count=CASE WHEN expires<=? THEN 1 ELSE count+1 END,
        expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END`).run(key, now + windowMs, now, now);
    },
    acquire(scope, max) {
      const count = active.get(scope) || 0;
      if (count >= max) throw new HttpError(503, 'Service occupé. Réessayez dans quelques instants.', 5);
      active.set(scope, count + 1);
      let released = false;
      return () => { if (!released) { released = true; const remaining = (active.get(scope) || 1) - 1; if (remaining) active.set(scope, remaining); else active.delete(scope); } };
    },
    audit(event) {
      // Only call with server-defined names / opaque IDs. Never include bodies or URLs.
      process.stdout.write(JSON.stringify({ type: 'security', time: new Date().toISOString(), ...event }) + '\n');
    },
  };
}
