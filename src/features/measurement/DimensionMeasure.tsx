import { palette, fonts, useReadableStyles, useThemePalette } from '../../shared/ui/theme';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { File } from 'expo-file-system';
import { detectPhotoDimensions } from '../plants/plantApi';
import { imageFrame, landmarkNames, measureDimensions, pointFromClient, pointFromTouch, validLandmarks, type ImageSize, type LandmarkName, type Landmarks, type Measurement, type Point } from './measurement';

const labels: Record<LandmarkName, string> = {
  referenceStart: 'Début du repère', referenceEnd: 'Fin du repère', plantTop: 'Sommet de la plante', soilLevel: 'Niveau du terreau',
  plantLeft: 'Feuillage : bord gauche', plantRight: 'Feuillage : bord droit', potLeft: 'Ouverture du pot : bord gauche', potRight: 'Ouverture du pot : bord droit',
};
function Action({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  const styles = useReadableStyles(baseStyles);
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, disabled && { opacity: .5 }]}><Text style={styles.buttonText}>{title}</Text></Pressable>;
}

export function DimensionMeasure({ photo, disabled, onApply, onBusy, token }: { token: string; photo: string; disabled: boolean; onApply: (measurement: Measurement) => void; onBusy: (busy: boolean) => void }) {
  const palette = useThemePalette();
  const styles = useReadableStyles(baseStyles);
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<ImageSize | null>(null);
  const [frame, setFrame] = useState<ImageSize>({ width: 0, height: 360 });
  const [referenceCm, setReferenceCm] = useState('29.7');
  const [referenceDescription, setReferenceDescription] = useState('Grand côté vertical d’une feuille A4');
  const [points, setPoints] = useState<Partial<Landmarks>>({});
  const [active, setActive] = useState<LandmarkName>('referenceStart');
  const [method, setMethod] = useState<'vision' | 'guided'>('guided');
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');
  const mounted = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    setSize(null); setPoints({}); setActive('referenceStart');
    Image.getSize(photo, (width, height) => { if (!cancelled) setSize({ width, height }); }, () => { if (!cancelled) setMessage('Photo illisible. Choisissez une autre image.'); });
    return () => { cancelled = true; mounted.current = false; };
  }, [photo]);
  const length = Number(referenceCm.replace(',', '.'));
  const canCalibrate = Number.isFinite(length) && length >= 1 && length <= 200;
  let result: ReturnType<typeof measureDimensions> | null = null;
  let validation = '';
  if (size && validLandmarks(points)) {
    try { result = measureDimensions(points, size, length); }
    catch (error) { validation = error instanceof Error ? error.message : 'Vérifiez les points.'; }
  }
  const rect = size && frame.width ? imageFrame(size, frame) : null;
  async function detect() {
    if (!size || !canCalibrate || inFlight.current) return;
    inFlight.current = true; setRunning(true); onBusy(true); setMessage('Recherche des points sur la photo…');
    try {
      const image = photo.startsWith('data:') ? photo : Platform.OS !== 'web' ? `data:${new File(photo).type || 'image/jpeg'};base64,${await new File(photo).base64()}` : '';
      if (!image) throw new Error('Photo indisponible : choisissez-la à nouveau.');
      const detected = await detectPhotoDimensions(image, size, length, referenceDescription, token);
      if (mounted.current) { setPoints(detected); setMethod('vision'); setMessage('Points détectés. Vérifiez les huit positions avant d’appliquer les mesures.'); }
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : 'Analyse impossible. Placez les points manuellement.');
    } finally {
      inFlight.current = false;
      if (mounted.current) { setRunning(false); onBusy(false); }
    }
  }
  function place(point: Point) {
    setPoints(previous => ({ ...previous, [active]: point })); setMethod('guided'); setMessage('');
    const index = landmarkNames.indexOf(active);
    if (index < landmarkNames.length - 1) setActive(landmarkNames[index + 1]);
  }
  function placeOnPhoto(point: Point | null) {
    if (disabled || running) return;
    if (point) place(point);
    else setMessage('Cliquez ou touchez dans la photo, pas dans les bandes autour de l’image.');
  }
  return <View style={styles.card}>
    <Text style={styles.title}>Dimensions sur photo</Text>
    <Text style={styles.body}>Photo de face : plante entière, pot et repère connu (règle ou A4) à la même distance. Terreau et bords du pot visibles.</Text>
    <Action title={open ? 'Fermer la mesure' : 'Mesurer cette photo'} disabled={disabled || running} onPress={() => setOpen(value => !value)} />
    {open && <>
      <Text style={styles.label}>Repère visible et segment à mesurer</Text>
      <TextInput accessibilityLabel="Description du repère" value={referenceDescription} editable={!disabled && !running} onChangeText={value => { setReferenceDescription(value); setPoints({}); setActive('referenceStart'); setMessage(''); }} maxLength={150} style={styles.input} />
      <Text style={styles.label}>Longueur réelle du segment (cm)</Text>
      <TextInput accessibilityLabel="Longueur du repère en centimètres" value={referenceCm} editable={!disabled && !running} onChangeText={setReferenceCm} keyboardType="decimal-pad" maxLength={6} style={styles.input} />
      {!canCalibrate && <Text accessibilityRole="alert" style={styles.error}>Indiquez une longueur entre 1 et 200 cm.</Text>}
      <Text style={styles.hint}>Grand côté A4 : 29,7 cm. Repère connu obligatoire. Analyse IA : photo transmise à OpenAI via le serveur. Placement manuel : local.</Text>
      <Action title={running ? 'Analyse en cours…' : 'Détecter automatiquement les points'} disabled={disabled || running || !size || !canCalibrate || !referenceDescription.trim()} onPress={() => void detect()} />
      {!!message && <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text>}
      <Text style={styles.label}>Vérifier ou placer les points</Text>
      <Text style={styles.hint}>Choisissez un point ci-dessous, puis touchez sa position sur la photo. Après chaque placement, le point suivant est sélectionné. Hauteur : du terreau au sommet ; diamètre : ouverture du pot de culture, hors cache-pot.</Text>
      <View style={styles.options}>{landmarkNames.map((key, index) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: active === key }} disabled={disabled || running} onPress={() => setActive(key)} style={[styles.option, active === key && styles.selected]}><Text style={styles.optionText}>{index + 1}. {labels[key]}{points[key] ? ' ✓' : ''}</Text></Pressable>)}</View>
      <Text style={styles.label}>À placer : {labels[active]}</Text>
      <View onLayout={event => setFrame({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })} style={styles.photo}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}><Image source={{ uri: photo }} resizeMode="contain" style={StyleSheet.absoluteFill} /></View>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {rect && landmarkNames.map((key, index) => points[key] && <View key={key} style={[styles.dot, { left: rect.left + points[key]!.x * rect.width - 10, top: rect.top + points[key]!.y * rect.height - 10, backgroundColor: active === key ? '#AC461C' : palette.olive }]}><Text style={styles.dotText}>{index + 1}</Text></View>)}
        </View>
        {Platform.OS === 'web' ? React.createElement('button', {
          type: 'button', 'aria-label': `Placer : ${labels[active]}`, disabled: disabled || running || !size,
          style: { position: 'absolute', inset: 0, width: '100%', height: '100%', padding: 0, margin: 0, border: 0, background: 'transparent', cursor: disabled || running || !size ? 'default' : 'crosshair', touchAction: 'manipulation' },
          onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
            if (!size || event.detail === 0) return;
            placeOnPhoto(pointFromClient(event.clientX, event.clientY, size, event.currentTarget.getBoundingClientRect()));
          },
        }) : <Pressable accessibilityLabel={`Placer : ${labels[active]}`} disabled={disabled || running || !size} style={StyleSheet.absoluteFill} onPress={event => { if (size) placeOnPhoto(pointFromTouch(event.nativeEvent.locationX, event.nativeEvent.locationY, size, frame)); }} />}
      </View>
      <Action title="Recommencer les points" disabled={disabled || running} onPress={() => { setPoints({}); setActive('referenceStart'); setMessage(''); setMethod('guided'); }} />
      {!!validation && <Text accessibilityRole="alert" style={styles.error}>{validation}</Text>}
      {result && <Text style={styles.body}>Hauteur : ≈ {result.height} cm · largeur : ≈ {result.width} cm · diamètre du pot : ≈ {result.pot} cm.</Text>}
      <Text style={styles.hint}>Estimation par rapport au repère, à vérifier : la perspective et les points peuvent fausser les valeurs. La profondeur intérieure du pot reste à saisir séparément.</Text>
      <Action title="Appliquer les dimensions à la fiche" disabled={disabled || running || !result || !referenceDescription.trim()} onPress={() => {
        if (!result) return;
        onApply({ ...result, method, referenceCm: length, measuredAt: new Date().toISOString() });
        setMessage('Dimensions appliquées. Enregistrez la fiche pour les conserver.');
      }} />
    </>}
  </View>;
}
const baseStyles = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: 2, padding: 20, gap: 14 },
  title: { color: palette.ink, fontFamily: fonts.editorial, fontSize: 26, fontWeight: '400' }, body: { color: palette.muted, fontSize: 15, lineHeight: 23 },
  label: { color: palette.olive, fontWeight: '600', fontSize: 13 }, hint: { color: palette.muted, fontSize: 12, lineHeight: 19 },
  input: { borderWidth: 1, borderColor: palette.line, borderRadius: 2, padding: 12, color: palette.ink, fontSize: 16 },
  button: { backgroundColor: palette.sage, borderRadius: 2, padding: 15, minHeight: 48 }, buttonText: { color: palette.olive, textAlign: 'center', fontWeight: '600' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, option: { padding: 10, borderRadius: 10, backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.line },
  selected: { borderColor: palette.olive, backgroundColor: palette.sage }, optionText: { color: palette.olive, fontSize: 12 },
  photo: { height: 360, backgroundColor: palette.sage, overflow: 'hidden' }, dot: { position: 'absolute', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.surface },
  dotText: { color: palette.surface, fontSize: 11, fontWeight: '700' }, error: { color: '#A33827', lineHeight: 21 },
});
