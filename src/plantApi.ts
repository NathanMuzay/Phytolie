export type PlantIdentification = {
  commonName: string;
  scientificName: string;
  family: string;
  confidence: number;
  wateringAdvice: string;
};

type ApiError = { error?: string };

export async function identifyPlant(base64: string): Promise<PlantIdentification> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (!apiUrl) throw new Error('API_NOT_CONFIGURED');

  const response = await fetch(`${apiUrl}/identify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64.replace(/^data:image\/[^;]+;base64,/, '') }),
  });
  const data = await response.json() as PlantIdentification & ApiError;
  if (!response.ok) throw new Error(data.error || 'API_ERROR');
  return data;
}
