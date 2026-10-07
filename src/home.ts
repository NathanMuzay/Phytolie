export type Exposure = 'shade' | 'indirect' | 'sun';
export type HomeWindow = { id: string; wall: 'top' | 'right' | 'bottom' | 'left'; offset: number; width: number; sill: number; height: number; filtered: boolean; obstruction: 'none' | 'partial' | 'blocked' };
export type HomeArea = { id: string; name: string; kind: 'room' | 'garden'; x: number; y: number; width: number; height: number; windows: HomeWindow[]; shade: 'none' | 'partial' | 'blocked' };
export type HomeWall = { id: string; start: { x: number; y: number }; end: { x: number; y: number }; control?: { x: number; y: number }; thickness: number };
export type HomeOpening = { id: string; kind: 'door' | 'window'; areaId?: string; side?: HomeWindow['wall']; wallId?: string; offset: number; width: number; reversed: boolean; outward: boolean };
export type HomePlan = { version: 1; width: number; height: number; northAngle: number; floor: number; month: number; latitude?: number; background?: string; areas: HomeArea[]; walls?: HomeWall[]; openings?: HomeOpening[] };
export type PlantPosition = { areaId: string; x: number; y: number; height: number; preference?: Exposure };
export const exposureLabels: Record<Exposure, string> = { shade: 'Ombre / faible lumière', indirect: 'Lumière indirecte', sun: 'Soleil direct' };
export const newHome = (): HomePlan => ({ version: 1, width: 20, height: 15, northAngle: 0, floor: 0, month: new Date().getMonth() + 1, areas: [] });
const number = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
export function inside(area: HomeArea, point: { x: number; y: number }) { return point.x >= area.x && point.y >= area.y && point.x <= area.x + area.width && point.y <= area.y + area.height; }
export function validPosition(p: PlantPosition, home?: HomePlan): boolean {
  return !!p && typeof p.areaId === 'string' && number(p.x, 0, 100) && number(p.y, 0, 100) && number(p.height, 0, 5) && (p.preference == null || ['shade', 'indirect', 'sun'].includes(p.preference)) && !!home?.areas.some(a => a.id === p.areaId && inside(a, p));
}
export function validateHome(home: HomePlan): void {
  if (!home || home.version !== 1 || !number(home.width, 1, 100) || !number(home.height, 1, 100) || !number(home.northAngle, 0, 359) || !number(home.floor, -3, 100) || !Number.isInteger(home.floor) || !number(home.month, 1, 12) || !Number.isInteger(home.month) || (home.latitude != null && !number(home.latitude, -90, 90)) || !Array.isArray(home.areas) || home.areas.length > 60) throw new Error('Dimensions, orientation, étage ou latitude du plan invalides.');
  if (home.background != null && (typeof home.background !== 'string' || home.background.length > 4_000_000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(home.background))) throw new Error('Importez un plan en JPEG, PNG ou WebP de moins de 3 Mo.');
  const ids = new Set<string>();
  for (const a of home.areas) {
    if (!a || typeof a.id !== 'string' || !a.id || ids.has(a.id) || typeof a.name !== 'string' || !a.name.trim() || a.name.length > 100 || !['room', 'garden'].includes(a.kind) || !number(a.x, 0, home.width) || !number(a.y, 0, home.height) || !number(a.width, .5, home.width) || !number(a.height, .5, home.height) || a.x + a.width > home.width + 1e-6 || a.y + a.height > home.height + 1e-6 || !['none', 'partial', 'blocked'].includes(a.shade) || !Array.isArray(a.windows) || a.windows.length > 30) throw new Error('Pièce ou jardin invalide : vérifiez le nom, les dimensions et les limites du plan.');
    ids.add(a.id);
    const windowIds = new Set<string>();
    for (const w of a.windows) {
      const length = ['top', 'bottom'].includes(w?.wall) ? a.width : a.height;
      if (!w || typeof w.id !== 'string' || !w.id || windowIds.has(w.id) || !['top', 'right', 'bottom', 'left'].includes(w.wall) || !number(w.width, .1, length) || !number(w.offset, w.width / 2, length - w.width / 2) || !number(w.sill, 0, 5) || !number(w.height, .1, 5) || typeof w.filtered !== 'boolean' || !['none', 'partial', 'blocked'].includes(w.obstruction)) throw new Error('Fenêtre invalide : son centre et sa largeur doivent rester sur le mur.');
      windowIds.add(w.id);
    }
  }
  for (let i = 0; i < home.areas.length; i++) for (let j = i + 1; j < home.areas.length; j++) {
    const a = home.areas[i], b = home.areas[j];
    if (Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > .001 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > .001) throw new Error('Les pièces et jardins ne doivent pas se chevaucher.');
  }
  if (home.walls != null && (!Array.isArray(home.walls) || home.walls.length > 200)) throw new Error('Liste de murs invalide (200 maximum).');
  const wallIds = new Set<string>();
  const pointValid = (p: { x: number; y: number }) => !!p && number(p.x, 0, home.width) && number(p.y, 0, home.height);
  for (const w of home.walls ?? []) {
    if (!w || typeof w.id !== 'string' || !w.id || wallIds.has(w.id) || !pointValid(w.start) || !pointValid(w.end) || (w.control != null && !pointValid(w.control)) || Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y) < .1 || !number(w.thickness, .05, 1)) throw new Error('Mur invalide : vérifiez les points et l’épaisseur.');
    wallIds.add(w.id);
  }
  if (home.openings != null && (!Array.isArray(home.openings) || home.openings.length > 200)) throw new Error('Liste de portes et fenêtres invalide (200 maximum).');
  const openingIds = new Set<string>();
  for (const o of home.openings ?? []) {
    if (!o || typeof o.id !== 'string' || !o.id || openingIds.has(o.id) || !['door', 'window'].includes(o.kind) || typeof o.reversed !== 'boolean' || typeof o.outward !== 'boolean') throw new Error('Porte ou fenêtre invalide.');
    let length = 0;
    if (o.wallId != null) {
      const w = home.walls?.find(w => w.id === o.wallId);
      if (!w || o.areaId != null || o.side != null) throw new Error('Le mur de cette ouverture n’existe plus.');
      let last = w.start;
      for (let i = 1; i <= 40; i++) {
        const t = i / 40, c = w.control;
        const p = c ? { x: (1-t)**2*w.start.x+2*(1-t)*t*c.x+t*t*w.end.x, y: (1-t)**2*w.start.y+2*(1-t)*t*c.y+t*t*w.end.y } : { x: w.start.x+t*(w.end.x-w.start.x), y: w.start.y+t*(w.end.y-w.start.y) };
        length += Math.hypot(p.x-last.x, p.y-last.y); last = p;
      }
    } else {
      const a = home.areas.find(a => a.id === o.areaId && a.kind === 'room');
      if (!a || !['top', 'right', 'bottom', 'left'].includes(o.side ?? '') || o.kind !== 'door') throw new Error('Placez cette porte sur le mur d’une pièce.');
      length = o.side === 'top' || o.side === 'bottom' ? a.width : a.height;
    }
    if (!number(o.width, .1, length) || !number(o.offset, o.width/2, length-o.width/2)) throw new Error('L’ouverture doit rester entièrement sur son mur.');
    openingIds.add(o.id);
  }
}
export function speciesLight(species: string): { preference: Exposure; label: string; source: string } | null {
  const s = species.toLowerCase();
  if (/aloe|echeveria/.test(s)) return { preference: 'sun', label: 'Plante aimant une exposition lumineuse et ensoleillée', source: 'https://www.rhs.org.uk/plants/types/houseplants/houseplants-for-sunny-rooms' };
  if (/anthurium|ficus benjamina/.test(s)) return { preference: 'indirect', label: 'Plante de pièce lumineuse, à protéger du soleil prolongé', source: 'https://www.rhs.org.uk/plants/types/houseplants/houseplants-for-sunny-rooms' };
  if (/monstera/.test(s)) return { preference: 'indirect', label: 'Monstera : lumière indirecte', source: 'https://www.rhs.org.uk/plants/swiss-cheese-plants/how-to-grow-swiss-cheese-plants' };
  if (/phalaenopsis/.test(s)) return { preference: 'indirect', label: 'Phalaenopsis : lumière vive filtrée, éviter le soleil de midi', source: 'https://www.rhs.org.uk/plants/12596/phalaenopsis/details' };
  return null;
}
const rad = Math.PI / 180;
function sunVector(latitude: number, month: number, hour: number, north: number) {
  const day = Math.floor((Date.UTC(2024, month - 1, 21) - Date.UTC(2024, 0, 1)) / 86400000) + 1;
  const dec = 23.44 * rad * Math.sin(2 * Math.PI * (284 + day) / 365);
  const lat = latitude * rad, h = (hour - 12) * 15 * rad;
  const up = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(h);
  const east = -Math.cos(dec) * Math.sin(h), n = Math.cos(lat) * Math.sin(dec) - Math.sin(lat) * Math.cos(dec) * Math.cos(h);
  const angle = Math.atan2(east, n) - north * rad;
  return { x: Math.sin(angle), y: -Math.cos(angle), elevation: Math.asin(up) };
}
function windowPoint(a: HomeArea, w: HomeWindow) {
  return { x: a.x + (w.wall === 'left' ? 0 : w.wall === 'right' ? a.width : w.offset), y: a.y + (w.wall === 'top' ? 0 : w.wall === 'bottom' ? a.height : w.offset) };
}
function exposed(a: HomeArea, p: PlantPosition, v: ReturnType<typeof sunVector>): number {
  if (v.elevation <= 0) return 0;
  if (a.kind === 'garden') return { none: 1, partial: .5, blocked: 0 }[a.shade];
  const hits = [
    { wall: 'right', t: v.x > 1e-8 ? (a.x + a.width - p.x) / v.x : Infinity },
    { wall: 'left', t: v.x < -1e-8 ? (a.x - p.x) / v.x : Infinity },
    { wall: 'bottom', t: v.y > 1e-8 ? (a.y + a.height - p.y) / v.y : Infinity },
    { wall: 'top', t: v.y < -1e-8 ? (a.y - p.y) / v.y : Infinity },
  ].sort((a, b) => a.t - b.t);
  const hit = hits[0];
  const horizontal = hit.wall === 'top' || hit.wall === 'bottom';
  const offset = horizontal ? p.x + hit.t * v.x - a.x : p.y + hit.t * v.y - a.y;
  const height = p.height + hit.t * Math.tan(v.elevation);
  const window = a.windows.find(w => w.wall === hit.wall && !w.filtered && w.obstruction !== 'blocked' && Math.abs(offset - w.offset) <= w.width / 2 && height >= w.sill && height <= w.sill + w.height);
  return window ? (window.obstruction === 'partial' ? .5 : 1) : 0;
}
export function estimatePlacement(home: HomePlan, p: PlantPosition, species: string) {
  try { validateHome(home); } catch { return null; }
  if (!validPosition(p, home)) return null;
  const area = home.areas.find(a => a.id === p.areaId && inside(a, p));
  if (!area) return null;
  let brightness = area.kind === 'garden' ? { none: 1, partial: .6, blocked: .15 }[area.shade] : 0;
  let nearest = Infinity;
  for (const w of area.windows) {
    const point = windowPoint(area, w), distance = Math.hypot(p.x - point.x, p.y - point.y);
    nearest = Math.min(nearest, distance);
    const factor = { none: 1, partial: .55, blocked: .08 }[w.obstruction] * (w.filtered ? .65 : 1);
    brightness = Math.max(brightness, Math.min(1, w.width * w.height / (1 + distance * distance)) * factor);
  }
  let hours: number | null = null, midday = 0;
  if (home.latitude != null && (area.kind === 'garden' || area.windows.length > 0)) {
    hours = 0;
    for (let h = 0; h < 24; h += .25) {
      const amount = exposed(area, p, sunVector(home.latitude, home.month, h + .125, home.northAngle));
      hours += amount * .25;
      if (h >= 11 && h < 15) midday += amount * .25;
    }
  }
  const exposure: Exposure = hours != null && hours >= 1 ? 'sun' : brightness >= .3 ? 'indirect' : 'shade';
  const profile = speciesLight(species);
  const preference = p.preference ?? profile?.preference;
  let score: number | null = null;
  if (preference && home.latitude != null && (area.kind === 'garden' || area.windows.length > 0)) {
    score = preference === 'sun' ? Math.round(Math.min(100, 25 + brightness * 30 + Math.min(hours ?? 0, 6) / 6 * 45)) : preference === 'indirect' ? Math.round(Math.max(10, 100 - Math.max(0, .6 - brightness) * 100 - midday * 16 - Math.max(0, (hours ?? 0) - 2) * 5)) : Math.round(Math.max(10, 95 - (hours ?? 0) * 12 - Math.max(0, brightness - .5) * 40));
  }
  const reasons = [area.kind === 'garden' ? `Jardin : ombrage déclaré ${area.shade === 'none' ? 'absent' : area.shade === 'partial' ? 'partiel' : 'fort'}.` : `${area.windows.length} fenêtre(s) dans ${area.name}${Number.isFinite(nearest) ? ` ; fenêtre la plus proche à ${nearest.toFixed(1)} m` : ' : lumière naturelle non renseignée'}.`,
    hours == null ? home.latitude == null ? 'Latitude manquante : soleil direct et score non calculés. Renseignez la ville ou la latitude.' : 'Aucune fenêtre renseignée : ajoutez les fenêtres avant de calculer le soleil direct et le score.' : `Environ ${hours.toFixed(1)} h de soleil direct potentiel le 21 du mois choisi, par ciel dégagé (heures solaires).`,
    `Lumière diffuse ${brightness >= .6 ? 'plutôt forte' : brightness >= .3 ? 'modérée' : 'faible'} selon les dimensions, la distance et les filtres déclarés.`,
    ...(preference && hours != null ? [preference === 'sun' ? `Le score favorise la lumière diffuse et jusqu’à 6 h de soleil potentiel ; estimation actuelle : ${hours.toFixed(1)} h.` : preference === 'indirect' ? `Le score baisse si la lumière diffuse est faible ou si le soleil direct est prolongé, notamment autour de midi (${midday.toFixed(1)} h estimées).` : `Le score baisse avec la durée de soleil direct et une forte lumière diffuse.`] : []),
    p.preference ? `Besoin choisi manuellement : ${exposureLabels[p.preference]}.` : profile?.label ?? 'Espèce sans profil lumineux vérifié : choisissez un besoin ou consultez une fiche botanique.',
    'Estimation indicative : météo, reflets, mobilier et obstacles non renseignés ne sont pas simulés. Le score concerne seulement la lumière, pas la survie ni la résistance au gel.',
    `Étage déclaré : ${home.floor}. Il ne permet pas à lui seul de connaître les ombres extérieures.`];
  return { exposure, hours, score, reasons, confidence: home.latitude == null || (area.kind === 'room' && !area.windows.length) ? 'Faible' : 'Moyenne', source: p.preference ? undefined : profile?.source };
}
