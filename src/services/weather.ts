export type City = { id: number; name: string; country: string; admin1?: string; latitude: number; longitude: number };
export type Weather = { temperature: number; fetchedAt: string; cityId: number };
async function json(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error('Service météo indisponible.');
    return await response.json();
  } catch { throw new Error('Météo inaccessible. La température saisie reste utilisée. Réessayez.'); }
  finally { clearTimeout(timeout); }
}
export async function searchCities(query: string): Promise<City[]> {
  if (query.trim().length < 2) throw new Error('Saisissez au moins deux caractères.');
  const data = await json(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=5&language=fr&format=json`);
  return (Array.isArray(data.results) ? data.results : []).filter((c: City) => Number.isFinite(c.id) && typeof c.name === 'string' && Number.isFinite(c.latitude) && Number.isFinite(c.longitude));
}
export async function fetchWeather(city: City): Promise<Weather> {
  const data = await json(`https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&current=temperature_2m`);
  const temperature = data.current?.temperature_2m;
  if (!Number.isFinite(temperature) || temperature < -80 || temperature > 65) throw new Error('Température météo invalide. La température saisie reste utilisée.');
  return { temperature, fetchedAt: new Date().toISOString(), cityId: city.id };
}
export function outdoorTemperature(weather: Weather | null, city: City | undefined, now = new Date()): number | undefined {
  if (!weather || !city || weather.cityId !== city.id) return undefined;
  const age = +now - Date.parse(weather.fetchedAt);
  return age >= 0 && age < 3 * 3600000 ? weather.temperature : undefined;
}
