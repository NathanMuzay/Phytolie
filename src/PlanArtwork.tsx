import React from 'react';
import { Platform } from 'react-native';
import { type HomePlan, type HomeWall } from './home';
import { pointOnWall, roomWall } from './homeEditor';
const svg = React.createElement;
export function wallPath(w: HomeWall): string {
  return `M ${w.start.x} ${w.start.y} ${w.control ? `Q ${w.control.x} ${w.control.y}` : 'L'} ${w.end.x} ${w.end.y}`;
}
export function structureElements(home: HomePlan, ink: string, paper: string, selected = ''): React.ReactNode[] {
  const elements: React.ReactNode[] = (home.walls ?? []).map(w => svg('path', { key: `wall-${w.id}`, 'data-key': `wall:${w.id}`, d: wallPath(w), fill: 'none', stroke: selected === `wall:${w.id}` ? '#B96D4F' : ink, strokeWidth: w.thickness, strokeLinecap: 'round', pointerEvents: 'stroke' }));
  for (const o of home.openings ?? []) {
    const a = home.areas.find(a => a.id === o.areaId);
    const w = o.wallId ? home.walls?.find(w => w.id === o.wallId) : a && o.side ? roomWall(a, o.side) : undefined;
    if (!w) continue;
    const { point, angle } = pointOnWall(w, o.offset);
    const color = selected === `opening:${o.id}` ? '#B96D4F' : o.kind === 'window' ? '#468399' : ink;
    const width = o.width, sign = o.outward ? -1 : 1, hinge = o.reversed ? width/2 : -width/2, direction = o.reversed ? -1 : 1;
    elements.push(svg('g', { key: `opening-${o.id}`, 'data-key': `opening:${o.id}`, transform: `translate(${point.x} ${point.y}) rotate(${angle})`, pointerEvents: 'all' },
      svg('rect', { x: -width/2, y: -.16, width, height: .32, fill: paper }),
      o.kind === 'window' ? svg('g', null,
        svg('line', { x1: -width/2, x2: width/2, y1: -.08, y2: -.08, stroke: color, strokeWidth: .05 }),
        svg('line', { x1: -width/2, x2: width/2, y1: .08, y2: .08, stroke: color, strokeWidth: .05 })) : svg('g', null,
        svg('path', { d: `M ${hinge+direction*width} 0 A ${width} ${width} 0 0 ${sign*direction > 0 ? 1 : 0} ${hinge} ${sign*width}`, fill: 'none', stroke: color, strokeWidth: .035, strokeDasharray: '.1 .08' }),
        svg('line', { x1: hinge, y1: 0, x2: hinge, y2: sign*width, stroke: color, strokeWidth: .07 }))));
  }
  return elements;
}
export function PlanArtwork({ home, ink, paper }: { home: HomePlan; ink: string; paper: string }) {
  if (Platform.OS !== 'web') return null;
  return svg('svg', { viewBox: `0 0 ${home.width} ${home.height}`, preserveAspectRatio: 'none', 'aria-hidden': true, style: { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' } }, ...structureElements(home, ink, paper));
}
