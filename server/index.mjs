import { openDelegations } from './delegations.mjs';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { openAccounts, HttpError } from './accounts.mjs';
import { resolve } from 'node:path';
import { identifyImage, IdentificationError } from './identification.mjs';
import { detectDimensions, MeasurementError } from './measurement.mjs';
import { securityConfig, createSecurity, requestIdentity, securityHeaders } from './security.mjs';

process.umask(0o077);
const config = securityConfig();
const PORT = Number(process.env.API_PORT || 8787);
if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) throw new Error('API_PORT invalide.');
const API_KEY = process.env.PLANT_ID_API_KEY;
const accounts = openAccounts(process.env.FOLIA_DB_PATH || resolve('data/folia.sqlite'));
const delegations = openDelegations(accounts, HttpError);
const security = createSecurity(accounts.db, config);
const MINUTE = 60000, DAY = 86400000;

function send(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(status === 204 ? undefined : JSON.stringify(payload));
}
async function readJson(request, limit) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type'] || '')) throw new HttpError(415, 'Content-Type application/json requis.');
  if (request.headers['content-encoding'] && request.headers['content-encoding'] !== 'identity') throw new HttpError(415, 'Corps compressés non acceptés.');
  if (Number(request.headers['content-length']) > limit) throw new HttpError(413, 'Requête trop volumineuse.');
  let size = 0; const chunks = [];
  const timer = setTimeout(() => request.destroy(), 30000);
  try {
    for await (const chunk of request) {
      size += chunk.length;
      if (size > limit) throw new HttpError(413, 'Requête trop volumineuse.');
      chunks.push(chunk);
    }
    let input;
    try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new HttpError(400, 'Requête JSON invalide.'); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'Objet JSON requis.');
    return input;
  } finally { clearTimeout(timer); }
}
function methodFor(path) {
  if (path === '/guest/garden') return ['GET'];
  if (path === '/guest/water') return ['POST'];
  if (path === '/health') return ['GET'];
  if (path === '/garden') return ['GET', 'PUT'];
  if (path === '/delegations') return ['GET', 'POST'];
  if (path === '/delegations/activity') return ['GET'];
  if (['/auth/register', '/auth/login', '/auth/logout', '/auth/logout-all', '/auth/password', '/identify', '/measure', '/delegations/accept'].includes(path)) return ['POST'];
  const match = /^\/delegations\/[a-zA-Z0-9-]+\/(revoke|garden|water)$/.exec(path);
  return match ? [match[1] === 'garden' ? 'GET' : 'POST'] : undefined;
}

const server = createServer({ maxHeaderSize: 8192, headersTimeout: 10000, requestTimeout: 35000, keepAliveTimeout: 5000 }, async (request, response) => {
  const requestId = randomUUID(), start = Date.now();
  response.setHeader('X-Request-ID', requestId);
  let ip, userId, route = 'unknown';
  const releases = [];
  response.once('close', () => { for (const release of releases) release(); });
  response.once('finish', () => {
    security.audit({ event: 'http', requestId, route, method: ['GET', 'POST', 'PUT', 'OPTIONS', 'DELETE', 'HEAD', 'PATCH'].includes(request.method) ? request.method : 'OTHER', status: response.statusCode, durationMs: Date.now() - start,
      ...(ip ? { peer: security.fingerprint(ip) } : {}), ...(userId ? { userId } : {}) });
  });
  try {
    const originAllowed = securityHeaders(response, request, config, false);
    const identity = requestIdentity(request, config); ip = identity.ip;
    if (config.production && identity.secure) response.setHeader('Strict-Transport-Security', 'max-age=31536000');
    security.consume('http-ip', ip, 120, MINUTE);
    releases.push(security.acquire('requests', 16));
    if (!originAllowed) throw new HttpError(403, 'Origine non autorisée.');
    const methods = methodFor(request.url || '');
    if (!methods) throw new HttpError(404, 'Route introuvable.');
    route = request.url.startsWith('/delegations/') && !['/delegations/activity', '/delegations/accept'].includes(request.url) ? '/delegations/:id/' + request.url.split('/').at(-1) : request.url;
    if (request.method === 'OPTIONS') {
      const intended = request.headers['access-control-request-method'];
      if (intended && !methods.includes(intended)) throw new HttpError(405, 'Méthode non autorisée.');
      return send(response, 204);
    }
    if (!methods.includes(request.method)) {
      response.setHeader('Allow', methods.join(', '));
      throw new HttpError(405, 'Méthode non autorisée.');
    }
    if (route === '/health') return send(response, API_KEY ? 200 : 503, API_KEY ? { status: 'ok' } : { error: 'Service d’identification indisponible.' });
    if (['/auth/register', '/auth/login'].includes(route)) {
      if (route === '/auth/register' && !config.allowRegistration) throw new HttpError(403, 'Les inscriptions sont temporairement fermées.');
      security.consume('auth-ip', ip, 20, 15 * MINUTE);
      releases.push(security.acquire('password-hashing', 2));
      const input = await readJson(request, 4096);
      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : 'invalid';
      security.consume('auth-account', email, 10, 15 * MINUTE);
      const result = route === '/auth/register' ? await accounts.register(input) : await accounts.login(input);
      userId = result.user.id;
      return send(response, route === '/auth/register' ? 201 : 200, result);
    }
    const token = request.headers.authorization?.startsWith('Bearer ') ? request.headers.authorization.slice(7) : undefined;
    if (route === '/guest/garden' || route === '/guest/water') {
      security.consume('guest-ip', ip, 60, MINUTE);
      if (route === '/guest/garden') return send(response, 200, delegations.gardenWithLink(token));
      security.consume('guest-water', token || 'missing', 30, MINUTE);
      return send(response, 200, delegations.waterWithLink(token, await readJson(request, 4096)));
    }
    const user = accounts.authenticate(token); userId = user.id;
    security.consume('http-user', user.id, 120, MINUTE);
    if (route === '/auth/logout') { accounts.logout(token); return send(response, 200, { ok: true }); }
    if (route === '/auth/logout-all') return send(response, 200, accounts.logoutAll(token));
    if (route === '/auth/password') {
      security.consume('password-user', user.id, 5, 15 * MINUTE);
      releases.push(security.acquire('password-hashing', 2));
      return send(response, 200, await accounts.changePassword(token, await readJson(request, 4096)));
    }
    if (route === '/garden') {
      if (request.method === 'GET') return send(response, 200, accounts.getGarden(token));
      security.consume('garden-write', user.id, 30, MINUTE);
      releases.push(security.acquire('garden-upload', 2));
      return send(response, 200, accounts.putGarden(token, await readJson(request, 25 * 1024 * 1024)));
    }
    if (route === '/delegations') {
      if (request.method === 'GET') return send(response, 200, delegations.list(token));
      security.consume('delegation-create', user.id, 20, DAY);
      return send(response, 201, delegations.create(token, await readJson(request, 32768)));
    }
    if (route === '/delegations/activity') return send(response, 200, { activity: delegations.activity(token) });
    if (route === '/delegations/accept') {
      security.consume('delegation-accept', user.id, 20, 15 * MINUTE);
      return send(response, 200, delegations.accept(token, await readJson(request, 4096)));
    }
    const delegated = /^\/delegations\/([a-zA-Z0-9-]+)\/(revoke|garden|water)$/.exec(request.url);
    if (delegated) {
      const [, id, action] = delegated;
      if (action === 'revoke') return send(response, 200, delegations.revoke(token, id));
      if (action === 'garden') return send(response, 200, delegations.garden(token, id));
      return send(response, 200, delegations.water(token, id, await readJson(request, 4096)));
    }
    if (route === '/identify' || route === '/measure') {
      const service = route.slice(1);
      security.consume(`${service}-ip`, ip, 20, 15 * MINUTE);
      security.consume(`${service}-user`, user.id, 10, 15 * MINUTE);
      security.consume(`${service}-user-day`, user.id, 30, DAY);
      releases.push(security.acquire('providers', 4));
      releases.push(security.acquire(`provider-user:${user.id}`, 1));
      const input = await readJson(request, 12 * 1024 * 1024);
      if (service === 'identify' && !API_KEY) throw new HttpError(503, 'Service d’identification indisponible.');
      if (service === 'measure' && !process.env.OPENAI_API_KEY) throw new HttpError(503, 'Mesure IA non configurée (OPENAI_API_KEY). Placez les points manuellement.');
      security.consume(`${service}-budget`, 'global', service === 'identify' ? config.identifyDaily : config.measureDaily, DAY);
      const result = service === 'identify' ? await identifyImage(input.image, { apiKey: API_KEY }) : await detectDimensions(input);
      return send(response, 200, result);
    }
    throw new HttpError(404, 'Route introuvable.');
  } catch (error) {
    if (response.destroyed || response.headersSent) return;
    const known = error instanceof HttpError || error instanceof IdentificationError || error instanceof MeasurementError;
    if (!known) security.audit({ event: 'internal-error', requestId, route });
    const status = known ? error.status : 500;
    if (error.retryAfter) response.setHeader('Retry-After', String(error.retryAfter));
    // Closing avoids leaving unread oversized/untrusted bodies on a reusable connection.
    if (!request.complete) response.setHeader('Connection', 'close');
    return send(response, status, { error: known ? error.message : 'Erreur du serveur. Réessayez.', requestId });
  }
});
server.maxConnections = 100;
server.maxRequestsPerSocket = 100;
server.setTimeout(65000, socket => socket.destroy());
server.listen(PORT, config.host, () => console.log(`API Folia prête sur http://${config.host}:${server.address().port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.close(() => { accounts.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
});
