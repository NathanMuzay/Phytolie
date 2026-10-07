export type LightReading = {
  lux: number;
  measuredAt: string;
  method: 'sensor' | 'manual';
  room: string;
  artificialLight: boolean;
  curtainsClosed: boolean;
};

export function validLux(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 200000;
}

export function validLightReading(value: unknown): value is LightReading {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as LightReading;
  return validLux(r.lux) && typeof r.measuredAt === 'string' && Number.isFinite(Date.parse(r.measuredAt)) &&
    ['sensor', 'manual'].includes(r.method) && typeof r.room === 'string' && r.room.length <= 100 &&
    typeof r.artificialLight === 'boolean' && typeof r.curtainsClosed === 'boolean';
}

// A spot reading cannot determine direct sunlight or daily exposure.
export function lightAdvice(reading: LightReading): string {
  if (reading.lux < 1000) return 'La lumière est faible à cet instant. Si ce niveau persiste en journée, essayez un emplacement plus lumineux pour une plante qui aime la lumière vive.';
  if (reading.lux < 10000) return 'Cet emplacement reçoit de la lumière à cet instant. Un relevé à un autre moment de la journée peut aider à vérifier sa régularité.';
  return 'La lumière est forte à cet instant. Si le soleil frappe les feuilles, vérifiez que votre plante le tolère.';
}

export function medianLux(samples: number[]): number | undefined {
  const sorted = samples.filter(validLux).sort((a, b) => a - b);
  if (!sorted.length) return undefined;
  const middle = Math.floor(sorted.length / 2);
  return Math.round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}
