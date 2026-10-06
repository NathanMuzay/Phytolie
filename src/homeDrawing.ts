export type PlanPoint = { x: number; y: number };
export type DrawnRectangle = PlanPoint & { width: number; height: number };
// Snap both corners to 10 cm, keeping every drag direction inside the plan.
export function rectangleFromDrag(start: PlanPoint, end: PlanPoint, bounds: { width: number; height: number }): DrawnRectangle | null {
  if (![start.x, start.y, end.x, end.y, bounds.width, bounds.height].every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) return null;
  const snap = (value: number, max: number) => Math.min(max, Math.max(0, Math.round(value * 10) / 10));
  const a = { x: snap(start.x, bounds.width), y: snap(start.y, bounds.height) };
  const b = { x: snap(end.x, bounds.width), y: snap(end.y, bounds.height) };
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.round(Math.abs(b.x - a.x) * 1000) / 1000, height: Math.round(Math.abs(b.y - a.y) * 1000) / 1000 };
}
