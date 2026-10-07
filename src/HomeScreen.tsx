import { DesktopHomeEditor } from './DesktopHomeEditor';
import { PlanArtwork } from './PlanArtwork';
import { removeArea, type EditorSnapshot } from './homeEditor';
import { useAccessibility } from './AccessibilityProvider';
import { rectangleFromDrag, positionAtPoint, type DrawnRectangle, type PlanPoint } from './homeDrawing';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View, type ViewStyle } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { newHome, validateHome, inside, validPosition, estimatePlacement, exposureLabels, type HomeArea, type HomePlan, type PlantPosition, type HomeWindow, type Exposure } from './home';
import type { Plant } from './model';
import { palette, fonts, useReadableStyles, useThemePalette } from './theme';
const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
function Action({ title, onPress, disabled = false, expanded }: { title: string; onPress: () => void; disabled?: boolean; expanded?: boolean }) {
  const palette = useThemePalette();
  const styles = useReadableStyles(baseStyles);
  return <Pressable accessibilityRole="button" aria-expanded={expanded} accessibilityState={{ disabled, ...(expanded == null ? {} : { expanded }) }} disabled={disabled} onPress={onPress} style={[styles.button, disabled && { opacity: .45 }]}><Text style={styles.buttonText}>{title}</Text></Pressable>;
}
function Dropdown({ label, options, value, onChange, disabled = false }: { label: string; options: { id: string; name: string }[]; value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const styles = useReadableStyles(baseStyles);
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.id === value);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => {
    if (Platform.OS !== 'web' || !open) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);
  return <View style={{ gap: 8 }}><Text style={styles.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} : ${selected?.name || 'Aucun élément'}`} aria-expanded={open} accessibilityState={{ expanded: open, disabled: disabled || !options.length }} disabled={disabled || !options.length} onPress={() => setOpen(current => !current)} style={[styles.input, styles.dropdownTrigger, (disabled || !options.length) && { opacity: .45 }]}>
      <Text style={[styles.buttonText, { flex: 1 }]}>{selected?.name || 'Aucun élément'}</Text><Text style={styles.buttonText}>{open ? '▴' : '▾'}</Text>
    </Pressable>
    {open && <ScrollView accessibilityLabel={label} style={styles.dropdownMenu} keyboardShouldPersistTaps="handled" nestedScrollEnabled>{options.map(option => <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected: option.id === value }} onPress={() => { onChange(option.id); setOpen(false); }} style={[styles.dropdownOption, option.id === value && styles.dropdownSelected]}><Text style={styles.buttonText}>{option.id === value ? '✓ ' : ''}{option.name || 'Sans nom'}</Text></Pressable>)}</ScrollView>}
  </View>;
}
function Input({ label, value, change, numeric = false, disabled = false }: { label: string; value: string | number; change: (s: string) => void; numeric?: boolean; disabled?: boolean }) {
  const palette = useThemePalette();
  const styles = useReadableStyles(baseStyles);
  const [text, setText] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => { if (focused.current) return; setText(typeof value === 'number' && !Number.isFinite(value) ? '' : String(value)); }, [value]);
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} style={styles.input} value={numeric ? text : String(value)} onFocus={() => { focused.current = true; }} onChangeText={s => { if (numeric) { setText(s); if (!s.trim() || /^-?\d+(?:[.,]\d+)?$/.test(s)) change(s); } else change(s); }} onBlur={() => { focused.current = false; if (numeric) change(text); }} keyboardType={numeric ? 'decimal-pad' : 'default'} editable={!disabled} maxLength={numeric ? 12 : 100} /></View>;
}
export function PlanCanvas({ home, positions = [], onPoint, drawMode, onDraw, disabled = false, showMetadata = false, placementMode = false }: { home: HomePlan; positions?: { name: string; position: PlantPosition }[]; onPoint?: (p: PlanPoint) => void; drawMode?: 'room' | 'garden'; onDraw?: (rectangle: DrawnRectangle) => void; disabled?: boolean; showMetadata?: boolean; placementMode?: boolean }) {
  const { settings: appearance } = useAccessibility();
  const palette = useThemePalette();
  const styles = useReadableStyles(baseStyles);
  const [width, setWidth] = useState(600);
  const validDimensions = Number.isFinite(home.width) && Number.isFinite(home.height) && home.width > 0 && home.height > 0;
  const height = validDimensions ? Math.max(240, Math.min(600, width * home.height / home.width)) : 240;
  const sx = validDimensions ? width / home.width : 1, sy = validDimensions ? height / home.height : 1;
  const start = useRef<PlanPoint | null>(null);
  const [movingPoint, setMovingPoint] = useState<PlanPoint | null>(null);
  const [preview, setPreview] = useState<DrawnRectangle | null>(null);
  const drawing = !!drawMode && !disabled && validDimensions;
  const moving = placementMode && !drawMode && !disabled && validDimensions;
  const interacting = drawing || moving;
  useEffect(() => { start.current = null; setPreview(null); setMovingPoint(null); }, [drawMode, disabled, home.width, home.height, placementMode]);
  useEffect(() => {
    if (Platform.OS !== 'web' || !interacting) return;
    const cancel = (e: KeyboardEvent) => { if (e.key === 'Escape') { start.current = null; setPreview(null); setMovingPoint(null); } };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, [interacting]);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: event => interacting && (!('button' in event.nativeEvent) || event.nativeEvent.button === 0),
    onMoveShouldSetPanResponderCapture: () => interacting,
    onPanResponderGrant: event => {
      start.current = { x: event.nativeEvent.locationX / sx, y: event.nativeEvent.locationY / sy };
      if (drawing) setPreview(rectangleFromDrag(start.current, start.current, home));
      else if (moving) setMovingPoint(start.current);
    },
    onPanResponderMove: (_event, gesture) => {
      if (!start.current) return;
      const point = { x: start.current.x + gesture.dx / sx, y: start.current.y + gesture.dy / sy };
      if (drawing) setPreview(rectangleFromDrag(start.current, point, home));
      else if (moving) setMovingPoint(point);
    },
    onPanResponderRelease: (_event, gesture) => {
      const origin = start.current;
      start.current = null; setPreview(null); setMovingPoint(null);
      if (origin && drawing) {
        const rectangle = rectangleFromDrag(origin, { x: origin.x + gesture.dx / sx, y: origin.y + gesture.dy / sy }, home);
        if (rectangle) onDraw?.(rectangle);
      } else if (origin && moving) {
        onPoint?.({ x: origin.x + gesture.dx / sx, y: origin.y + gesture.dy / sy });
      }
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderTerminate: () => { start.current = null; setPreview(null); setMovingPoint(null); },
  }), [drawing, moving, interacting, sx, sy, home, onDraw, onPoint]);
  if (!validDimensions) return <Text style={styles.body}>Renseignez des dimensions positives pour afficher le plan.</Text>;
  return <View style={{ gap: 8 }}>{showMetadata && <Text style={styles.body}>Plan : {home.width} × {home.height} m · Nord à {home.northAngle}° du haut du plan</Text>}<View {...responder.panHandlers}><Pressable accessibilityRole="button" aria-disabled={disabled || (!drawing && !moving && !onPoint)} accessibilityLabel={drawMode ? "Plan du logement : cliquer et glisser pour dessiner une zone. La saisie des coordonnées reste disponible." : placementMode ? "Plan du logement : cliquer ou glisser avec la souris pour placer la plante. Échap annule le déplacement." : "Plan du logement : toucher pour sélectionner un emplacement. Les coordonnées peuvent aussi être saisies dans le formulaire."} onLayout={e => setWidth(e.nativeEvent.layout.width)} onPress={e => { if (!drawMode && !placementMode && !disabled && onPoint) onPoint({ x: Math.round(e.nativeEvent.locationX / sx * 10) / 10, y: Math.round(e.nativeEvent.locationY / sy * 10) / 10 }); }} style={[styles.canvas, { height, ...(Platform.OS === 'web' ? { cursor: drawing ? 'crosshair' : moving ? movingPoint ? 'grabbing' : 'grab' : 'pointer' } : {}) } as ViewStyle]}>
    {home.background && <View pointerEvents="none" style={StyleSheet.absoluteFill}><Image source={{ uri: home.background }} resizeMode="stretch" style={[StyleSheet.absoluteFill, { opacity: .4 }]} /></View>}
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: Math.min(100, Math.floor(home.width)) }, (_, x) => <View key={`x${x}`} style={{ position: 'absolute', left: x * sx, top: 0, bottom: 0, borderLeftWidth: 1, borderColor: '#D8D4BF60' }} />)}
      {Array.from({ length: Math.min(100, Math.floor(home.height)) }, (_, y) => <View key={`y${y}`} style={{ position: 'absolute', top: y * sy, left: 0, right: 0, borderTopWidth: 1, borderColor: '#D8D4BF60' }} />)}
      {home.areas.filter(a => [a.x, a.y, a.width, a.height].every(Number.isFinite)).map(a => <View key={a.id} style={{ position: 'absolute', left: a.x * sx, top: a.y * sy, width: a.width * sx, height: a.height * sy, borderWidth: 2, borderColor: palette.olive, backgroundColor: appearance.highContrast ? a.kind === 'garden' ? palette.sage : palette.surface : a.kind === 'garden' ? `${palette.sage}55` : `${palette.surface}40` }}><Text style={[styles.mapLabel, { padding: 5 }]}>{a.kind === 'garden' ? 'Jardin · ' : ''}{a.name}</Text>
        {a.windows.map(w => { const horizontal = w.wall === 'top' || w.wall === 'bottom'; return <View key={w.id} style={{ position: 'absolute', backgroundColor: appearance.highContrast ? '#17465E' : '#468399', width: horizontal ? w.width * sx : 5, height: horizontal ? 5 : w.width * sy, left: w.wall === 'right' ? a.width * sx - 5 : horizontal ? (w.offset - w.width / 2) * sx : -2, top: w.wall === 'bottom' ? a.height * sy - 5 : horizontal ? -2 : (w.offset - w.width / 2) * sy }} />; })}
      </View>)}
      {(!movingPoint ? positions : []).map(({ name, position }, i) => <View key={`${name}-${i}`} style={{ position: 'absolute', left: position.x * sx - 12, top: position.y * sy - 12 }}><Text style={styles.pin}>●</Text><Text style={styles.mapLabel}>{name}</Text></View>)}
      {movingPoint && <View style={{ position: 'absolute', left: movingPoint.x * sx - 12, top: movingPoint.y * sy - 12, opacity: .85 }}><Text style={[styles.pin, { color: positionAtPoint(home, movingPoint) ? palette.terracotta : '#A33827' }]}>●</Text><Text style={styles.mapLabel}>{positionAtPoint(home, movingPoint) ? 'Relâchez pour placer' : 'Hors d’une pièce ou du jardin'}</Text></View>}
      {preview && <View style={{ position: 'absolute', left: preview.x * sx, top: preview.y * sy, width: preview.width * sx, height: preview.height * sy, borderWidth: 2, borderStyle: 'dashed', borderColor: palette.terracotta, backgroundColor: appearance.highContrast ? palette.sage : drawMode === 'garden' ? `${palette.sage}80` : `${palette.terracotta}30` }}><Text style={[styles.mapLabel, { padding: 5 }]}>{preview.width.toFixed(1)} × {preview.height.toFixed(1)} m</Text></View>}
      <PlanArtwork home={home} ink={palette.olive} paper={palette.paper} />
      <Text style={[styles.mapLabel, { position: 'absolute', right: 10, top: 10, transform: [{ rotate: `${-home.northAngle}deg` }] }]}>↑ N</Text>
    </View>
  </Pressable></View><Text style={styles.hint}>Traits bleus : fenêtres · points terre cuite : plantes.</Text></View>;
}
export function ExposureDetails({ home, position, species }: { home: HomePlan; position: PlantPosition; species: string }) {
  const palette = useThemePalette();
  const styles = useReadableStyles(baseStyles), estimate = estimatePlacement(home, position, species);
  if (!estimate) return null;
  return <View style={styles.card}><Text style={styles.subtitle}>{estimate.hours == null ? 'Exposition à confirmer' : exposureLabels[estimate.exposure]} · {estimate.score == null ? 'Score non disponible' : `Compatibilité lumière : ${estimate.score}/100`}</Text><Text style={styles.body}>Confiance : {estimate.confidence} · mois étudié : {home.month}</Text>{estimate.reasons.map(reason => <Text key={reason} style={styles.body}>{reason}</Text>)}{estimate.source && <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(estimate.source!)}><Text style={styles.link}>Consulter les besoins de l’espèce (RHS) ↗</Text></Pressable>}</View>;
}
function PlacementDetails({ home, position, species, onChange, disabled }: { home: HomePlan; position: PlantPosition; species: string; onChange: (p: PlantPosition | undefined) => void; disabled: boolean }) {
  const palette = useThemePalette();
  const styles = useReadableStyles(baseStyles);
  return <View style={{ gap: 16 }}><Text style={styles.label}>Besoin lumineux : profil de l’espèce ou choix manuel</Text><View style={styles.row}><Action title="Profil de l’espèce" disabled={disabled} onPress={() => onChange({ ...position, preference: undefined })} />{(['shade', 'indirect', 'sun'] as Exposure[]).map(value => <Action key={value} title={`${position.preference === value ? '✓ ' : ''}${exposureLabels[value]}`} disabled={disabled} onPress={() => onChange({ ...position, preference: value })} />)}</View><ExposureDetails home={home} position={position} species={species} /><Action title="Retirer le pin" disabled={disabled} onPress={() => onChange(undefined)} /></View>;
}
export function PlacementPicker({ home, position, species, onChange, disabled = false, embedded = false }: { home: HomePlan; position?: PlantPosition; species: string; onChange: (p: PlantPosition | undefined) => void; disabled?: boolean; embedded?: boolean }) {
  const palette = useThemePalette();
  const styles = useReadableStyles(baseStyles);
  const [message, setMessage] = useState('');
  const [coordinates, setCoordinates] = useState(false);
  const [details, setDetails] = useState(false);
  const update = (patch: Partial<PlantPosition>) => { if (!position || disabled) return; const next = { ...position, ...patch }; if (validPosition(next, home)) { onChange(next); setMessage(''); } else setMessage('Le pin doit rester dans la zone choisie et sa hauteur entre 0 et 5 m.'); };
  return <View style={embedded ? { gap: 16 } : styles.card}>{!embedded && <Text style={styles.subtitle}>Emplacement de la plante</Text>}<Text style={styles.body}>Cliquez ou glissez sur le plan pour placer. Échap annule.</Text>
    <PlanCanvas home={home} placementMode disabled={disabled} positions={position ? [{ name: 'Votre plante', position }] : []} onPoint={p => { if (disabled) return; const next = positionAtPoint(home, p, position); if (next) { onChange(next); setMessage(''); } else setMessage('Déposez la plante à l’intérieur d’une pièce ou du jardin. Son emplacement précédent est conservé.'); }} />
    <Action title={coordinates ? 'Masquer les coordonnées' : 'Utiliser les coordonnées'} expanded={coordinates} disabled={disabled} onPress={() => setCoordinates(v => !v)} />
    {coordinates && <View style={{ gap: 12 }}><View style={styles.row}>{home.areas.map(a => <Action key={a.id} title={`${position?.areaId === a.id ? '✓ ' : ''}${a.name}`} disabled={disabled} onPress={() => { onChange({ areaId: a.id, x: a.x + a.width / 2, y: a.y + a.height / 2, height: position?.height ?? .5, preference: position?.preference }); setMessage(''); }} />)}</View>{position && <View style={styles.row}><Input label="Pin X (m)" value={position.x} numeric disabled={disabled} change={s => update({ x: Number(s.replace(',', '.')) })} /><Input label="Pin Y (m)" value={position.y} numeric disabled={disabled} change={s => update({ y: Number(s.replace(',', '.')) })} /><Input label="Hauteur du feuillage (m)" value={position.height} numeric disabled={disabled} change={s => update({ height: Number(s.replace(',', '.')) })} /></View>}</View>}
    {!embedded && position && <><Action title={details ? 'Moins de détails' : 'Plus de détails'} expanded={details} onPress={() => setDetails(v => !v)} />{details && <PlacementDetails home={home} position={position} species={species} disabled={disabled} onChange={onChange} />}</>}
    {!!message && <Text accessibilityRole="alert" style={styles.error}>{message}</Text>}
    {!home.areas.length && <Text style={styles.body}>Dessinez une pièce ou un jardin pour placer la plante.</Text>}
  </View>;
}
function AreaDetails({ area, active, blocked, onChange, onRemove, onSelect }: { area: HomeArea; active: boolean; blocked: boolean; onChange: (area: HomeArea) => void; onRemove: () => void; onSelect: () => void }) {
  const palette = useThemePalette();
  const styles = useReadableStyles(baseStyles);
  const [coordinates, setCoordinates] = useState(false);
  const updateArea = (patch: Partial<HomeArea>) => onChange({ ...area, ...patch });
  const updateWindow = (w: HomeWindow, patch: Partial<HomeWindow>) => updateArea({ windows: area.windows.map(item => item.id === w.id ? { ...w, ...patch } : item) });
  return <View style={[styles.card, active && { borderColor: palette.terracotta }]}><Text style={styles.subtitle}>{area.kind === 'garden' ? 'Jardin' : 'Pièce'} · {area.name}</Text><Action title="Sélectionner sur le plan" disabled={blocked} onPress={onSelect} /><Input label="Nom de la zone" value={area.name} disabled={blocked} change={name => updateArea({ name })} /><View style={styles.row}>{(['width', 'height'] as const).map(key => <Input key={key} numeric disabled={blocked} label={key === 'width' ? 'Largeur de la zone (m)' : 'Profondeur de la zone (m)'} value={area[key]} change={value => updateArea({ [key]: value.trim() ? Number(value.replace(',', '.')) : NaN })} />)}</View><Action title={coordinates ? 'Masquer les coordonnées' : 'Utiliser les coordonnées'} expanded={coordinates} disabled={blocked} onPress={() => setCoordinates(v => !v)} />{coordinates && <View style={styles.row}>{(['x', 'y'] as const).map(key => <Input key={key} numeric disabled={blocked} label={key === 'x' ? 'Zone X (m)' : 'Zone Y (m)'} value={area[key]} change={value => updateArea({ [key]: value.trim() ? Number(value.replace(',', '.')) : NaN })} />)}</View>}
      {area.kind === 'garden' ? <><Text style={styles.label}>Ombrage du jardin (arbres, murs, abri)</Text><View style={styles.row}>{(['none', 'partial', 'blocked'] as const).map(shade => <Action key={shade} title={`${area.shade === shade ? '✓ ' : ''}${{ none: 'Dégagé', partial: 'Partiellement ombragé', blocked: 'Très ombragé' }[shade]}`} disabled={blocked} onPress={() => updateArea({ shade })} />)}</View></> : <><Text style={styles.body}>Fenêtres donnant sur l’extérieur uniquement.</Text><Action title="＋ Fenêtre" disabled={blocked} onPress={() => updateArea({ windows: [...area.windows, { id: id(), wall: 'top', offset: area.width / 2, width: Math.min(1.2, area.width), sill: .8, height: 1.4, filtered: false, obstruction: 'none' }] })} />{area.windows.map((w, index) => <View key={w.id} style={styles.card}><Text style={styles.label}>Fenêtre {index + 1}</Text><Action title={coordinates ? 'Masquer les coordonnées' : 'Utiliser les coordonnées'} expanded={coordinates} disabled={blocked} onPress={() => setCoordinates(v => !v)} /><View style={styles.row}>{(['top', 'right', 'bottom', 'left'] as const).map(wall => <Action key={wall} title={`${w.wall === wall ? '✓ ' : ''}${{ top: 'Mur du haut', right: 'Mur droit', bottom: 'Mur du bas', left: 'Mur gauche' }[wall]}`} disabled={blocked} onPress={() => updateWindow(w, { wall, offset: (['top', 'bottom'].includes(wall) ? area.width : area.height) / 2 })} />)}</View>{coordinates && <View style={styles.row}>{(['offset', 'width', 'sill', 'height'] as const).map(key => <Input key={key} numeric disabled={blocked} label={{ offset: 'Centre depuis le début du mur (m)', width: 'Largeur de la fenêtre (m)', sill: 'Bas de la fenêtre au-dessus du sol (m)', height: 'Hauteur vitrée (m)' }[key]} value={w[key]} change={s => updateWindow(w, { [key]: s.trim() ? Number(s.replace(',', '.')) : NaN })} />)}</View>}<View style={styles.row}><Text style={styles.body}>Voilage / lumière filtrée</Text><Switch accessibilityLabel={`Voilage de la fenêtre ${index + 1}`} disabled={blocked} value={w.filtered} onValueChange={filtered => updateWindow(w, { filtered })} /></View><Text style={styles.label}>Obstacle extérieur devant cette fenêtre</Text><View style={styles.row}>{(['none', 'partial', 'blocked'] as const).map(obstruction => <Action key={obstruction} title={`${w.obstruction === obstruction ? '✓ ' : ''}${{ none: 'Aucun', partial: 'Partiel', blocked: 'Bloque la lumière' }[obstruction]}`} disabled={blocked} onPress={() => updateWindow(w, { obstruction })} />)}</View><Action title="Retirer cette fenêtre" disabled={blocked} onPress={() => updateArea({ windows: area.windows.filter(item => item.id !== w.id) })} /></View>)}</>}
      <Action title="Retirer cette zone et ses pins" disabled={blocked} onPress={onRemove} />
    </View>;
 }

function PlantDetailsEditor({ home, plant, position, active, disabled, onChange, onPosition, onSelect }: { home: HomePlan; plant: Plant; position?: PlantPosition; active: boolean; disabled: boolean; onChange: (patch: Partial<Plant>) => void; onPosition: (position: PlantPosition | undefined) => void; onSelect: () => void }) {
  const palette = useThemePalette();
  const styles = useReadableStyles(baseStyles);
  const [coordinates, setCoordinates] = useState(false);
  const [error, setError] = useState('');
  const changePosition = (patch: Partial<PlantPosition>) => {
    if (!position) return;
    const next = { ...position, ...patch };
    if (validPosition(next, home)) { onPosition(next); setError(''); }
    else setError('Le pin doit rester dans sa zone, avec une hauteur de 0 à 5 m.');
  };
  return <View style={[styles.card, active && { borderColor: palette.terracotta }]}><Text style={styles.subtitle}>{plant.name || 'Plante sans nom'}</Text><Action title="Sélectionner pour placer avec la souris" disabled={disabled} onPress={onSelect} />
    <Input label="Nom de la plante" value={plant.name} disabled={disabled} change={name => onChange({ name })} /><Input label="Espèce" value={plant.species} disabled={disabled} change={species => onChange({ species })} />
    <View style={styles.row}><Input label="Hauteur de la plante (cm)" value={plant.height} numeric disabled={disabled} change={v => onChange({ height: v.trim() ? Number(v.replace(',', '.')) : NaN })} /><Input label="Largeur du feuillage (cm, facultatif)" value={plant.width ?? ''} numeric disabled={disabled} change={v => onChange({ width: v.trim() ? Number(v.replace(',', '.')) : undefined })} /><Input label="Diamètre du pot (cm)" value={plant.pot} numeric disabled={disabled} change={v => onChange({ pot: v.trim() ? Number(v.replace(',', '.')) : NaN })} /><Input label="Température (°C)" value={plant.temperature} numeric disabled={disabled} change={v => onChange({ temperature: v.trim() ? Number(v.replace(',', '.')) : NaN })} /></View>
    <Input label="Terreau" value={plant.soil} disabled={disabled} change={soil => onChange({ soil })} />
    <Text style={styles.label}>{position ? `Zone : ${home.areas.find(a => a.id === position.areaId)?.name ?? 'à replacer'}` : 'Plante non placée'}</Text><View style={styles.row}>{home.areas.map(a => <Action key={a.id} title={`${position?.areaId === a.id ? '✓ ' : ''}${a.name}`} disabled={disabled} onPress={() => { onPosition({ areaId: a.id, x: a.x + a.width / 2, y: a.y + a.height / 2, height: position?.height ?? .5, preference: position?.preference }); setError(''); }} />)}</View>
    {position && <><Action title={coordinates ? 'Masquer les coordonnées' : 'Utiliser les coordonnées'} expanded={coordinates} disabled={disabled} onPress={() => setCoordinates(v => !v)} />{coordinates && <View style={styles.row}>{(['x', 'y', 'height'] as const).map(key => <Input key={key} label={{ x: 'Pin X (m)', y: 'Pin Y (m)', height: 'Hauteur du feuillage au-dessus du sol (m)' }[key]} value={position[key]} numeric disabled={disabled} change={v => changePosition({ [key]: v.trim() ? Number(v.replace(',', '.')) : NaN })} />)}</View>}<PlacementDetails home={home} position={position} species={plant.species} disabled={disabled} onChange={onPosition} /></>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  </View>;
}

export function HomeScreen({ home, plants, latitude, disabled, onSave }: { home?: HomePlan; plants: Plant[]; latitude?: number; disabled: boolean; onSave: (home: HomePlan, positions: Record<string, PlantPosition | undefined>, plants: Plant[]) => Promise<boolean> }) {
  const palette = useThemePalette();
  const styles = useReadableStyles(baseStyles);
  const { width: screenWidth } = useWindowDimensions();
  const sideBySide = Platform.OS === 'web' && screenWidth >= 860;
  const [details, setDetails] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [coordinates, setCoordinates] = useState(false);
  const [draftPlants, setDraftPlants] = useState(plants);
  const [draft, setDraft] = useState<HomePlan>(home ?? { ...newHome(), latitude });
  const [positions, setPositions] = useState<Record<string, PlantPosition | undefined>>(() => Object.fromEntries(plants.map(p => [p.id, p.position])));
  const [selected, setSelected] = useState(home?.areas[0]?.id ?? '');
  const [plantId, setPlantId] = useState(plants[0]?.id ?? '');
  const [drawError, setDrawError] = useState('');
  const [tool, setTool] = useState<'select' | 'room' | 'garden'>('select');
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [importing, setImporting] = useState(false);
  const area = draft.areas.find(a => a.id === selected) ?? draft.areas[0], plant = draftPlants.find(p => p.id === plantId) ?? draftPlants[0];
  const blocked = disabled || importing;
  const change = (next: HomePlan) => { setDraft(next); setMessage('Modifications non enregistrées.'); setError(''); };
  function updateArea(patch: Partial<HomeArea>) { if (area) change({ ...draft, areas: draft.areas.map(a => a.id === area.id ? { ...a, ...patch } : a) }); }
  function addArea(kind: 'room' | 'garden', point = { x: 0, y: 0 }) {
    const x = Math.min(point.x, draft.width - .5), y = Math.min(point.y, draft.height - .5);
    const next: HomeArea = { id: id(), name: kind === 'room' ? 'Nouvelle pièce' : 'Jardin', kind, x, y, width: Math.min(4, draft.width - x), height: Math.min(3, draft.height - y), windows: [], shade: 'none' };
    change({ ...draft, areas: [...draft.areas, next] }); setSelected(next.id); setTool('select');
  }
  async function importPlan() {
    setImporting(true); setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: .7 });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.base64) throw new Error('Impossible de lire le plan. Choisissez une autre image.');
      const background = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
      if (!/^data:image\/(jpeg|png|webp);base64,/.test(background) || background.length > 4_000_000) throw new Error('Choisissez une image JPEG, PNG ou WebP de moins de 3 Mo. Pour un PDF, exportez une page en image.');
      change({ ...draft, background });
    } catch (e) { setError(e instanceof Error ? e.message : 'Import impossible.'); } finally { setImporting(false); }
  }
  async function commit() {
    try {
      validateHome(draft);
      const editedPlants = draftPlants.map(p => ({ ...p, name: p.name.trim(), species: p.species.trim() || 'Espèce à préciser' }));
      for (const p of editedPlants) {
        if (!p.name || !Number.isFinite(p.height) || p.height <= 0 || !Number.isFinite(p.pot) || p.pot <= 0 || p.pot > 100 || !Number.isFinite(p.temperature) || p.temperature < -10 || p.temperature > 50 || (p.width != null && (!Number.isFinite(p.width) || p.width < 1 || p.width > 1000))) throw new Error(`Vérifiez les dimensions, le nom et la température de ${p.name || 'la plante sans nom'}.`);
      }
      const cleaned = Object.fromEntries(editedPlants.map(p => [p.id, positions[p.id] && validPosition(positions[p.id]!, draft) ? positions[p.id] : undefined]));
      const removed = Object.keys(positions).filter(key => positions[key] && !cleaned[key]).length;
      if (await onSave(draft, cleaned, editedPlants)) { setPositions(cleaned); setDraftPlants(editedPlants); setMessage(`Plan et emplacements enregistrés.${removed ? ` ${removed} pin(s) retiré(s) car leur zone a été supprimée ou déplacée.` : ''}`); setError(''); }
      else setError('Enregistrement impossible : vos modifications restent dans l’éditeur.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Plan invalide.'); }
  }
  return <View style={{ gap: 24 }}><Text accessibilityRole="header" style={styles.title}>Ma maison</Text>
    <View style={[styles.workspace, { flexDirection: sideBySide ? 'row' : 'column' }]}>
      {Platform.OS === 'web' ? <View style={[styles.card, sideBySide && styles.workspacePanel]}>
        <View style={styles.row}><Text style={[styles.subtitle, { flex: 1 }]}>Plan actuel</Text><Action title="Éditer le plan ↗" disabled={blocked} onPress={() => setEditorOpen(true)} /></View>
        <Text style={styles.body}>{draft.areas.length} zones · {draft.areas.reduce((sum, a) => sum+a.width*a.height, 0).toFixed(1)} m² · {draft.width} × {draft.height} m</Text>
        <PlanCanvas home={draft} positions={draftPlants.flatMap(p => positions[p.id] ? [{ name: p.name, position: positions[p.id]! }] : [])} disabled showMetadata />
        <Text style={styles.hint}>Ouvrez l’éditeur plein écran pour dessiner les pièces, murs droits ou arrondis, portes et fenêtres.</Text>
        {!draft.areas.length && <Action title="Créer ma maison" disabled={blocked} onPress={() => setEditorOpen(true)} />}
      </View> : (<View style={[styles.card, sideBySide && styles.workspacePanel]}><Text style={styles.subtitle}>Dessin de la maison</Text>
    <View style={styles.row}><Action title={importing ? 'Import…' : 'Importer un plan (image)'} disabled={blocked} onPress={() => void importPlan()} />{draft.background && <Action title="Retirer le fond importé" disabled={blocked} onPress={() => change({ ...draft, background: undefined })} />}<Action title={`${tool === 'room' ? '✓ ' : ''}Dessiner une pièce`} disabled={blocked} onPress={() => { setTool('room'); setDrawError(''); }} /><Action title={`${tool === 'garden' ? '✓ ' : ''}Dessiner un jardin`} disabled={blocked} onPress={() => { setTool('garden'); setDrawError(''); }} /><Action title="Sélectionner" disabled={blocked} onPress={() => { setTool('select'); setDrawError(''); }} /></View>
    <Text style={styles.body}>{tool === 'select' ? 'Cliquez sur une zone pour la sélectionner.' : 'Cliquez-glissez pour dessiner. Échap annule le tracé.'}</Text>
    <PlanCanvas home={draft} positions={draftPlants.flatMap(p => positions[p.id] ? [{ name: p.name, position: positions[p.id]! }] : [])} disabled={blocked} drawMode={tool === 'select' ? undefined : tool} onDraw={rectangle => {
      if (blocked || tool === 'select') return;
      if (rectangle.width < .5 || rectangle.height < .5) { setDrawError('Tracez une zone d’au moins 0,5 × 0,5 m en maintenant le bouton de la souris.'); return; }
      const next: HomeArea = { ...rectangle, id: id(), name: tool === 'room' ? 'Nouvelle pièce' : 'Jardin', kind: tool, windows: [], shade: 'none' };
      if (draft.areas.some(a => Math.min(a.x + a.width, next.x + next.width) > Math.max(a.x, next.x) + .001 && Math.min(a.y + a.height, next.y + next.height) > Math.max(a.y, next.y) + .001)) { setDrawError('Cette zone chevauche une autre zone. Retracez-la dans un espace libre.'); return; }
      setDrawError(''); change({ ...draft, areas: [...draft.areas, next] }); setSelected(next.id);
    }} onPoint={point => { if (!blocked) setSelected(draft.areas.find(a => inside(a, point))?.id ?? ''); }} />
    {!!drawError && <Text accessibilityRole="alert" style={styles.error}>{drawError}</Text>}
        <Action title={coordinates ? 'Masquer les coordonnées' : 'Utiliser les coordonnées'} expanded={coordinates} disabled={blocked} onPress={() => setCoordinates(v => !v)} />
        {coordinates && <View style={{ gap: 16 }}><View style={styles.row}>{(['width', 'height'] as const).map(key => <Input key={key} disabled={blocked} numeric label={key === 'width' ? 'Largeur du plan (m)' : 'Hauteur du plan (m)'} value={draft[key]} change={s => change({ ...draft, [key]: s.trim() ? Number(s.replace(',', '.')) : NaN })} />)}</View><View style={styles.row}><Action title="＋ Pièce par coordonnées" disabled={blocked} onPress={() => addArea('room')} /><Action title="＋ Jardin par coordonnées" disabled={blocked} onPress={() => addArea('garden')} /></View>{area && <><Text style={styles.label}>Coordonnées de {area.name}</Text>
<View style={styles.row}>{(['x', 'y', 'width', 'height'] as const).map(key => <Input key={key} numeric disabled={blocked} label={{ x: 'Zone X (m)', y: 'Zone Y (m)', width: 'Largeur de la zone (m)', height: 'Profondeur de la zone (m)' }[key]} value={area[key]} change={s => updateArea({ [key]: s.trim() ? Number(s.replace(',', '.')) : NaN })} />)}</View></>}</View>}
      </View>)}
      <View style={[styles.card, sideBySide && styles.workspacePanel]}><Text style={styles.subtitle}>Plantes à placer</Text><Text style={styles.body}>Choisissez la plante à placer.</Text><Dropdown label="Plante à placer" options={draftPlants} value={plant?.id ?? ''} disabled={blocked} onChange={setPlantId} />{plant ? <PlacementPicker key={plant.id} embedded home={draft} species={plant.species} position={positions[plant.id]} disabled={blocked} onChange={p => { setPositions(current => ({ ...current, [plant.id]: p })); setMessage('Emplacements non enregistrés.'); }} /> : <><PlanCanvas home={draft} disabled /><Text style={styles.body}>Ajoutez une plante à votre collection pour la placer sur le plan.</Text></>}</View>
    </View>
    <Action title={details ? 'Moins de détails' : 'Plus de détails'} expanded={details} onPress={() => setDetails(v => !v)} />
    {details && <View style={{ gap: 24 }}>
    {Platform.OS !== 'web' && <View style={styles.card}><Text style={styles.subtitle}>Orientation et exposition</Text><View style={styles.row}>{(['northAngle', 'floor', 'month'] as const).map(key => <Input key={key} disabled={blocked} numeric label={{ northAngle: 'Orientation du haut du plan (0° nord, 90° est)', floor: 'Étage (0 = rez-de-chaussée)', month: 'Mois étudié (1 à 12)' }[key]} value={draft[key]} change={s => change({ ...draft, [key]: s.trim() ? Number(s.replace(',', '.')) : NaN })} />)}<Input label="Latitude (−90 à 90, nécessaire au calcul solaire)" value={draft.latitude ?? ''} numeric disabled={blocked} change={s => change({ ...draft, latitude: s.trim() ? Number(s.replace(',', '.')) : undefined })} /></View>{latitude != null && <Action title="Utiliser la latitude de ma ville" disabled={blocked} onPress={() => change({ ...draft, latitude })} />}<Text style={styles.hint}>Ville dans « Mon espace ». Calcul par mois, en heures solaires, sans météo. L’étage est informatif.</Text></View>}      <View style={[styles.workspace, { flexDirection: sideBySide ? 'row' : 'column' }]}>
        {Platform.OS !== 'web' && <View style={[styles.card, sideBySide && styles.workspacePanel]}><Text accessibilityRole="header" style={styles.subtitle}>Pièces et jardins · {draft.areas.length}</Text><Dropdown label="Pièce ou jardin à afficher" options={draft.areas} value={area?.id ?? ''} disabled={blocked} onChange={value => { setSelected(value); setTool('select'); }} /><ScrollView key={area?.id} accessibilityLabel="Détails de la pièce ou du jardin sélectionné" style={[styles.detailsScroll, { height: 440 }]} contentContainerStyle={styles.detailsContent} showsVerticalScrollIndicator persistentScrollbar nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {draft.areas.filter(a => a.id === area?.id).map(a => <AreaDetails key={a.id} area={a} active={area?.id === a.id} blocked={blocked} onSelect={() => { setSelected(a.id); setTool('select'); }} onChange={next => change({ ...draft, areas: draft.areas.map(item => item.id === a.id ? next : item) })} onRemove={() => { const next = removeArea({ home: draft, positions }, a.id); change(next.home); setPositions(next.positions); if (selected === a.id) setSelected(''); }} />)}
          {!draft.areas.length && <Text style={styles.body}>Dessinez une pièce ou un jardin pour afficher ses détails ici.</Text>}
        </ScrollView></View>}
        <View style={[styles.card, sideBySide && styles.workspacePanel]}><Text accessibilityRole="header" style={styles.subtitle}>Plantes · {draftPlants.length}</Text><Dropdown label="Plante à afficher" options={draftPlants} value={plant?.id ?? ''} disabled={blocked} onChange={setPlantId} /><ScrollView key={plant?.id} accessibilityLabel="Détails de la plante sélectionnée" style={[styles.detailsScroll, !sideBySide && { height: 440 }, Platform.OS === 'web' && ({ overflowY: 'scroll', scrollbarGutter: 'stable', overscrollBehavior: 'contain' } as ViewStyle)]} contentContainerStyle={styles.detailsContent} showsVerticalScrollIndicator persistentScrollbar nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {draftPlants.filter(p => p.id === plant?.id).map(p => <PlantDetailsEditor key={p.id} home={draft} plant={p} position={positions[p.id]} active={plant?.id === p.id} disabled={blocked} onSelect={() => setPlantId(p.id)} onChange={patch => { setDraftPlants(current => current.map(item => {
            if (item.id !== p.id) return item;
            const next = { ...item, ...patch };
            if ('height' in patch || 'width' in patch || 'pot' in patch) next.measurement = undefined;
            if ('species' in patch) { next.botanicalImage = undefined; next.identificationConfidence = undefined; next.identificationSource = undefined; next.family = undefined; next.description = undefined; next.wateringAdvice = undefined; }
            return next;
          })); setMessage('Modifications des plantes non enregistrées.'); }} onPosition={position => { setPositions(current => ({ ...current, [p.id]: position })); setMessage('Emplacements non enregistrés.'); }} />)}
          {!draftPlants.length && <Text style={styles.body}>Ajoutez une plante à la collection pour afficher ses détails ici.</Text>}
        </ScrollView></View>
      </View>
    </View>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{!!message && <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text>}<Action title="Enregistrer le plan et les emplacements" disabled={blocked} onPress={() => void commit()} />
    {editorOpen && <DesktopHomeEditor initial={{ home: draft, positions }} plants={draftPlants} onClose={() => setEditorOpen(false)} onApply={async (snapshot: EditorSnapshot) => {
      const cleaned = Object.fromEntries(draftPlants.map(p => [p.id, snapshot.positions[p.id] && validPosition(snapshot.positions[p.id]!, snapshot.home) ? snapshot.positions[p.id] : undefined]));
      if (!await onSave(snapshot.home, cleaned, draftPlants)) return false;
      setDraft(snapshot.home); setPositions(cleaned); setEditorOpen(false); setMessage('Plan et emplacements enregistrés.'); setError(''); return true;
    }} />}

  </View>;
}
const baseStyles = StyleSheet.create({
  title: { fontFamily: fonts.editorial, fontSize: 44, color: palette.ink }, subtitle: { fontFamily: fonts.editorial, fontSize: 26, color: palette.ink }, body: { fontSize: 15, lineHeight: 23, color: palette.muted }, hint: { fontSize: 12, lineHeight: 19, color: palette.muted },
  dropdownTrigger: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }, dropdownMenu: { maxHeight: 240, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface }, dropdownOption: { padding: 12, minHeight: 44 }, dropdownSelected: { backgroundColor: palette.sage },
  detailsScroll: { height: 580, flexGrow: 0 }, detailsContent: { gap: 20, paddingRight: 12, paddingBottom: 12 },
  workspace: { gap: 24, alignItems: 'stretch' }, workspacePanel: { flex: 1, minWidth: 0 },
  card: { borderRadius: 14, padding: 18, gap: 16, borderWidth: 1, borderLeftWidth: 4, borderLeftColor: palette.terracotta, borderColor: palette.line, backgroundColor: palette.surface }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' }, field: { gap: 6, minWidth: 140, flexGrow: 1 }, label: { color: palette.olive, fontSize: 13 },
  input: { borderWidth: 1, borderColor: palette.line, padding: 12, color: palette.ink, fontSize: 16, backgroundColor: palette.surface }, button: { alignSelf: 'flex-start', maxWidth: '100%', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.sage, minHeight: 44 }, buttonText: { fontSize: 14, color: palette.ink },
  canvas: { width: '100%', borderWidth: 1, borderColor: palette.line, backgroundColor: palette.paper, overflow: 'hidden' }, mapLabel: { backgroundColor: palette.surface, alignSelf: 'flex-start', color: palette.ink, fontSize: 11, userSelect: 'none' }, pin: { fontSize: 24, color: palette.terracotta }, error: { color: '#A33827', fontSize: 15 }, link: { color: palette.olive, fontSize: 14, textDecorationLine: 'underline' },
});
