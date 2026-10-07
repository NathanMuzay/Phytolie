import * as ImagePicker from 'expo-image-picker';
import React, { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { validateHome, type HomeArea, type HomePlan, type HomeWall, type HomeWindow } from './home';
import { rectangleFromDrag, type PlanPoint } from './homeDrawing';
import { checkedSnapshot, editOpening, editWall, editWindow, editorId, nearestWall, pointOnWall, removeArea, replaceArea, roomWall, wallLength, type EditorSnapshot } from './homeEditor';
import { structureElements } from './PlanArtwork';
import { palette, useReadableStyles, useThemePalette } from '../../shared/ui/theme';
import type { Plant } from '../../shared/model';
const svg = React.createElement;
type Tool = 'select' | 'room' | 'garden' | 'wall' | 'curve' | 'door' | 'window' | 'pan';
type Drag = { origin: PlanPoint; snapshot: EditorSnapshot; key: string; handle?: string; view: { x: number; y: number; width: number; height: number } };
const tools: [Tool, string][] = [['select', '↖ Sélection'], ['room', '▭ Pièce'], ['garden', '▧ Jardin'], ['wall', '╱ Mur droit'], ['curve', '⌒ Mur arrondi'], ['door', '◴ Porte'], ['window', '▥ Fenêtre'], ['pan', '✥ Déplacer la vue']];

function EditorButton({ title, onPress, disabled = false, selected = false }: { title: string; onPress: () => void; disabled?: boolean; selected?: boolean }) {
  const styles = useReadableStyles(baseStyles);
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress} style={[styles.button, selected && styles.activeButton, disabled && { opacity: .4 }]}><Text style={styles.buttonText}>{title}</Text></Pressable>;
}
const displayProperty = (value: string | number) => typeof value === 'number' ? String(Math.round(value*1000)/1000) : value;
const PropertyValidation = createContext<(id: string, label?: string) => void>(() => {});
function Property({ label, value, onChange, numeric = false, allowEmpty = false }: { label: string; value: number | string; onChange: (value: string) => boolean; numeric?: boolean; allowEmpty?: boolean }) {
  const styles = useReadableStyles(baseStyles);
  const [text, setText] = useState(displayProperty(value));
  const [invalid, setInvalid] = useState(false);
  const focused = useRef(false), attempted = useRef<{ text: string; accepted: boolean } | undefined>(undefined);
  const report = useContext(PropertyValidation), id = useId();
  useEffect(() => { if (!focused.current) { setText(displayProperty(value)); setInvalid(false); report(id); attempted.current = undefined; } }, [value, label, id, report]);
  useEffect(() => () => report(id), [id, report]);
  function update(next: string) {
    setText(next);
    const complete = !numeric || /^-?\d+(?:[.,]\d*)?$/.test(next.trim()) || (allowEmpty && !next.trim());
    const accepted = complete && onChange(next);
    attempted.current = { text: next, accepted };
    setInvalid(!accepted); report(id, accepted ? undefined : label);
    return accepted;
  }
  function commit() {
    if (!attempted.current && text === displayProperty(value)) return;
    const accepted = attempted.current?.text === text ? attempted.current.accepted : update(text);
    if (accepted) setText(numeric && text.trim() ? String(Number(text.replace(',', '.'))) : text);
  }
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={text} onFocus={() => { focused.current = true; }} onChangeText={update} onBlur={() => { focused.current = false; commit(); }} onSubmitEditing={commit} keyboardType={numeric ? 'decimal-pad' : 'default'} maxLength={numeric ? 12 : 100} style={[styles.input, invalid && { borderColor: '#A33827' }]} />{invalid && <Text style={styles.error}>Valeur non appliquée : corrigez ce champ.</Text>}</View>;
}
export function DesktopHomeEditor({ initial, plants, onApply, onClose }: { initial: EditorSnapshot; plants: Plant[]; onApply: (snapshot: EditorSnapshot) => Promise<boolean>; onClose: () => void }) {
  const colors = useThemePalette(), styles = useReadableStyles(baseStyles), { width: screenWidth } = useWindowDimensions();
  const original = useRef(initial);
  const invalidProperties = useRef(new Map<string, string>());
  const reportProperty = useMemo(() => (id: string, label?: string) => { if (label) invalidProperties.current.set(id, label); else invalidProperties.current.delete(id); }, []);
  const [snapshot, setSnapshot] = useState(initial);
  const latestSnapshot = useRef(snapshot);
  const [tool, setTool] = useState<Tool>('select');
  const [selected, setSelected] = useState('');
  const [snap, setSnap] = useState(true), [grid, setGrid] = useState(true);
  const [preview, setPreview] = useState<EditorSnapshot>();
  const [view, setView] = useState({ x: -1, y: -1, width: initial.home.width+2, height: initial.home.height+2 });
  useEffect(() => { setView({ x: -1, y: -1, width: snapshot.home.width+2, height: snapshot.home.height+2 }); }, [snapshot.home.width, snapshot.home.height]);
  const [error, setError] = useState(''), [saving, setSaving] = useState(false), [confirmClose, setConfirmClose] = useState(false);
  const [, setHistoryRevision] = useState(0);
  const undo = useRef<EditorSnapshot[]>([]), redo = useRef<EditorSnapshot[]>([]), drag = useRef<Drag | null>(null);
  const current = preview ?? snapshot, home = current.home;
  const area = home.areas.find(a => `area:${a.id}` === selected);
  const wall = home.walls?.find(w => `wall:${w.id}` === selected);
  const opening = home.openings?.find(o => `opening:${o.id}` === selected);
  const windowArea = home.areas.find(a => a.windows.some(w => `window:${a.id}:${w.id}` === selected));
  const windowItem = windowArea?.windows.find(w => `window:${windowArea.id}:${w.id}` === selected);
  const dirty = useMemo(() => JSON.stringify(snapshot) !== JSON.stringify(original.current), [snapshot]);
  function publish(next: EditorSnapshot) {
    if (saving) return false;
    try { checkedSnapshot(next); } catch (e) { setError(e instanceof Error ? e.message : 'Modification invalide.'); return false; }
    if (JSON.stringify(next) === JSON.stringify(latestSnapshot.current)) { setError(''); return true; }
    undo.current = [...undo.current.slice(-39), latestSnapshot.current]; redo.current = []; latestSnapshot.current = next; setSnapshot(next); setError(''); setHistoryRevision(r => r+1); return true;
  }
  function step(direction: 'undo' | 'redo') {
    if (saving || drag.current) return;
    const source = direction === 'undo' ? undo : redo, target = direction === 'undo' ? redo : undo;
    const next = source.current.pop(); if (!next) return;
    target.current.push(latestSnapshot.current); latestSnapshot.current = next; setSnapshot(next); setPreview(undefined); setError(''); setHistoryRevision(r => r+1);
  }
  function removeSelected() {
    if (area) publish(removeArea(snapshot, area.id));
    else if (wall) publish({ ...snapshot, home: { ...snapshot.home, walls: snapshot.home.walls?.filter(w => w.id !== wall.id), openings: snapshot.home.openings?.filter(o => o.wallId !== wall.id) } });
    else if (opening) publish({ ...snapshot, home: { ...snapshot.home, openings: snapshot.home.openings?.filter(o => o.id !== opening.id) } });
    else if (windowArea && windowItem) publish(replaceArea(snapshot, { ...windowArea, windows: windowArea.windows.filter(w => w.id !== windowItem.id) }));
    setSelected('');
  }
  function close() { if (saving) return; if (dirty || invalidProperties.current.size) setConfirmClose(true); else onClose(); }
  async function apply() {
    if (saving) return;
    try {
      if (invalidProperties.current.size) throw new Error(`Corrigez les paramètres non appliqués : ${[...invalidProperties.current.values()].join(', ')}.`);
      const next = latestSnapshot.current;
      validateHome(next.home); setSaving(true); setError('');
      if (!await onApply(next)) setError('Enregistrement impossible. Votre plan reste dans l’éditeur.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement impossible.'); } finally { setSaving(false); }
  }
  function moveArea(a: HomeArea, patch: Partial<HomeArea>, source = snapshot) {
    const next = { ...a, ...patch };
    if (next.width !== a.width || next.height !== a.height) {
      next.windows = a.windows.map(w => { const ratio = (w.wall === 'top' || w.wall === 'bottom') ? next.width/a.width : next.height/a.height; return { ...w, width: w.width*ratio, offset: w.offset*ratio }; });
    }
    const result = replaceArea(source, next);
    result.home = { ...result.home, openings: result.home.openings?.map(o => { if (o.areaId !== a.id) return o; const ratio = (o.side === 'top' || o.side === 'bottom') ? next.width/a.width : next.height/a.height; return { ...o, offset: o.offset*ratio, width: o.width*ratio }; }) };
    return result;
  }
  function moveSelected(dx: number, dy: number) {
    if (area) publish(moveArea(area, { x: area.x+dx, y: area.y+dy }));
    else if (wall) publish({ ...snapshot, home: { ...snapshot.home, walls: snapshot.home.walls?.map(w => w.id === wall.id ? { ...w, start: { x: w.start.x+dx, y: w.start.y+dy }, end: { x: w.end.x+dx, y: w.end.y+dy }, control: w.control ? { x: w.control.x+dx, y: w.control.y+dy } : undefined } : w) } });
  }
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if (saving) return;
      const typing = e.target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable);
      if (e.key === 'Escape') { if (confirmClose) setConfirmClose(false); else { drag.current = null; setPreview(undefined); setTool('select'); } return; }
      if (typing || confirmClose || drag.current) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); step(e.shiftKey ? 'redo' : 'undo'); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); step('redo'); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void apply(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected(); }
      else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && (area || wall)) { e.preventDefault(); const step = e.shiftKey ? 1 : .1; moveSelected(e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0, e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  });
  function eventPoint(e: React.PointerEvent<SVGSVGElement>, raw = false): PlanPoint {
    const matrix = e.currentTarget.getScreenCTM();
    const point = matrix ? new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse()) : new DOMPoint();
    const unit = snap && !raw ? .1 : .001;
    return { x: Math.round(Math.round(point.x/unit)*unit*1000)/1000, y: Math.round(Math.round(point.y/unit)*unit*1000)/1000 };
  }
  function addOpening(point: PlanPoint) {
    const target = nearestWall(snapshot.home, point, .5);
    if (!target) { setError('Cliquez sur le mur d’une pièce ou sur un mur dessiné.'); return; }
    const width = Math.min(tool === 'door' ? .9 : 1.2, target.length);
    const offset = Math.max(width/2, Math.min(target.length-width/2, Math.round(target.offset*1000)/1000));
    const id = editorId();
    if (tool === 'window' && target.areaId) {
      const a = snapshot.home.areas.find(a => a.id === target.areaId)!;
      const w: HomeWindow = { id, wall: target.side!, offset, width, sill: .8, height: 1.4, filtered: false, obstruction: 'none' };
      publish(replaceArea(snapshot, { ...a, windows: [...a.windows, w] })); setSelected(`window:${a.id}:${id}`);
    } else {
      publish({ ...snapshot, home: { ...snapshot.home, openings: [...(snapshot.home.openings ?? []), { id, kind: tool === 'door' ? 'door' : 'window', areaId: target.areaId, side: target.side, wallId: target.wallId, offset, width, reversed: false, outward: false }] } }); setSelected(`opening:${id}`);
    }
    setTool('select');
  }
  function pointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (saving || e.button !== 0) return;
    const point = eventPoint(e, tool === 'pan');
    if (tool === 'door' || tool === 'window') { addOpening(point); return; }
    const element = e.target instanceof Element ? e.target.closest('[data-key]') : null;
    const key = element?.getAttribute('data-key') ?? '';
    const handle = element?.getAttribute('data-handle') ?? undefined;
    if (tool === 'select') setSelected(key);
    drag.current = { origin: point, snapshot, key, handle, view };
    e.currentTarget.setPointerCapture(e.pointerId); setError('');
  }
  function dragged(point: PlanPoint, d: Drag): EditorSnapshot | undefined {
    const dx = point.x-d.origin.x, dy = point.y-d.origin.y;
    if (tool === 'room' || tool === 'garden') {
      const rectangle = rectangleFromDrag(d.origin, point, d.snapshot.home, snap ? .1 : .01);
      if (!rectangle || rectangle.width < .5 || rectangle.height < .5) return;
      return { ...d.snapshot, home: { ...d.snapshot.home, areas: [...d.snapshot.home.areas, { ...rectangle, id: '__preview', kind: tool, name: tool === 'room' ? 'Nouvelle pièce' : 'Jardin', windows: [], shade: 'none' }] } };
    }
    if (tool === 'wall' || tool === 'curve') {
      const clamp = (p: PlanPoint) => ({ x: Math.max(0, Math.min(d.snapshot.home.width, p.x)), y: Math.max(0, Math.min(d.snapshot.home.height, p.y)) });
      const start = clamp(d.origin), end = clamp(point), length = Math.hypot(end.x-start.x, end.y-start.y);
      if (length < .1) return;
      const control = tool === 'curve' ? clamp({ x: (start.x+end.x)/2-(end.y-start.y)*.35, y: (start.y+end.y)/2+(end.x-start.x)*.35 }) : undefined;
      return { ...d.snapshot, home: { ...d.snapshot.home, walls: [...(d.snapshot.home.walls ?? []), { id: '__preview', start, end, control, thickness: .15 }] } };
    }
    if (tool !== 'select' || !d.key) return;
    const a = d.snapshot.home.areas.find(a => `area:${a.id}` === d.key);
    if (a) return moveArea(a, d.handle === 'resize' ? { width: Math.max(.5, a.width+dx), height: Math.max(.5, a.height+dy) } : { x: a.x+dx, y: a.y+dy }, d.snapshot);
    const w = d.snapshot.home.walls?.find(w => `wall:${w.id}` === d.key);
    if (w) {
      const next: HomeWall = d.handle ? { ...w, [d.handle]: point } : { ...w, start: { x: w.start.x+dx, y: w.start.y+dy }, end: { x: w.end.x+dx, y: w.end.y+dy }, control: w.control ? { x: w.control.x+dx, y: w.control.y+dy } : undefined };
      return editWall(d.snapshot, w.id, next);
    }
    const wa = d.snapshot.home.areas.find(a => a.windows.some(w => `window:${a.id}:${w.id}` === d.key));
    if (wa) {
      const window = wa.windows.find(w => `window:${wa.id}:${w.id}` === d.key)!;
      const offset = window.offset + (window.wall === 'top' || window.wall === 'bottom' ? dx : dy);
      return replaceArea(d.snapshot, { ...wa, windows: wa.windows.map(w => w.id === window.id ? { ...w, offset } : w) });
    }
    const o = d.snapshot.home.openings?.find(o => `opening:${o.id}` === d.key);
    if (o) {
      const source = o.wallId ? d.snapshot.home.walls?.find(w => w.id === o.wallId) : roomWall(d.snapshot.home.areas.find(a => a.id === o.areaId)!, o.side!);
      if (!source) return;
      const near = nearestWall({ ...d.snapshot.home, areas: o.areaId ? d.snapshot.home.areas.filter(a => a.id === o.areaId) : [], walls: o.wallId ? [source] : [] }, point, 2);
      if (!near) return;
      const offset = Math.max(o.width/2, Math.min(near.length-o.width/2, near.offset));
      return { ...d.snapshot, home: { ...d.snapshot.home, openings: d.snapshot.home.openings?.map(item => item.id === o.id ? { ...item, offset } : item) } };
    }
  }
  function pointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const d = drag.current; if (!d || saving) return;
    if (tool === 'pan') {
      const matrix = e.currentTarget.getScreenCTM();
      if (!matrix) return;
      const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
      setView(v => ({ ...v, x: v.x+d.origin.x-point.x, y: v.y+d.origin.y-point.y })); return;
    }
    setPreview(dragged(eventPoint(e), d));
  }
  function pointerUp(e: React.PointerEvent<SVGSVGElement>) {
    const d = drag.current; if (!d) return;
    const next = dragged(eventPoint(e), d); drag.current = null; setPreview(undefined);
    if (next) {
      const newArea = next.home.areas.find(a => a.id === '__preview'), newWall = next.home.walls?.find(w => w.id === '__preview'), id = editorId();
      if (newArea) { newArea.id = id; setSelected(`area:${id}`); }
      if (newWall) { newWall.id = id; setSelected(`wall:${id}`); }
      publish(next);
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }
  async function importPlan() {
    if (saving) return;
    setSaving(true); setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: .7 });
      if (result.canceled) return;
      const asset = result.assets[0];
      const background = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64 || ''}`;
      const next = { ...snapshot, home: { ...snapshot.home, background } };
      checkedSnapshot(next);
      undo.current = [...undo.current.slice(-39), snapshot]; redo.current = []; latestSnapshot.current = next; setSnapshot(next); setHistoryRevision(r => r+1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Import impossible. Choisissez une image JPEG, PNG ou WebP de moins de 3 Mo.'); }
    finally { setSaving(false); }
  }
  function zoom(factor: number) { setView(v => { const width = Math.max(2, Math.min(250, v.width*factor)); const ratio = width/v.width; return { x: v.x+(v.width-width)/2, y: v.y+(v.height-v.height*ratio)/2, width, height: v.height*ratio }; }); }
  function updateWall(patch: Partial<HomeWall>) { return wall ? publish(editWall(latestSnapshot.current, wall.id, patch)) : false; }
  function updateOpening(patch: Partial<NonNullable<HomePlan['openings']>[number]>) { return opening ? publish(editOpening(latestSnapshot.current, opening.id, patch)) : false; }
  function updateWindow(patch: Partial<HomeWindow>) { return windowArea && windowItem ? publish(editWindow(latestSnapshot.current, windowArea.id, windowItem.id, patch)) : false; }
  const number = (value: string) => value.trim() ? Number(value.replace(',', '.')) : NaN;
  const handleSize = view.width/120;
  const nodes: React.ReactNode[] = [];
  if (home.background) nodes.push(svg('image', { key: 'background', href: home.background, x: 0, y: 0, width: home.width, height: home.height, opacity: .35, preserveAspectRatio: 'none', pointerEvents: 'none' }));
  if (grid) {
    nodes.push(svg('defs', { key: 'griddef' }, svg('pattern', { id: 'editor-grid', width: 1, height: 1, patternUnits: 'userSpaceOnUse' }, svg('path', { d: 'M 1 0 L 0 0 0 1', fill: 'none', stroke: colors.line, strokeWidth: .02 }))));
    nodes.push(svg('rect', { key: 'grid', x: 0, y: 0, width: home.width, height: home.height, fill: 'url(#editor-grid)', pointerEvents: 'none' }));
  }
  if (grid) {
    const rulerStep = home.width > 40 || home.height > 40 ? 5 : 1;
    for (let x = 0; x <= home.width; x += rulerStep) nodes.push(svg('text', { key: `ruler-x-${x}`, x, y: -.2, fontSize: .16, fill: colors.muted, textAnchor: 'middle', pointerEvents: 'none' }, `${x}`));
    for (let y = 0; y <= home.height; y += rulerStep) nodes.push(svg('text', { key: `ruler-y-${y}`, x: -.2, y: y+.05, fontSize: .16, fill: colors.muted, textAnchor: 'end', pointerEvents: 'none' }, `${y}`));
  }
  nodes.push(svg('text', { key: 'north', x: home.width-.45, y: .6, fontSize: .3, fill: colors.olive, transform: `rotate(${-home.northAngle} ${home.width-.45} .6)`, pointerEvents: 'none' }, '↑ N'));
  nodes.push(svg('rect', { key: 'bounds', x: 0, y: 0, width: home.width, height: home.height, fill: 'none', stroke: colors.line, strokeWidth: .04, strokeDasharray: '.2 .2', pointerEvents: 'none' }));
  for (const a of home.areas) {
    nodes.push(svg('g', { key: `area-${a.id}`, 'data-key': `area:${a.id}` },
      svg('rect', { x: a.x, y: a.y, width: a.width, height: a.height, fill: a.kind === 'garden' ? colors.sage : colors.surface, fillOpacity: .65, stroke: selected === `area:${a.id}` ? colors.terracotta : colors.olive, strokeWidth: .09 }),
      svg('text', { x: a.x+.15, y: a.y+.4, fill: colors.ink, fontSize: .25, pointerEvents: 'none' }, a.name),
      svg('text', { x: a.x+.15, y: a.y+.72, fill: colors.muted, fontSize: .18, pointerEvents: 'none' }, `${(a.width*a.height).toFixed(1)} m² · ${a.width.toFixed(1)} × ${a.height.toFixed(1)} m`)));
    for (const w of a.windows) {
      const target = pointOnWall(roomWall(a, w.wall), w.offset);
      nodes.push(svg('g', { key: `window-${a.id}-${w.id}`, 'data-key': `window:${a.id}:${w.id}`, transform: `translate(${target.point.x} ${target.point.y}) rotate(${target.angle})` },
        svg('rect', { x: -w.width/2, y: -.13, width: w.width, height: .26, fill: w.filtered ? colors.sage : colors.paper, stroke: selected === `window:${a.id}:${w.id}` ? colors.terracotta : w.obstruction === 'blocked' ? '#A33827' : '#468399', strokeWidth: .04, strokeDasharray: w.obstruction === 'partial' ? '.1 .06' : undefined }),
        svg('line', { x1: -w.width/2, x2: w.width/2, y1: 0, y2: 0, stroke: '#468399', strokeWidth: .04 })));
    }
  }
  nodes.push(...structureElements(home, colors.olive, colors.paper, selected));
  if (windowArea && windowItem) {
    const location = pointOnWall(roomWall(windowArea, windowItem.wall), windowItem.offset).point;
    nodes.push(svg('text', { key: 'window-elevation', x: location.x, y: location.y+.45, textAnchor: 'middle', fontSize: .2, fill: colors.ink, pointerEvents: 'none' }, `Bas ${windowItem.sill} m · Hauteur ${windowItem.height} m${windowItem.filtered ? ' · Voilage' : ''}`));
  }

  for (const p of plants) {
    const position = current.positions[p.id]; if (!position) continue;
    nodes.push(svg('g', { key: `plant-${p.id}`, pointerEvents: 'none' }, svg('circle', { cx: position.x, cy: position.y, r: .13, fill: colors.terracotta }), svg('text', { x: position.x+.18, y: position.y+.08, fontSize: .18, fill: colors.ink }, p.name)));
  }
  function handle(point: PlanPoint, key: string, type: string) { return svg('rect', { key: `handle-${type}`, 'data-key': key, 'data-handle': type, x: point.x-handleSize/2, y: point.y-handleSize/2, width: handleSize, height: handleSize, fill: colors.surface, stroke: colors.terracotta, strokeWidth: .035, style: { cursor: type === 'resize' ? 'nwse-resize' : 'move' } }); }
  if (tool === 'select' && area) nodes.push(handle({ x: area.x+area.width, y: area.y+area.height }, selected, 'resize'));
  if (tool === 'select' && wall) {
    nodes.push(handle(wall.start, selected, 'start'), handle(wall.end, selected, 'end'));
    if (wall.control) { nodes.push(svg('path', { key: 'guide', d: `M ${wall.start.x} ${wall.start.y} L ${wall.control.x} ${wall.control.y} L ${wall.end.x} ${wall.end.y}`, stroke: colors.terracotta, strokeWidth: .025, strokeDasharray: '.12 .1', fill: 'none', pointerEvents: 'none' }), handle(wall.control, selected, 'control')); }
  }
  const instructions = tool === 'select' ? 'Cliquez pour sélectionner. Glissez pour déplacer ; utilisez les poignées pour ajuster.' : tool === 'pan' ? 'Glissez pour déplacer la vue.' : tool === 'door' || tool === 'window' ? 'Cliquez sur un mur pour poser une ouverture, puis réglez ses dimensions.' : 'Cliquez et glissez pour tracer. Échap annule. Les murs arrondis se règlent avec la poignée centrale.';
  return <Modal visible animationType="none" onRequestClose={close}><PropertyValidation.Provider value={reportProperty}><View style={styles.root}>
    <View style={styles.header}><View style={{ flex: 1 }}><Text accessibilityRole="header" style={styles.title}>Éditer ma maison</Text><Text style={styles.hint}>{dirty ? 'Modifications non enregistrées' : 'Plan actuel'} · {home.areas.length} zones · {home.walls?.length ?? 0} murs</Text></View><EditorButton title="Fermer" onPress={close} disabled={saving} /><EditorButton title={saving ? 'Enregistrement…' : 'Enregistrer et fermer'} onPress={() => void apply()} disabled={saving} /></View>
    <View style={styles.toolbar}>{tools.map(([value, title]) => <EditorButton key={value} title={title} selected={tool === value} disabled={saving} onPress={() => { drag.current = null; setPreview(undefined); setTool(value); setError(''); }} />)}<EditorButton title="↶ Annuler" disabled={!undo.current.length || saving} onPress={() => step('undo')} /><EditorButton title="↷ Rétablir" disabled={!redo.current.length || saving} onPress={() => step('redo')} /></View>
    <View style={[styles.workspace, { flexDirection: screenWidth >= 900 ? 'row' : 'column' }]}>
      <View style={styles.canvasPanel}><View style={styles.viewTools}><EditorButton title="−" disabled={saving} onPress={() => zoom(1.25)} /><EditorButton title="＋" disabled={saving} onPress={() => zoom(.8)} /><EditorButton title="Cadrer le plan" disabled={saving} onPress={() => setView({ x: -1, y: -1, width: home.width+2, height: home.height+2 })} /><Text style={styles.hint}>Grille 1 m</Text><Switch accessibilityLabel="Afficher la grille" value={grid} onValueChange={setGrid} /><Text style={styles.hint}>Aimant 10 cm</Text><Switch accessibilityLabel="Alignement sur dix centimètres" value={snap} onValueChange={setSnap} /></View>
        <View style={styles.canvas}>{svg('svg', { viewBox: `${view.x} ${view.y} ${view.width} ${view.height}`, role: 'img', 'aria-label': 'Éditeur du plan de maison', tabIndex: 0, onPointerDown: pointerDown, onPointerMove: pointerMove, onPointerUp: pointerUp, onPointerCancel: () => { drag.current = null; setPreview(undefined); }, onLostPointerCapture: () => { drag.current = null; setPreview(undefined); }, onWheel: (e: React.WheelEvent) => { if (e.ctrlKey || e.metaKey) return; zoom(e.deltaY > 0 ? 1.08 : .92); }, style: { width: '100%', height: '100%', minHeight: 350, display: 'block', touchAction: 'none', userSelect: 'none', cursor: tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair' } }, ...nodes)}</View><Text style={styles.hint}>{instructions}</Text><Text style={styles.hint}>Étage {home.floor} · Mois étudié : {home.month} · Latitude : {home.latitude == null ? 'non renseignée' : `${home.latitude}°`}</Text>
      </View>
      <ScrollView style={[styles.inspector, screenWidth < 900 && { maxHeight: 260, width: '100%' }]} contentContainerStyle={{ gap: 14, padding: 20 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>{area ? 'Pièce / jardin' : wall ? wall.control ? 'Mur arrondi' : 'Mur droit' : opening ? opening.kind === 'door' ? 'Porte' : 'Fenêtre' : windowItem ? 'Fenêtre extérieure' : 'Propriétés du plan'}</Text>
        <View key={selected || 'plan'} style={{ gap: 14 }}>{area ? <>
          <Property label="Nom de la zone" value={area.name} onChange={name => publish(moveArea(area, { name }))} />
          {(['x', 'y', 'width', 'height'] as const).map(key => <Property key={key} label={{ x: 'Position X (m)', y: 'Position Y (m)', width: 'Largeur (m)', height: 'Profondeur (m)' }[key]} value={area[key]} numeric onChange={v => publish(moveArea(area, { [key]: number(v) }))} />)}
          <Text style={styles.hint}>{(area.width*area.height).toFixed(1)} m² · Les plantes suivent le déplacement de leur pièce.</Text>
          {area.kind === 'garden' && (['none', 'partial', 'blocked'] as const).map(shade => <EditorButton key={shade} title={{ none: 'Dégagé', partial: 'Partiellement ombragé', blocked: 'Très ombragé' }[shade]} selected={area.shade === shade} onPress={() => publish(moveArea(area, { shade }))} />)}
          <EditorButton title="Dupliquer la zone" onPress={() => {
            for (let y = 0; y <= home.height-area.height; y += .5) for (let x = 0; x <= home.width-area.width; x += .5) {
              const copy = { ...area, id: editorId(), name: `${area.name} (copie)`.slice(0, 100), x, y, windows: area.windows.map(w => ({ ...w, id: editorId() })) };
              const next = { ...snapshot, home: { ...snapshot.home, areas: [...snapshot.home.areas, copy] } };
              try { checkedSnapshot(next); publish(next); setSelected(`area:${copy.id}`); return; } catch { /* Try the next free location. */ }
            }
            setError('Aucun espace libre pour dupliquer cette zone. Agrandissez le plan.');
          }} />
        </> : wall ? <>
          <Property label="Épaisseur du mur (m)" value={wall.thickness} numeric onChange={v => updateWall({ thickness: number(v) })} />
          <Text style={styles.hint}>Longueur : {wallLength(wall).toFixed(2)} m</Text>
          {(['start', 'end', ...(wall.control ? ['control'] as const : [])] as const).map(key => <View key={key} style={{ gap: 8 }}><Text style={styles.label}>{{ start: 'Début', end: 'Fin', control: 'Courbure' }[key]}</Text>{(['x', 'y'] as const).map(axis => <Property key={axis} label={`${key === 'control' ? 'Courbure' : key === 'start' ? 'Début' : 'Fin'} ${axis.toUpperCase()} (m)`} value={wall[key]![axis]} numeric onChange={v => updateWall({ [key]: { ...wall[key], [axis]: number(v) } })} />)}</View>)}
          <EditorButton title={wall.control ? 'Transformer en mur droit' : 'Transformer en mur arrondi'} onPress={() => updateWall({ control: wall.control ? undefined : { x: (wall.start.x+wall.end.x)/2, y: Math.min(home.height, (wall.start.y+wall.end.y)/2+1) } })} />
        </> : opening ? <>
          <Property label="Largeur de l’ouverture (m)" value={opening.width} numeric onChange={v => updateOpening({ width: number(v) })} />
          <Property label="Centre depuis le début du mur (m)" value={opening.offset} numeric onChange={v => updateOpening({ offset: number(v) })} />
          <Text style={styles.hint}>Le centre se mesure depuis le début du mur, avec au moins {Number((opening.width/2).toFixed(3))} m de marge à chaque extrémité.</Text>
          {opening.kind === 'door' ? <><EditorButton title="Inverser les charnières" onPress={() => updateOpening({ reversed: !opening.reversed })} /><EditorButton title="Inverser le sens d’ouverture" onPress={() => updateOpening({ outward: !opening.outward })} /></> : <Text style={styles.hint}>Fenêtre de cloison. Pour estimer la lumière naturelle, placez les fenêtres extérieures sur les contours d’une pièce.</Text>}
        </> : windowItem && windowArea ? <>
          {(['width', 'offset', 'sill', 'height'] as const).map(key => <Property key={key} label={{ width: 'Largeur vitrée (m)', offset: 'Centre depuis le début du mur (m)', sill: 'Bas de la fenêtre (m)', height: 'Hauteur vitrée (m)' }[key]} value={windowItem[key]} numeric onChange={v => updateWindow({ [key]: number(v) })} />)}
          <Text style={styles.hint}>Centre autorisé : {Number((windowItem.width/2).toFixed(3))} à {Number(((windowItem.wall === 'top' || windowItem.wall === 'bottom' ? windowArea.width : windowArea.height)-windowItem.width/2).toFixed(3))} m. Le bas et la hauteur vitrée sont des dimensions verticales.</Text>
          <Text style={styles.label}>Mur de la pièce</Text>{(['top', 'right', 'bottom', 'left'] as const).map(side => <EditorButton key={side} title={{ top: 'Haut', right: 'Droite', bottom: 'Bas', left: 'Gauche' }[side]} selected={windowItem.wall === side} onPress={() => { const length = side === 'top' || side === 'bottom' ? windowArea.width : windowArea.height; updateWindow({ wall: side, width: Math.min(windowItem.width, length), offset: length/2 }); }} />)}
          <Text style={styles.label}>Voilage / lumière filtrée</Text><Switch accessibilityLabel="Voilage sur la fenêtre" value={windowItem.filtered} onValueChange={filtered => { updateWindow({ filtered }); }} />
          {(['none', 'partial', 'blocked'] as const).map(obstruction => <EditorButton key={obstruction} title={{ none: 'Vue dégagée', partial: 'Obstacle partiel', blocked: 'Vue bloquée' }[obstruction]} selected={windowItem.obstruction === obstruction} onPress={() => updateWindow({ obstruction })} />)}
        </> : <>
          {(['width', 'height', 'northAngle', 'floor', 'month'] as const).map(key => <Property key={key} label={{ width: 'Largeur du plan (m)', height: 'Profondeur du plan (m)', northAngle: 'Nord depuis le haut (°)', floor: 'Étage', month: 'Mois étudié (1–12)' }[key]} value={home[key]} numeric onChange={v => publish({ ...snapshot, home: { ...snapshot.home, [key]: number(v) } })} />)}
          <Property label="Latitude (facultatif)" value={home.latitude ?? ''} numeric allowEmpty onChange={v => publish({ ...snapshot, home: { ...snapshot.home, latitude: v.trim() ? number(v) : undefined } })} />
          <EditorButton title="Importer un plan en image" onPress={() => void importPlan()} disabled={saving} />
          {home.background && <EditorButton title="Retirer le fond importé" onPress={() => publish({ ...snapshot, home: { ...snapshot.home, background: undefined } })} disabled={saving} />}
          <Text style={styles.hint}>Les pièces servent à placer les plantes. Les fenêtres extérieures, l’orientation et la latitude servent à estimer leur lumière. Les cloisons et portes décrivent l’aménagement ; leurs ombres ne sont pas calculées.</Text>
        </>}
        </View>
        {!!selected && <EditorButton title={area ? 'Supprimer la zone et ses placements' : wall ? 'Supprimer le mur et ses ouvertures' : 'Supprimer la sélection'} onPress={removeSelected} disabled={saving} />}
        <EditorButton title="Propriétés du plan" onPress={() => setSelected('')} />
        <Text style={styles.heading}>Zones du plan</Text>{home.areas.map(a => <EditorButton key={a.id} title={`${a.kind === 'garden' ? '▧' : '▭'} ${a.name}`} selected={selected === `area:${a.id}`} onPress={() => { setSelected(`area:${a.id}`); setTool('select'); }} />)}
        {!home.areas.length && <Text style={styles.hint}>Commencez par dessiner une pièce, puis ajoutez ses fenêtres et portes.</Text>}
      </ScrollView>
    </View>
    <View style={styles.footer}>{!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}<Text style={styles.hint}>Ctrl/Cmd Z : annuler · Maj Z / Ctrl Y : rétablir · Suppr : retirer · Flèches : déplacer · Maj : pas de 1 m · Molette : zoom · Échap : annuler le geste</Text></View>
    {confirmClose && <View style={styles.confirmOverlay}><View style={styles.confirm}><Text style={styles.heading}>Fermer sans enregistrer ?</Text><Text style={styles.text}>Les modifications faites dans cet éditeur seront abandonnées.</Text><EditorButton title="Continuer à modifier" onPress={() => setConfirmClose(false)} /><EditorButton title="Enregistrer et fermer" onPress={() => { setConfirmClose(false); void apply(); }} /><EditorButton title="Abandonner les modifications" onPress={onClose} /></View></View>}
  </View></PropertyValidation.Provider></Modal>;
}
const baseStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.paper }, header: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', padding: 18, borderBottomWidth: 1, borderColor: palette.line, backgroundColor: palette.surface }, title: { fontSize: 25, fontWeight: '600', color: palette.ink }, heading: { fontSize: 19, fontWeight: '600', color: palette.ink }, text: { fontSize: 16, color: palette.ink }, hint: { fontSize: 13, color: palette.muted, lineHeight: 20 }, toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, backgroundColor: palette.surface, borderBottomWidth: 1, borderColor: palette.line },
  workspace: { flex: 1, minHeight: 0 }, canvasPanel: { flex: 1, minWidth: 0, padding: 16, gap: 10 }, canvas: { flex: 1, minHeight: 350, borderWidth: 1, borderColor: palette.line, borderRadius: 12, overflow: 'hidden', backgroundColor: palette.paper }, viewTools: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }, inspector: { width: 310, flexGrow: 0, backgroundColor: palette.surface, borderLeftWidth: 1, borderColor: palette.line }, footer: { padding: 12, borderTopWidth: 1, borderColor: palette.line, gap: 6 },
  button: { minHeight: 44, justifyContent: 'center', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface }, activeButton: { backgroundColor: palette.sage, borderColor: palette.olive }, buttonText: { fontSize: 14, color: palette.ink }, field: { gap: 6 }, label: { color: palette.muted, fontSize: 14 }, input: { borderWidth: 1, borderColor: palette.line, borderRadius: 8, padding: 10, minHeight: 44, fontSize: 16, color: palette.ink, backgroundColor: palette.surface }, error: { color: '#A33827', fontSize: 15 }, confirmOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000060' }, confirm: { width: 440, maxWidth: '90%', padding: 24, gap: 16, borderRadius: 16, backgroundColor: palette.surface },
});
