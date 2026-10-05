import sharp from 'sharp';
import { mapSuggestions } from '../src/identification.mjs';

export class IdentificationError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export async function normalizeIdentificationImage(image) {
  if (typeof image !== 'string') throw new IdentificationError(400, 'Photo absente ou invalide.');
  const base64 = image.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
  if (!base64 || base64.length > 12 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 === 1) {
    throw new IdentificationError(400, 'Photo invalide ou trop volumineuse. Choisissez une image de moins de 8 Mo.');
  }
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > 8 * 1024 * 1024) throw new IdentificationError(413, 'La photo dépasse 8 Mo. Choisissez une image plus petite.');
  try {
    const pipeline = sharp(bytes, { limitInputPixels: 40000000, failOn: 'warning' });
    const metadata = await pipeline.metadata();
    if (!['jpeg', 'png', 'webp', 'heif', 'gif', 'tiff'].includes(metadata.format)) throw new Error('Unsupported format');
    // Correct EXIF orientation, preserve aspect ratio, strip metadata and send <= 2 MP.
    const jpeg = await pipeline.rotate().resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }).jpeg({ quality: 85 }).toBuffer();
    return jpeg.toString('base64');
  } catch {
    throw new IdentificationError(400, 'Photo illisible ou format non pris en charge. Essayez une photo JPEG, PNG, WebP ou AVIF valide (40 mégapixels maximum).');
  }
}
export function identificationFailure(status, detail = '') {
  if (status === 401) return new IdentificationError(401, 'Clé plant.id invalide. Vérifiez PLANT_ID_API_KEY sur le serveur.');
  if (status === 402) return new IdentificationError(402, 'Crédits plant.id insuffisants. Vérifiez le solde dans votre compte Kindwise.');
  if (status === 403) return new IdentificationError(403, 'Accès plant.id refusé. Vérifiez que la clé est active et autorisée pour plant.id.');
  if (status === 429) return new IdentificationError(429, 'Limite plant.id atteinte. Vérifiez les quotas et le solde Kindwise, puis réessayez plus tard.');
  if ([400, 415, 422].includes(status) && /image|decode|format/i.test(detail)) return new IdentificationError(422, `plant.id ne peut pas lire cette photo (HTTP ${status}). Reprenez-la ou choisissez une autre image.`);
  if (status === 413) return new IdentificationError(413, 'plant.id refuse la taille de cette photo. Choisissez une image plus petite.');
  return new IdentificationError(status >= 500 ? 502 : 400, `plant.id a refusé l’analyse (HTTP ${status}). ${status >= 500 ? 'Le service est temporairement indisponible ; réessayez plus tard.' : 'Vérifiez les paramètres de l’API sur le serveur.'}`);
}
export async function identifyImage(image, { apiKey, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new IdentificationError(503, 'La clé PLANT_ID_API_KEY manque dans le fichier .env du serveur.');
  const normalized = await normalizeIdentificationImage(image);
  try {
    const response = await fetchImpl('https://api.plant.id/v3/identification?details=common_names,taxonomy,watering,description&language=fr', {
      method: 'POST', headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: [normalized] }), signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 2000);
      // Provider bodies can contain sensitive data. Only classified messages leave this module.
      throw identificationFailure(response.status, detail);
    }
    const result = await response.json();
    if (result?.result?.is_plant?.binary === false) throw new IdentificationError(422, 'Aucune plante n’a été détectée sur cette photo.');
    const suggestions = mapSuggestions(result);
    if (!suggestions.length) throw new IdentificationError(422, 'La plante n’a pas pu être reconnue. Essayez une feuille nette et la plante entière.');
    return { ...suggestions[0], suggestions };
  } catch (error) {
    if (error instanceof IdentificationError) throw error;
    throw new IdentificationError(502, error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'plant.id met trop de temps à répondre.' : 'Impossible de contacter plant.id ou réponse invalide. Réessayez.');
  }
}
