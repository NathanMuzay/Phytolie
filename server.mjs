import { createServer } from 'node:http';
import { openAccounts, HttpError } from './server/accounts.mjs';
import { resolve } from 'node:path';
import { mapSuggestions } from './src/identification.mjs';

const PORT = Number(process.env.API_PORT || 8787);
const API_KEY = process.env.PLANT_ID_API_KEY;
const accounts = openAccounts(process.env.FOLIA_DB_PATH || resolve('data/folia.sqlite'));
const authAttempts = new Map();
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
  if (request.method === 'GET' && request.url === '/health') {
    return API_KEY
      ? send(response, 200, { status: 'ok' })
      : send(response, 503, { error: 'La clé PLANT_ID_API_KEY manque dans le fichier .env du serveur.' });
  }
  if (request.method !== 'POST' || request.url !== '/identify') return send(response, 404, { error: 'Route introuvable.' });
  if (!API_KEY) return send(response, 503, { error: 'La clé PLANT_ID_API_KEY manque dans le fichier .env du serveur.' });

  let body = '';
  request.on('data', chunk => {
    body += chunk;
    if (body.length > MAX_BODY) request.destroy();
  });
  request.on('error', () => send(response, 413, { error: 'La photo est trop volumineuse.' }));
  request.on('end', async () => {
    try {
      const { image } = JSON.parse(body);
      if (typeof image !== 'string' || image.length < 100) return send(response, 400, { error: 'Photo absente ou invalide.' });
      const apiResponse = await fetch('https://api.plant.id/v3/identification?details=common_names,taxonomy,watering,description&language=fr', {
        method: 'POST',
        headers: { 'Api-Key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: [image] }),
        signal: AbortSignal.timeout(45000),
      });
      if (!apiResponse.ok) {
        const message = apiResponse.status === 401 ? 'Clé plant.id invalide.' : apiResponse.status === 429 ? 'Crédits plant.id épuisés.' : 'Le service plant.id a refusé la requête.';
        return send(response, apiResponse.status, { error: message });
      }
      const result = await apiResponse.json();
      if (result?.result?.is_plant?.binary === false) return send(response, 422, { error: 'Aucune plante n’a été détectée sur cette photo.' });
      const suggestions = mapSuggestions(result);
      if (!suggestions.length) return send(response, 422, { error: 'La plante n’a pas pu être reconnue. Essayez une feuille nette et la plante entière.' });
      // Preserve the first result for older clients while exposing alternatives.
      return send(response, 200, { ...suggestions[0], suggestions });
    } catch (error) {
      const timedOut = error?.name === 'TimeoutError';
      return send(response, 502, { error: timedOut ? 'plant.id met trop de temps à répondre.' : 'Impossible de contacter plant.id.' });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`API Folia prête sur http://0.0.0.0:${server.address().port}`);
});
