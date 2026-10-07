import { inside, type HomePlan, type PlantPosition } from './home.ts';
export type PlanPoint = { x: number; y: number };
export type DrawnRectangle = PlanPoint & { width: number; height: number };
// Snap both corners to 10 cm, keeping every drag direction inside the plan.
export function rectangleFromDrag(start: PlanPoint, end: PlanPoint, bounds: { width: number; height: number }, grid = .1): DrawnRectangle | null {
  if (![start.x, start.y, end.x, end.y, bounds.width, bounds.height].every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0 || !Number.isFinite(grid) || grid <= 0) return null;
  const snap = (value: number, max: number) => Math.min(max, Math.max(0, Math.round(Math.round(value / grid) * grid * 1000) / 1000));
  const a = { x: snap(start.x, bounds.width), y: snap(start.y, bounds.height) };
  const b = { x: snap(end.x, bounds.width), y: snap(end.y, bounds.height) };
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.round(Math.abs(b.x - a.x) * 1000) / 1000, height: Math.round(Math.abs(b.y - a.y) * 1000) / 1000 };
}

// Resolve a mouse drop into a room/garden without losing the plant’s other settings.
export function positionAtPoint(home: HomePlan, point: PlanPoint, previous?: PlantPosition): PlantPosition | undefined {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return undefined;
  const area = home.areas.find(area => inside(area, point));
  if (!area) return undefined;
  const x = Math.min(area.x + area.width, Math.max(area.x, Math.round(point.x * 10) / 10));
  const y = Math.min(area.y + area.height, Math.max(area.y, Math.round(point.y * 10) / 10));
  return { areaId: area.id, x, y, height: previous?.height ?? .5, preference: previous?.preference };
}
