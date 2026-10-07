import React, { useEffect, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { LightSensor } from 'expo-sensors';
import { lightAdvice, medianLux, validLux, type LightReading } from './light';
import { palette, useReadableStyles } from './theme';

export function LightSummary({ reading }: { reading: LightReading }) {
  const styles = useReadableStyles(baseStyles);
  return <View style={styles.panel}>
    <Text style={styles.heading}>{reading.lux.toLocaleString('fr-FR')} lux · relevé ponctuel</Text>
    <Text style={styles.text}>{new Date(reading.measuredAt).toLocaleString('fr-FR')} · {reading.room || 'Emplacement de la plante'} · {reading.method === 'sensor' ? 'Capteur du téléphone' : 'Saisie manuelle'}</Text>
    <Text style={styles.text}>{reading.curtainsClosed ? 'Rideaux fermés' : 'Rideaux ouverts'} · {reading.artificialLight ? 'Éclairage artificiel allumé' : 'Éclairage artificiel éteint'}</Text>
    <Text style={styles.text}>{lightAdvice(reading)}</Text>
    <Text style={styles.hint}>Conseil indicatif, à adapter à l’espèce. Ce relevé ne mesure pas toute la journée et ne distingue pas soleil direct et lumière indirecte. Votre choix d’exposition reste utilisé pour l’arrosage.</Text>
  </View>;
}

export function LightMeasure({ reading, room, active, disabled, onChange }: {
  reading?: LightReading; room: string; active: boolean; disabled: boolean;
  onChange: (reading: LightReading | undefined) => void;
}) {
  const styles = useReadableStyles(baseStyles);
  const [expanded, setExpanded] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ lux: number; measuredAt: string }>();
  const [manual, setManual] = useState('');
  const [artificialLight, setArtificialLight] = useState(false);
  const [curtainsClosed, setCurtainsClosed] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!active || disabled) { setRunning(false); setResult(undefined); setExpanded(false); }
  }, [active, disabled]);

  useEffect(() => {
    if (!running || !active || disabled) return;
    let cancelled = false;
    let subscription: { remove(): void } | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const samples: number[] = [];
    const cleanup = () => { cancelled = true; subscription?.remove(); if (timer) clearTimeout(timer); };
    const appState = AppState.addEventListener('change', state => {
      if (state !== 'active') { cleanup(); setRunning(false); setStatus('Mesure interrompue. Vous pouvez réessayer.'); }
    });
    // Bound both sensor startup and reading: a missing sensor must not block the form.
    timer = setTimeout(() => {
      if (cancelled) return;
      const lux = medianLux(samples);
      cleanup(); setRunning(false);
      if (lux == null) setStatus('Aucune valeur reçue. Réessayez ou saisissez un relevé de luxmètre.');
      else { setResult({ lux, measuredAt: new Date().toISOString() }); setStatus('Mesure prête. Vérifiez les conditions, puis utilisez ce relevé.'); }
    }, 6000);
    void (async () => {
      try {
        const available = Platform.OS === 'android' && await LightSensor.isAvailableAsync();
        if (cancelled) return;
        if (!available) { cleanup(); setRunning(false); setStatus('Capteur indisponible. Vous pouvez saisir un relevé de luxmètre.'); return; }
        LightSensor.setUpdateInterval(500);
        subscription = LightSensor.addListener(({ illuminance }) => {
          if (!cancelled && validLux(illuminance)) { samples.push(illuminance); setStatus(`Mesure en cours : ${Math.round(illuminance).toLocaleString('fr-FR')} lux…`); }
        });
      } catch {
        if (!cancelled) { cleanup(); setRunning(false); setStatus('Mesure inaccessible. La saisie manuelle reste disponible.'); }
      }
    })();
    return () => { cleanup(); appState.remove(); };
  }, [running, active, disabled]);

  const action = (title: string, onPress: () => void, blocked = false) => <Pressable accessibilityRole="button" accessibilityState={{ disabled: blocked }} disabled={blocked} onPress={onPress} style={[styles.button, blocked && { opacity: .5 }]}><Text style={styles.buttonText}>{title}</Text></Pressable>;
  function apply(method: LightReading['method']) {
    const lux = method === 'sensor' ? result?.lux : manual.trim() ? Number(manual.replace(',', '.')) : undefined;
    if (!validLux(lux)) { setStatus('Saisissez une valeur entre 0 et 200 000 lux.'); return; }
    onChange({ lux, measuredAt: method === 'sensor' ? result!.measuredAt : new Date().toISOString(), method, room: room.trim().slice(0, 100), artificialLight, curtainsClosed });
    setExpanded(false); setResult(undefined); setManual(''); setStatus('');
  }
  return <View style={styles.container}>
    {reading && <LightSummary reading={reading} />}
    <Pressable accessibilityRole="button" accessibilityState={{ expanded, disabled }} disabled={disabled} onPress={() => { setExpanded(!expanded); setRunning(false); setResult(undefined); setStatus(''); }} style={styles.button}><Text style={styles.buttonText}>{expanded ? 'Fermer la mesure' : 'Affiner avec une mesure (facultatif)'}</Text></Pressable>
    {!expanded && !reading && <Text style={styles.hint}>Votre choix suffit pour commencer. Vous pourrez mesurer plus tard, sans rappel automatique.</Text>}
    {expanded && <View style={styles.panel}>
      <Text style={styles.heading}>La lumière à l’emplacement de la plante</Text>
      <Text style={styles.text}>Placez le téléphone à hauteur des feuilles, le capteur près du haut de l’écran dégagé et tourné vers la lumière. Gardez-le immobile quelques secondes. La précision dépend du téléphone.</Text>
      {Platform.OS === 'android' ? action(running ? 'Mesure en cours…' : 'Mesurer avec mon téléphone', () => { setResult(undefined); setStatus('Recherche du capteur…'); setRunning(true); }, running || disabled) : <Text style={styles.hint}>La mesure au téléphone est disponible sur Android compatible. Ici, saisissez la valeur d’un luxmètre.</Text>}
      {!!status && <Text accessibilityLiveRegion="polite" style={styles.text}>{status}</Text>}
      {result && <Text style={styles.heading}>Résultat : {result.lux.toLocaleString('fr-FR')} lux</Text>}
      <View style={styles.row}><Text style={styles.text}>Éclairage artificiel allumé</Text><Switch accessibilityLabel="Éclairage artificiel allumé pendant la mesure" disabled={running || disabled} value={artificialLight} onValueChange={setArtificialLight} /></View>
      <View style={styles.row}><Text style={styles.text}>Rideaux fermés</Text><Switch accessibilityLabel="Rideaux fermés pendant la mesure" disabled={running || disabled} value={curtainsClosed} onValueChange={setCurtainsClosed} /></View>
      {result && action('Utiliser ce relevé', () => apply('sensor'), disabled)}
      <Text style={styles.text}>Ou saisir un relevé de luxmètre (lux)</Text>
      <TextInput accessibilityLabel="Relevé manuel en lux" keyboardType="numeric" value={manual} onChangeText={setManual} editable={!running && !disabled} maxLength={12} placeholder="Ex. 2 500 → saisir 2500" style={styles.input} />
      {action('Utiliser la valeur saisie', () => apply('manual'), running || disabled)}
      {reading && action('Retirer le relevé', () => { onChange(undefined); setExpanded(false); }, running || disabled)}
      {action('Plus tard', () => { setRunning(false); setExpanded(false); setResult(undefined); }, disabled)}
      <Text style={styles.hint}>Le relevé sera sauvegardé lorsque vous enregistrerez la fiche de la plante.</Text>
    </View>}
  </View>;
}

const baseStyles = StyleSheet.create({
  container: { gap: 12 }, panel: { gap: 12, padding: 16, borderWidth: 1, borderColor: palette.line, borderRadius: 12 },
  heading: { fontSize: 18, fontWeight: '600', color: palette.ink }, text: { fontSize: 16, color: palette.ink }, hint: { fontSize: 14, color: palette.muted },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  button: { minHeight: 48, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: palette.olive }, buttonText: { fontSize: 16, fontWeight: '600', color: palette.olive },
  input: { minHeight: 48, borderWidth: 1, borderColor: palette.line, borderRadius: 8, padding: 12, fontSize: 16, color: palette.ink, backgroundColor: palette.surface },
});
