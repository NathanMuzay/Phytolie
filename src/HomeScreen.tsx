import React, { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { newHome, validateHome, inside, validPosition, estimatePlacement, exposureLabels, type HomeArea, type HomePlan, type PlantPosition, type HomeWindow, type Exposure } from './home';
import type { Plant } from './model';
import { palette, fonts, useReadableStyles } from './theme';
const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
function Action({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  const styles = useReadableStyles(baseStyles);
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, disabled && { opacity: .45 }]}><Text style={styles.buttonText}>{title}</Text></Pressable>;
}
function Input({ label, value, change, numeric = false, disabled = false }: { label: string; value: string | number; change: (s: string) => void; numeric?: boolean; disabled?: boolean }) {
  const styles = useReadableStyles(baseStyles);
  const [text, setText] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => { if (focused.current) return; setText(typeof value === 'number' && !Number.isFinite(value) ? '' : String(value)); }, [value]);
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} style={styles.input} value={numeric ? text : String(value)} onFocus={() => { focused.current = true; }} onChangeText={s => { if (numeric) { setText(s); if (!s.trim() || /^-?\d+(?:[.,]\d+)?$/.test(s)) change(s); } else change(s); }} onBlur={() => { focused.current = false; if (numeric) change(text); }} keyboardType={numeric ? 'decimal-pad' : 'default'} editable={!disabled} maxLength={numeric ? 12 : 100} /></View>;
}
export function PlanCanvas({ home, positions = [], onPoint }: { home: HomePlan; positions?: { name: string; position: PlantPosition }[]; onPoint?: (p: { x: number; y: number }) => void }) {
  const styles = useReadableStyles(baseStyles);
  const [width, setWidth] = useState(600);
  const height = Math.max(240, Math.min(600, width * home.height / home.width));
  if (!Number.isFinite(home.width) || !Number.isFinite(home.height) || home.width <= 0 || home.height <= 0) return <Text style={styles.body}>Renseignez des dimensions positives pour afficher le plan.</Text>;
  const sx = width / home.width, sy = height / home.height;
  return <View style={{ gap: 8 }}><Text style={styles.body}>Plan : {home.width} × {home.height} m · Nord à {home.northAngle}° du haut du plan</Text><Pressable accessibilityRole="button" accessibilityLabel="Plan du logement : toucher pour sélectionner un emplacement. Les coordonnées peuvent aussi être saisies dans le formulaire." onLayout={e => setWidth(e.nativeEvent.layout.width)} onPress={e => { if (onPoint) onPoint({ x: Math.round(e.nativeEvent.locationX / sx * 10) / 10, y: Math.round(e.nativeEvent.locationY / sy * 10) / 10 }); }} style={[styles.canvas, { height }]}>
    {home.background && <View pointerEvents="none" style={StyleSheet.absoluteFill}><Image source={{ uri: home.background }} resizeMode="stretch" style={[StyleSheet.absoluteFill, { opacity: .4 }]} /></View>}
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: Math.min(100, Math.floor(home.width)) }, (_, x) => <View key={`x${x}`} style={{ position: 'absolute', left: x * sx, top: 0, bottom: 0, borderLeftWidth: 1, borderColor: '#D8D4BF60' }} />)}
      {Array.from({ length: Math.min(100, Math.floor(home.height)) }, (_, y) => <View key={`y${y}`} style={{ position: 'absolute', top: y * sy, left: 0, right: 0, borderTopWidth: 1, borderColor: '#D8D4BF60' }} />)}
      {home.areas.filter(a => [a.x, a.y, a.width, a.height].every(Number.isFinite)).map(a => <View key={a.id} style={{ position: 'absolute', left: a.x * sx, top: a.y * sy, width: a.width * sx, height: a.height * sy, borderWidth: 2, borderColor: palette.olive, backgroundColor: a.kind === 'garden' ? '#C1D4A555' : '#FFFCF540' }}><Text style={[styles.mapLabel, { padding: 5 }]}>{a.kind === 'garden' ? 'Jardin · ' : ''}{a.name}</Text>
        {a.windows.map(w => { const horizontal = w.wall === 'top' || w.wall === 'bottom'; return <View key={w.id} style={{ position: 'absolute', backgroundColor: '#468399', width: horizontal ? w.width * sx : 5, height: horizontal ? 5 : w.width * sy, left: w.wall === 'right' ? a.width * sx - 5 : horizontal ? (w.offset - w.width / 2) * sx : -2, top: w.wall === 'bottom' ? a.height * sy - 5 : horizontal ? -2 : (w.offset - w.width / 2) * sy }} />; })}
      </View>)}
      {positions.map(({ name, position }, i) => <View key={`${name}-${i}`} style={{ position: 'absolute', left: position.x * sx - 12, top: position.y * sy - 12 }}><Text style={styles.pin}>●</Text><Text style={styles.mapLabel}>{name}</Text></View>)}
      <Text style={[styles.mapLabel, { position: 'absolute', right: 10, top: 10, transform: [{ rotate: `${-home.northAngle}deg` }] }]}>↑ N</Text>
    </View>
  </Pressable><Text style={styles.hint}>Fenêtres en bleu · coordonnées depuis le coin haut gauche. Le fond importé est ajusté aux dimensions du plan.</Text></View>;
}
export function ExposureDetails({ home, position, species }: { home: HomePlan; position: PlantPosition; species: string }) {
  const styles = useReadableStyles(baseStyles), estimate = estimatePlacement(home, position, species);
  if (!estimate) return null;
  return <View style={styles.card}><Text style={styles.subtitle}>{estimate.hours == null ? 'Exposition à confirmer' : exposureLabels[estimate.exposure]} · {estimate.score == null ? 'Score non disponible' : `Compatibilité lumière : ${estimate.score}/100`}</Text><Text style={styles.body}>Confiance : {estimate.confidence} · mois étudié : {home.month}</Text>{estimate.reasons.map(reason => <Text key={reason} style={styles.body}>{reason}</Text>)}{estimate.source && <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(estimate.source!)}><Text style={styles.link}>Consulter les besoins de l’espèce (RHS) ↗</Text></Pressable>}</View>;
}
export function PlacementPicker({ home, position, species, onChange, disabled = false }: { home: HomePlan; position?: PlantPosition; species: string; onChange: (p: PlantPosition | undefined) => void; disabled?: boolean }) {
  const styles = useReadableStyles(baseStyles);
  const [message, setMessage] = useState('');
  const update = (patch: Partial<PlantPosition>) => { if (!position || disabled) return; const next = { ...position, ...patch }; if (validPosition(next, home)) { onChange(next); setMessage(''); } else setMessage('Le pin doit rester dans la zone choisie et sa hauteur entre 0 et 5 m.'); };
  return <View style={styles.card}><Text style={styles.subtitle}>Emplacement de la plante</Text><Text style={styles.body}>Choisissez une zone puis touchez le plan. La hauteur est celle du feuillage au-dessus du sol.</Text><View style={styles.row}>{home.areas.map(a => <Action key={a.id} title={`${position?.areaId === a.id ? '✓ ' : ''}${a.name}`} disabled={disabled} onPress={() => { onChange({ areaId: a.id, x: a.x + a.width / 2, y: a.y + a.height / 2, height: position?.height ?? .5, preference: position?.preference }); setMessage(''); }} />)}</View>
    <PlanCanvas home={home} positions={position ? [{ name: 'Votre plante', position }] : []} onPoint={p => { if (disabled) return; const a = home.areas.find(a => inside(a, p)); if (a) { onChange({ ...p, areaId: a.id, height: position?.height ?? .5, preference: position?.preference }); setMessage(''); } else setMessage('Choisissez un point à l’intérieur d’une pièce ou du jardin.'); }} />
    {position && <><View style={styles.row}><Input label="Pin X (m)" value={position.x} numeric disabled={disabled} change={s => update({ x: Number(s.replace(',', '.')) })} /><Input label="Pin Y (m)" value={position.y} numeric disabled={disabled} change={s => update({ y: Number(s.replace(',', '.')) })} /><Input label="Hauteur du feuillage (m)" value={position.height} numeric disabled={disabled} change={s => update({ height: Number(s.replace(',', '.')) })} /></View><Text style={styles.label}>Besoin lumineux : profil de l’espèce ou choix manuel</Text><View style={styles.row}><Action title="Profil de l’espèce" disabled={disabled} onPress={() => update({ preference: undefined })} />{(['shade', 'indirect', 'sun'] as Exposure[]).map(value => <Action key={value} title={`${position.preference === value ? '✓ ' : ''}${exposureLabels[value]}`} disabled={disabled} onPress={() => update({ preference: value })} />)}</View><ExposureDetails home={home} position={position} species={species} /><Action title="Retirer le pin" disabled={disabled} onPress={() => onChange(undefined)} /></>}
    {!!message && <Text accessibilityRole="alert" style={styles.error}>{message}</Text>}
    {!home.areas.length && <Text style={styles.body}>Ajoutez et enregistrez une pièce ou un jardin dans « Ma maison » pour placer la plante.</Text>}
  </View>;
}
export function HomeScreen({ home, plants, latitude, disabled, onSave }: { home?: HomePlan; plants: Plant[]; latitude?: number; disabled: boolean; onSave: (home: HomePlan, positions: Record<string, PlantPosition | undefined>) => Promise<boolean> }) {
  const styles = useReadableStyles(baseStyles);
  const [draft, setDraft] = useState<HomePlan>(home ?? { ...newHome(), latitude });
  const [positions, setPositions] = useState<Record<string, PlantPosition | undefined>>(() => Object.fromEntries(plants.map(p => [p.id, p.position])));
  const [selected, setSelected] = useState('');
  const [plantId, setPlantId] = useState(plants[0]?.id ?? '');
  const [tool, setTool] = useState<'select' | 'room' | 'garden'>('select');
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [importing, setImporting] = useState(false);
  const area = draft.areas.find(a => a.id === selected), plant = plants.find(p => p.id === plantId);
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
      const cleaned = Object.fromEntries(plants.map(p => [p.id, positions[p.id] && validPosition(positions[p.id]!, draft) ? positions[p.id] : undefined]));
      const removed = Object.keys(positions).filter(key => positions[key] && !cleaned[key]).length;
      if (await onSave(draft, cleaned)) { setPositions(cleaned); setMessage(`Plan et emplacements enregistrés.${removed ? ` ${removed} pin(s) retiré(s) car leur zone a été supprimée ou déplacée.` : ''}`); setError(''); }
      else setError('Enregistrement impossible : vos modifications restent dans l’éditeur.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Plan invalide.'); }
  }
  function updateWindow(w: HomeWindow, patch: Partial<HomeWindow>) { updateArea({ windows: area!.windows.map(item => item.id === w.id ? { ...w, ...patch } : item) }); }
  return <View style={{ gap: 24 }}><Text accessibilityRole="header" style={styles.title}>Ma maison</Text><Text style={styles.body}>1. Créez les pièces et le jardin · 2. Ajoutez les fenêtres · 3. Placez vos plantes · 4. Enregistrez. Les pièces sont rectangulaires ; combinez plusieurs zones pour un logement irrégulier.</Text>
    <View style={styles.card}><Text style={styles.subtitle}>Dimensions et orientation</Text><View style={styles.row}>{(['width', 'height', 'northAngle', 'floor', 'month'] as const).map(key => <Input key={key} disabled={blocked} numeric label={{ width: 'Largeur du plan (m)', height: 'Hauteur du plan (m)', northAngle: 'Orientation du haut du plan (0° nord, 90° est)', floor: 'Étage (0 = rez-de-chaussée)', month: 'Mois étudié (1 à 12)' }[key]} value={draft[key]} change={s => change({ ...draft, [key]: s.trim() ? Number(s.replace(',', '.')) : NaN })} />)}<Input label="Latitude (−90 à 90, nécessaire au calcul solaire)" value={draft.latitude ?? ''} numeric disabled={blocked} change={s => change({ ...draft, latitude: s.trim() ? Number(s.replace(',', '.')) : undefined })} /></View>{latitude != null && <Action title="Utiliser la latitude de ma ville" disabled={blocked} onPress={() => change({ ...draft, latitude })} />}<Text style={styles.hint}>La ville se règle dans « Mon espace ». Le mois sert à comparer les saisons ; l’étage est informatif. Le calcul utilise les heures solaires, sans prédire la météo.</Text></View>
    <View style={styles.row}><Action title={importing ? 'Import…' : 'Importer un plan (image)'} disabled={blocked} onPress={() => void importPlan()} />{draft.background && <Action title="Retirer le fond importé" disabled={blocked} onPress={() => change({ ...draft, background: undefined })} />}<Action title="Ajouter une pièce au clic" disabled={blocked} onPress={() => setTool('room')} /><Action title="Ajouter un jardin au clic" disabled={blocked} onPress={() => setTool('garden')} /><Action title="Sélectionner" disabled={blocked} onPress={() => setTool('select')} /></View>
    <Text style={styles.body}>{tool === 'select' ? 'Touchez une zone pour la modifier, ou utilisez la liste ci-dessous.' : 'Touchez le plan pour définir le coin haut gauche de la nouvelle zone.'} Un fond importé doit être retracé avec les pièces et fenêtres.</Text>
    <PlanCanvas home={draft} positions={plants.flatMap(p => positions[p.id] ? [{ name: p.name, position: positions[p.id]! }] : [])} onPoint={point => { if (blocked) return; if (tool !== 'select') addArea(tool, point); else setSelected(draft.areas.find(a => inside(a, point))?.id ?? ''); }} />
    <View style={styles.row}>{draft.areas.map(a => <Action key={a.id} title={`${selected === a.id ? '✓ ' : ''}${a.name}`} disabled={blocked} onPress={() => setSelected(a.id)} />)}<Action title="＋ Pièce (saisie des coordonnées)" disabled={blocked} onPress={() => addArea('room')} /><Action title="＋ Jardin (saisie des coordonnées)" disabled={blocked} onPress={() => addArea('garden')} /></View>
    {area && <View style={styles.card}><Text style={styles.subtitle}>{area.kind === 'garden' ? 'Jardin' : 'Pièce'} · {area.name}</Text><Input label="Nom de la zone" value={area.name} disabled={blocked} change={name => updateArea({ name })} /><View style={styles.row}>{(['x', 'y', 'width', 'height'] as const).map(key => <Input key={key} numeric disabled={blocked} label={{ x: 'Zone X (m)', y: 'Zone Y (m)', width: 'Largeur de la zone (m)', height: 'Profondeur de la zone (m)' }[key]} value={area[key]} change={s => updateArea({ [key]: s.trim() ? Number(s.replace(',', '.')) : NaN })} />)}</View>
      {area.kind === 'garden' ? <><Text style={styles.label}>Ombrage du jardin (arbres, murs, abri)</Text><View style={styles.row}>{(['none', 'partial', 'blocked'] as const).map(shade => <Action key={shade} title={`${area.shade === shade ? '✓ ' : ''}${{ none: 'Dégagé', partial: 'Partiellement ombragé', blocked: 'Très ombragé' }[shade]}`} disabled={blocked} onPress={() => updateArea({ shade })} />)}</View></> : <><Text style={styles.body}>Ajoutez les fenêtres donnant sur l’extérieur. Un mur sans fenêtre bloque le soleil ; les pièces voisines ne transmettent pas la lumière dans cette première version.</Text><Action title="＋ Fenêtre" disabled={blocked} onPress={() => updateArea({ windows: [...area.windows, { id: id(), wall: 'top', offset: area.width / 2, width: Math.min(1.2, area.width), sill: .8, height: 1.4, filtered: false, obstruction: 'none' }] })} />{area.windows.map((w, index) => <View key={w.id} style={styles.card}><Text style={styles.label}>Fenêtre {index + 1}</Text><View style={styles.row}>{(['top', 'right', 'bottom', 'left'] as const).map(wall => <Action key={wall} title={`${w.wall === wall ? '✓ ' : ''}${{ top: 'Mur du haut', right: 'Mur droit', bottom: 'Mur du bas', left: 'Mur gauche' }[wall]}`} disabled={blocked} onPress={() => updateWindow(w, { wall, offset: (['top', 'bottom'].includes(wall) ? area.width : area.height) / 2 })} />)}</View><View style={styles.row}>{(['offset', 'width', 'sill', 'height'] as const).map(key => <Input key={key} numeric disabled={blocked} label={{ offset: 'Centre depuis le début du mur (m)', width: 'Largeur de la fenêtre (m)', sill: 'Bas de la fenêtre au-dessus du sol (m)', height: 'Hauteur vitrée (m)' }[key]} value={w[key]} change={s => updateWindow(w, { [key]: s.trim() ? Number(s.replace(',', '.')) : NaN })} />)}</View><View style={styles.row}><Text style={styles.body}>Voilage / lumière filtrée</Text><Switch accessibilityLabel={`Voilage de la fenêtre ${index + 1}`} disabled={blocked} value={w.filtered} onValueChange={filtered => updateWindow(w, { filtered })} /></View><Text style={styles.label}>Obstacle extérieur devant cette fenêtre</Text><View style={styles.row}>{(['none', 'partial', 'blocked'] as const).map(obstruction => <Action key={obstruction} title={`${w.obstruction === obstruction ? '✓ ' : ''}${{ none: 'Aucun', partial: 'Partiel', blocked: 'Bloque la lumière' }[obstruction]}`} disabled={blocked} onPress={() => updateWindow(w, { obstruction })} />)}</View><Action title="Retirer cette fenêtre" disabled={blocked} onPress={() => updateArea({ windows: area.windows.filter(item => item.id !== w.id) })} /></View>)}</>}
      <Action title="Retirer cette zone et ses pins" disabled={blocked} onPress={() => { change({ ...draft, areas: draft.areas.filter(a => a.id !== area.id) }); setPositions(current => Object.fromEntries(Object.entries(current).map(([key, p]) => [key, p?.areaId === area.id ? undefined : p]))); setSelected(''); }} />
    </View>}
    <View style={styles.card}><Text style={styles.subtitle}>Mes plantes sur le plan</Text><View style={styles.row}>{plants.map(p => <Action key={p.id} title={`${plantId === p.id ? '✓ ' : ''}${p.name}`} disabled={blocked} onPress={() => setPlantId(p.id)} />)}</View>{plant ? <PlacementPicker key={plant.id} home={draft} species={plant.species} position={positions[plant.id]} disabled={blocked} onChange={p => { setPositions(current => ({ ...current, [plant.id]: p })); setMessage('Emplacements non enregistrés.'); }} /> : <Text style={styles.body}>Ajoutez une plante à votre collection pour la placer sur le plan.</Text>}</View>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{!!message && <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text>}<Action title="Enregistrer le plan et les emplacements" disabled={blocked} onPress={() => void commit()} />
  </View>;
}
const baseStyles = StyleSheet.create({
  title: { fontFamily: fonts.editorial, fontSize: 44, color: palette.ink }, subtitle: { fontFamily: fonts.editorial, fontSize: 26, color: palette.ink }, body: { fontSize: 15, lineHeight: 23, color: palette.muted }, hint: { fontSize: 12, lineHeight: 19, color: palette.muted },
  card: { padding: 18, gap: 16, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' }, field: { gap: 6, minWidth: 140, flexGrow: 1 }, label: { color: palette.olive, fontSize: 13 },
  input: { borderWidth: 1, borderColor: palette.line, padding: 12, color: palette.ink, fontSize: 16, backgroundColor: palette.surface }, button: { padding: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.sage, minHeight: 44 }, buttonText: { fontSize: 14, color: palette.ink },
  canvas: { width: '100%', borderWidth: 1, borderColor: palette.line, backgroundColor: palette.paper, overflow: 'hidden' }, mapLabel: { color: palette.ink, fontSize: 11 }, pin: { fontSize: 24, color: palette.terracotta }, error: { color: '#A33827', fontSize: 15 }, link: { color: palette.olive, fontSize: 14, textDecorationLine: 'underline' },
});
