import { inside, validateHome, type HomeArea, type HomePlan, type HomeWall, type HomeWindow, type PlantPosition } from './home.ts';
import type { PlanPoint } from './homeDrawing.ts';
export type EditorSnapshot = { home: HomePlan; positions: Record<string, PlantPosition | undefined> };
export type WallTarget = { areaId?: string; side?: HomeWindow['wall']; wallId?: string; offset: number; length: number; point: PlanPoint; angle: number };
export const editorId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
export function wallPoints(w: HomeWall): PlanPoint[] {
  return Array.from({ length: 41 }, (_, i) => {
    const t = i / 40, c = w.control;
    return c ? { x: (1-t)**2*w.start.x+2*(1-t)*t*c.x+t*t*w.end.x, y: (1-t)**2*w.start.y+2*(1-t)*t*c.y+t*t*w.end.y } : { x: w.start.x+t*(w.end.x-w.start.x), y: w.start.y+t*(w.end.y-w.start.y) };
  });
}
export function wallLength(w: HomeWall): number {
  const points = wallPoints(w);
  return points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x-points[i].x, p.y-points[i].y), 0);
}
export function roomWall(a: HomeArea, side: HomeWindow['wall']): HomeWall {
  const horizontal = side === 'top' || side === 'bottom';
  const start = { x: a.x + (side === 'right' ? a.width : 0), y: a.y + (side === 'bottom' ? a.height : 0) };
  return { id: '', start, end: { x: start.x + (horizontal ? a.width : 0), y: start.y + (horizontal ? 0 : a.height) }, thickness: .15 };
}
export function pointOnWall(w: HomeWall, offset: number): { point: PlanPoint; angle: number } {
  const points = wallPoints(w); let remaining = Math.max(0, offset);
  for (let i = 1; i < points.length; i++) {
    const a = points[i-1], b = points[i], length = Math.hypot(b.x-a.x, b.y-a.y);
    if (remaining <= length || i === points.length-1) {
      const t = length ? Math.min(1, remaining/length) : 0;
      return { point: { x: a.x+(b.x-a.x)*t, y: a.y+(b.y-a.y)*t }, angle: Math.atan2(b.y-a.y, b.x-a.x)*180/Math.PI };
    }
    remaining -= length;
  }
  return { point: w.start, angle: 0 };
}
export function nearestWall(home: HomePlan, point: PlanPoint, tolerance = .4): WallTarget | undefined {
  let best: WallTarget | undefined, distance = tolerance;
  const candidates = [
    ...home.areas.filter(a => a.kind === 'room').flatMap(a => (['top', 'right', 'bottom', 'left'] as const).map(side => ({ wall: roomWall(a, side), areaId: a.id, side, wallId: undefined as string | undefined }))),
    ...(home.walls ?? []).map(wall => ({ wall, wallId: wall.id, areaId: undefined as string | undefined, side: undefined as HomeWindow['wall'] | undefined })),
  ];
  for (const candidate of candidates) {
    const points = wallPoints(candidate.wall); let offset = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i-1], b = points[i], dx = b.x-a.x, dy = b.y-a.y, length = Math.hypot(dx, dy);
      const t = length ? Math.max(0, Math.min(1, ((point.x-a.x)*dx+(point.y-a.y)*dy)/(length*length))) : 0;
      const projection = { x: a.x+t*dx, y: a.y+t*dy }, d = Math.hypot(point.x-projection.x, point.y-projection.y);
      if (d < distance) { distance = d; best = { areaId: candidate.areaId, side: candidate.side, wallId: candidate.wallId, offset: offset+t*length, length: wallLength(candidate.wall), point: projection, angle: Math.atan2(dy, dx)*180/Math.PI }; }
      offset += length;
    }
  }
  return best;
}
export function replaceArea(snapshot: EditorSnapshot, area: HomeArea): EditorSnapshot {
  const previous = snapshot.home.areas.find(a => a.id === area.id);
  if (!previous) return snapshot;
  const home = { ...snapshot.home, areas: snapshot.home.areas.map(a => a.id === area.id ? area : a) };
  const positions = Object.fromEntries(Object.entries(snapshot.positions).map(([id, p]) => {
    if (!p || p.areaId !== area.id) return [id, p];
    const next = { ...p, x: area.x+(p.x-previous.x)/previous.width*area.width, y: area.y+(p.y-previous.y)/previous.height*area.height };
    return [id, inside(area, next) ? next : undefined];
  }));
  return { home, positions };
}
export function removeArea(snapshot: EditorSnapshot, id: string): EditorSnapshot {
  return { home: { ...snapshot.home, areas: snapshot.home.areas.filter(a => a.id !== id), openings: snapshot.home.openings?.filter(o => o.areaId !== id) }, positions: Object.fromEntries(Object.entries(snapshot.positions).map(([key, p]) => [key, p?.areaId === id ? undefined : p])) };
}
export function checkedSnapshot(snapshot: EditorSnapshot): EditorSnapshot {
  validateHome(snapshot.home); return snapshot;
}

// Keep apertures on their supporting wall when their width or the wall changes.
export function fitOpening<T extends { width: number; offset: number }>(opening: T, length: number): T {
  if (!Number.isFinite(opening.width) || opening.width < .1 || opening.width > length || !Number.isFinite(opening.offset)) return opening;
  return { ...opening, offset: Math.max(opening.width/2, Math.min(length-opening.width/2, opening.offset)) };
}
export function editWall(snapshot: EditorSnapshot, id: string, patch: Partial<HomeWall>): EditorSnapshot {
  const current = snapshot.home.walls?.find(w => w.id === id);
  if (!current) return snapshot;
  const next = { ...current, ...patch }, length = wallLength(next);
  return { ...snapshot, home: { ...snapshot.home,
    walls: snapshot.home.walls?.map(w => w.id === id ? next : w),
    openings: snapshot.home.openings?.map(o => o.wallId === id ? fitOpening({ ...o, width: Math.min(o.width, length) }, length) : o),
  } };
}
export function editWindow(snapshot: EditorSnapshot, areaId: string, id: string, patch: Partial<HomeWindow>): EditorSnapshot {
  const area = snapshot.home.areas.find(a => a.id === areaId);
  if (!area) return snapshot;
  return replaceArea(snapshot, { ...area, windows: area.windows.map(w => {
    if (w.id !== id) return w;
    const next = { ...w, ...patch }, length = next.wall === 'top' || next.wall === 'bottom' ? area.width : area.height;
    // A requested position outside the wall remains an error; only width edits relocate the centre.
    return patch.width != null ? fitOpening(next, length) : next;
  }) });
}
export function editOpening(snapshot: EditorSnapshot, id: string, patch: Partial<NonNullable<HomePlan['openings']>[number]>): EditorSnapshot {
  return { ...snapshot, home: { ...snapshot.home, openings: snapshot.home.openings?.map(o => {
    if (o.id !== id) return o;
    const next = { ...o, ...patch };
    const area = snapshot.home.areas.find(a => a.id === next.areaId);
    const wall = next.wallId ? snapshot.home.walls?.find(w => w.id === next.wallId) : area && next.side ? roomWall(area, next.side) : undefined;
    return wall && patch.width != null ? fitOpening(next, wallLength(wall)) : next;
  }) } };
}
