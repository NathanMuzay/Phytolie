import { createServer } from 'node:http';
import { openAccounts, HttpError } from './server/accounts.mjs';
import { resolve } from 'node:path';
import { identifyImage, IdentificationError } from './server/identification.mjs';
import { detectDimensions, MeasurementError } from './server/measurement.mjs';

const PORT = Number(process.env.API_PORT || 8787);
const API_KEY = process.env.PLANT_ID_API_KEY;
const accounts = openAccounts(process.env.FOLIA_DB_PATH || resolve('data/folia.sqlite'));
const authAttempts = new Map();
const measurementAttempts = new Map();
const MAX_BODY = 12 * 1024 * 1024;

function send(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request, limit) {
  let size = 0; const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Requête trop volumineuse.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, 'Requête JSON invalide.'); }
}
const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return send(response, 204, {});
  if (request.url?.startsWith('/auth/') || request.url === '/garden') {
    try {
      const token = request.headers.authorization?.startsWith('Bearer ') ? request.headers.authorization.slice(7) : undefined;
      if (request.method === 'POST' && ['/auth/register', '/auth/login'].includes(request.url)) {
        const now = Date.now();
        for (const [key, value] of authAttempts) if (value.until <= now) authAttempts.delete(key);
        const key = request.socket.remoteAddress || 'unknown';
        const attempts = authAttempts.get(key) || { count: 0, until: now + 15 * 60000 };
        if (++attempts.count > 20) throw new HttpError(429, 'Trop de tentatives. Réessayez dans 15 minutes.');
        authAttempts.set(key, attempts);
        const input = await readJson(request, 4096);
        const result = request.url === '/auth/register' ? await accounts.register(input) : await accounts.login(input);
        return send(response, request.url === '/auth/register' ? 201 : 200, result);
      }
      if (request.method === 'POST' && request.url === '/auth/logout') { accounts.logout(token); return send(response, 200, { ok: true }); }
      if (request.method === 'GET' && request.url === '/garden') return send(response, 200, accounts.getGarden(token));
      if (request.method === 'PUT' && request.url === '/garden') {
        accounts.authenticate(token);
        return send(response, 200, accounts.putGarden(token, await readJson(request, 25 * 1024 * 1024)));
      }
      return send(response, 404, { error: 'Route introuvable.' });
    } catch (error) {
      return send(response, error instanceof HttpError ? error.status : 500, { error: error instanceof HttpError ? error.message : 'Erreur du serveur. Réessayez.' });
    }
  }
  if (request.method === 'POST' && request.url === '/measure') {
    try {
      const now = Date.now();
      for (const [key, value] of measurementAttempts) if (value.until <= now) measurementAttempts.delete(key);
      const key = request.socket.remoteAddress || 'unknown';
      const attempts = measurementAttempts.get(key) || { count: 0, until: now + 15 * 60000 };
      measurementAttempts.set(key, attempts);
      if (++attempts.count > 20) throw new HttpError(429, 'Trop de mesures. Réessayez dans 15 minutes ou placez les points manuellement.');
      return send(response, 200, await detectDimensions(await readJson(request, MAX_BODY)));
    } catch (error) {
      return send(response, error instanceof HttpError || error instanceof MeasurementError ? error.status : 500,
        { error: error instanceof HttpError || error instanceof MeasurementError ? error.message : 'Mesure impossible. Réessayez.' });
    }
  }
  if (request.method === 'GET' && request.url === '/health') {
    return API_KEY
      ? send(response, 200, { status: 'ok' })
      : send(response, 503, { error: 'La clé PLANT_ID_API_KEY manque dans le fichier .env du serveur.' });
  }
  if (request.method !== 'POST' || request.url !== '/identify') return send(response, 404, { error: 'Route introuvable.' });
  if (!API_KEY) return send(response, 503, { error: 'La clé PLANT_ID_API_KEY manque dans le fichier .env du serveur.' });

  try {
    const input = await readJson(request, MAX_BODY);
    return send(response, 200, await identifyImage(input?.image, { apiKey: API_KEY }));
  } catch (error) {
    const known = error instanceof IdentificationError || error instanceof HttpError;
    return send(response, known ? error.status : 500, { error: known ? error.message : 'Identification impossible. Réessayez.' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`API Folia prête sur http://0.0.0.0:${server.address().port}`);
});
