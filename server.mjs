import { createServer } from 'node:http';

const PORT = Number(process.env.API_PORT || 8787);
const API_KEY = process.env.PLANT_ID_API_KEY;
const MAX_BODY = 12 * 1024 * 1024;

function send(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  response.end(JSON.stringify(payload));
}

function wateringText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string').join(' · ');
  if (typeof value === 'object') {
    return Object.entries(value).filter(([, item]) => item != null).map(([key, item]) => `${key}: ${String(item)}`).join(' · ');
  }
  return String(value);
}

const server = createServer((request, response) => {
  if (request.method === 'OPTIONS') return send(response, 204, {});
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
        body: JSON.stringify({ images: [image], similar_images: false }),
        signal: AbortSignal.timeout(45000),
      });
      const result = await apiResponse.json();
      if (!apiResponse.ok) {
        const message = apiResponse.status === 401 ? 'Clé plant.id invalide.' : apiResponse.status === 429 ? 'Crédits plant.id épuisés.' : 'Le service plant.id a refusé la requête.';
        return send(response, apiResponse.status, { error: message });
      }
      if (result?.result?.is_plant?.binary === false) return send(response, 422, { error: 'Aucune plante n’a été détectée sur cette photo.' });
      const suggestion = result?.result?.classification?.suggestions?.[0];
      if (!suggestion) return send(response, 422, { error: 'La plante n’a pas pu être reconnue. Essayez une feuille nette et la plante entière.' });
      const details = suggestion.details || {};
      const commonNames = Array.isArray(details.common_names) ? details.common_names : [];
      return send(response, 200, {
        commonName: commonNames[0] || suggestion.name,
        scientificName: suggestion.name,
        family: details.taxonomy?.family || '',
        confidence: Number(suggestion.probability || 0),
        wateringAdvice: wateringText(details.watering),
      });
    } catch (error) {
      const timedOut = error?.name === 'TimeoutError';
      return send(response, 502, { error: timedOut ? 'plant.id met trop de temps à répondre.' : 'Impossible de contacter plant.id.' });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`API Folia prête sur http://0.0.0.0:${PORT}`);
});
