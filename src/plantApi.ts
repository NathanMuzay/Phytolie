import { validLandmarks, type Landmarks, type ImageSize } from './measurement.ts';
export type PlantIdentification = {
  commonName: string;
  scientificName: string;
  family: string;
  confidence: number;
  wateringAdvice: string;
  description?: string;
};

type ApiError = { error?: string };

async function requestJson(url: string, options: RequestInit, timeoutMs: number, timeoutMessage: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    let data;
    try { data = await response.json(); }
    catch (error) {
      if (controller.signal.aborted) throw error;
      throw new Error('Réponse du serveur invalide. Vérifiez EXPO_PUBLIC_API_URL et redémarrez Expo.');
    }
    if (!response.ok) throw new Error((data as ApiError)?.error || `Erreur du serveur (${response.status}).`);
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error(timeoutMessage);
    if (error instanceof TypeError) throw new Error(`Serveur Folia inaccessible (${url}). Lancez npm run api et vérifiez l’adresse EXPO_PUBLIC_API_URL et le Wi-Fi.`);
    throw error;
  } finally { clearTimeout(timer); }
}

export async function identifyPlant(base64: string): Promise<PlantIdentification[]> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');
  if (!apiUrl) throw new Error('API_NOT_CONFIGURED');

  // Check connectivity before uploading the photo or using identification credits.
  await requestJson(`${apiUrl}/health`, { method: 'GET' }, 5000,
    'Serveur Folia injoignable après 5 secondes. Lancez npm run api, vérifiez EXPO_PUBLIC_API_URL puis redémarrez Expo.');
  const result = await requestJson(`${apiUrl}/identify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64.replace(/^data:image\/[^;]+;base64,/, '') }),
  }, 55000, 'L’identification dépasse 55 secondes. Vérifiez votre connexion puis réessayez.') as PlantIdentification & { suggestions?: PlantIdentification[] };
  const suggestions = result.suggestions ?? [result];
  if (!Array.isArray(suggestions) || !suggestions.length || suggestions.some(s => !s || typeof s.scientificName !== 'string' || typeof s.commonName !== 'string' || !Number.isFinite(s.confidence))) {
    throw new Error('Résultats d’identification invalides. Réessayez ou saisissez l’espèce manuellement.');
  }
  return suggestions;
}

export async function detectPhotoDimensions(image: string, size: ImageSize, referenceCm: number, referenceDescription: string): Promise<Landmarks> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');
  if (!apiUrl) throw new Error('Serveur non configuré. Renseignez EXPO_PUBLIC_API_URL ou placez les points manuellement.');
  const result = await requestJson(`${apiUrl}/measure`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image, ...size, referenceCm, referenceDescription }),
  }, 55000, 'La mesure dépasse 55 secondes. Réessayez ou placez les points manuellement.');
  if (!validLandmarks(result?.points)) throw new Error('Points reçus invalides. Placez-les manuellement.');
  return result.points;
}
