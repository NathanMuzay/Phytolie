export type Point = { x: number; y: number };
export const landmarkNames = ['referenceStart', 'referenceEnd', 'plantTop', 'soilLevel', 'plantLeft', 'plantRight', 'potLeft', 'potRight'] as const;
export type LandmarkName = typeof landmarkNames[number];
export type Landmarks = Record<LandmarkName, Point>;
export type ImageSize = { width: number; height: number };
export type Dimensions = { height: number; width: number; pot: number };
export type Measurement = Dimensions & { method: 'vision' | 'guided'; referenceCm: number; measuredAt: string };

export function validLandmarks(value: unknown): value is Landmarks {
  if (!value || typeof value !== 'object') return false;
  return landmarkNames.every(key => {
    const p = (value as Landmarks)[key];
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
  });
}
export function validMeasurement(value: unknown): value is Measurement {
  const m = value as Measurement | undefined;
  return !!m && ['vision', 'guided'].includes(m.method) && Number.isFinite(m.referenceCm) && m.referenceCm >= 1 && m.referenceCm <= 200
    && Number.isFinite(Date.parse(m.measuredAt)) && [m.height, m.width].every(v => Number.isFinite(v) && v >= 1 && v <= 1000)
    && Number.isFinite(m.pot) && m.pot >= 1 && m.pot <= 100;
}
export function measureDimensions(points: Landmarks, image: ImageSize, referenceCm: number): Dimensions {
  if (!validLandmarks(points)) throw new Error('Placez les huit points sur la photo.');
  if (![image.width, image.height].every(v => Number.isFinite(v) && v > 0)) throw new Error('Dimensions de la photo indisponibles.');
  if (!Number.isFinite(referenceCm) || referenceCm < 1 || referenceCm > 200) throw new Error('La longueur du repère doit être comprise entre 1 et 200 cm.');
  const referencePixels = Math.hypot((points.referenceEnd.x - points.referenceStart.x) * image.width, (points.referenceEnd.y - points.referenceStart.y) * image.height);
  if (referencePixels < Math.max(image.width, image.height) * 0.04) throw new Error('Repère trop petit : rapprochez-le ou espacez ses deux points.');
  const scale = referenceCm / referencePixels;
  const raw = {
    height: (points.soilLevel.y - points.plantTop.y) * image.height * scale,
    width: (points.plantRight.x - points.plantLeft.x) * image.width * scale,
    pot: (points.potRight.x - points.potLeft.x) * image.width * scale,
  };
  if ([raw.height, raw.width, raw.pot].some(v => !Number.isFinite(v) || v < 1) || raw.height > 1000 || raw.width > 1000 || raw.pot > 100) {
    throw new Error('Mesures incohérentes : vérifiez l’ordre des points et la longueur du repère (pot : 1 à 100 cm).');
  }
  return { height: Math.round(raw.height * 10) / 10, width: Math.round(raw.width * 10) / 10, pot: Math.round(raw.pot * 10) / 10 };
}
// Image uses contain; touches in the letterbox must never become image coordinates.
export function imageFrame(image: ImageSize, frame: ImageSize) {
  const scale = Math.min(frame.width / image.width, frame.height / image.height);
  const width = image.width * scale, height = image.height * scale;
  return { width, height, left: (frame.width - width) / 2, top: (frame.height - height) / 2 };
}
export function pointFromTouch(x: number, y: number, image: ImageSize, frame: ImageSize): Point | null {
  if (![image.width, image.height, frame.width, frame.height].every(v => Number.isFinite(v) && v > 0)) return null;
  const rect = imageFrame(image, frame);
  const point = { x: (x - rect.left) / rect.width, y: (y - rect.top) / rect.height };
  return point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1 ? point : null;
}
