import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../shared/ui/ActionButton';
import { daysUntil } from '../../shared/model';
import { fonts, palette, useReadableStyles } from '../../shared/ui/theme';
import { loadGuestGarden, waterGuestPlant, type SharedGarden } from '../accounts/accountApi';
import { wateringPlan } from '../plants/irrigation';
import { PlantVisual } from '../plants/PlantVisual';
import { PrivacyScreen } from '../privacy/PrivacyScreen';

export function GuestCareScreen({ invitation, onExit }: { invitation: string; onExit: () => void }) {
  const styles = useReadableStyles(baseStyles);
  const [garden, setGarden] = useState<SharedGarden | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [privacy, setPrivacy] = useState(false);
  const mounted = useRef(true), serial = useRef(0), writing = useRef(false);
  const refresh = useCallback(async () => {
    if (writing.current) return;
    const current = ++serial.current;
    setLoading(true);
    try {
      const next = await loadGuestGarden(invitation);
      if (mounted.current && current === serial.current) { setGarden(next); setError(''); }
    } catch (error) {
      if (mounted.current && current === serial.current) { setGarden(null); setError(error instanceof Error ? error.message : 'Accès indisponible. Réessayez.'); }
    } finally { if (mounted.current && current === serial.current) setLoading(false); }
  }, [invitation]);
  useEffect(() => {
    mounted.current = true; void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { mounted.current = false; ++serial.current; clearInterval(timer); subscription.remove(); };
  }, [refresh]);
  useEffect(() => {
    if (!garden) return;
    const timer = setTimeout(() => { if (Date.parse(garden.delegation.endsAt) <= Date.now()) { ++serial.current; setGarden(null); setLoading(false); setError('La période d’accès est terminée. Demandez un nouveau lien au propriétaire.'); } }, Math.max(0, Math.min(2147000000, Date.parse(garden.delegation.endsAt) - Date.now())));
    return () => clearTimeout(timer);
  }, [garden]);
  async function water(plantId: string) {
    if (writing.current || loading) return;
    writing.current = true; const current = ++serial.current; setBusy(true); setMessage(''); setError('');
    try {
      const next = await waterGuestPlant(invitation, plantId);
      if (mounted.current && current === serial.current) { setGarden(next); setMessage('Arrosage enregistré dans le jardin du propriétaire.'); }
    } catch (error) {
      if (mounted.current && current === serial.current) { setGarden(null); setError(error instanceof Error ? error.message : 'Arrosage impossible. Actualisez avant de réessayer.'); }
    } finally { writing.current = false; if (mounted.current) setBusy(false); }
  }
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.toolbar}><Text style={styles.brand}>Phytolie.</Text><ActionButton title="Quitter cet espace" secondary onPress={onExit} /></View>
    {privacy ? <PrivacyScreen onBack={() => setPrivacy(false)} backLabel="Espace invité" /> : <>
      <View style={styles.intro}><Text style={styles.eyebrow}>ACCÈS INVITÉ · SANS COMPTE</Text><Text accessibilityRole="header" style={styles.title}>Un jardin vous est confié.</Text><Text style={styles.body}>Retrouvez les consignes et confirmez les arrosages des plantes confiées.</Text></View>
      {loading && <Text accessibilityLiveRegion="polite" style={styles.body}>{garden ? 'Actualisation du jardin…' : 'Ouverture du jardin partagé…'}</Text>}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {!!message && <Text accessibilityLiveRegion="polite" style={styles.notice}>{message}</Text>}
      <ActionButton title={loading ? 'Chargement…' : 'Actualiser le jardin'} secondary disabled={loading || busy} onPress={() => void refresh()} />
      {garden && <>
        <View style={styles.instructions}><Text accessibilityRole="header" style={styles.heading}>Le jardin de {garden.owner?.email ?? 'votre proche'}</Text><Text style={styles.small}>Accès jusqu’au {new Date(garden.delegation.endsAt).toLocaleString('fr-FR')}</Text><Text style={styles.label}>Ses consignes</Text><Text style={styles.body}>{garden.delegation.notes || 'Aucune consigne supplémentaire.'}</Text></View>
        {!garden.plants.length && <Text style={styles.body}>Aucune plante accessible pour le moment : elles ont été retirées ou archivées par le propriétaire.</Text>}
        {garden.plants.map(plant => {
          const plan = wateringPlan(plant);
          const wateredToday = !!plant.lastWatered && daysUntil(new Date(plant.lastWatered)) === 0;
          return <View key={plant.id} style={styles.card}>
            <PlantVisual plant={plant} style={{ maxHeight: 260 }} />
            <View style={styles.copy}><Text accessibilityRole="header" style={styles.heading}>{plant.name}</Text><Text style={styles.small}>{plant.species} · {plant.room}</Text><Text style={styles.label}>Vérification : {plan.nextCheck.toLocaleDateString('fr-FR')}</Text><Text style={styles.body}>{plan.instruction}</Text>{plan.amount > 0 && <Text style={styles.body}>{plan.amount} ml indicatifs, seulement si le terreau a besoin d’eau.</Text>}{!!plant.wateringAdvice && <Text style={styles.small}>{plant.wateringAdvice}</Text>}<Text style={styles.small}>Dernier arrosage : {plant.lastWatered ? new Date(plant.lastWatered).toLocaleString('fr-FR') : 'Non renseigné'}</Text><ActionButton title={wateredToday ? 'Arrosage déjà enregistré aujourd’hui' : busy ? 'Enregistrement…' : 'J’ai arrosé'} fullWidth disabled={busy || loading || wateredToday} onPress={() => void water(plant.id)} /></View>
          </View>;
        })}
      </>}
      <Text style={styles.small}>Cet espace permet de consulter les plantes confiées et d’enregistrer leurs arrosages. Le propriétaire peut retirer cet accès à tout moment.</Text>
      <ActionButton title="Confidentialité et données personnelles" secondary onPress={() => setPrivacy(true)} />
    </>}
  </ScrollView></SafeAreaView>;
}
const baseStyles = StyleSheet.create({ page: { flex: 1, backgroundColor: palette.paper }, content: { width: '100%', maxWidth: 780, alignSelf: 'center', padding: 20, paddingVertical: 28, gap: 22 }, toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }, brand: { fontFamily: fonts.editorial, fontSize: 36, color: palette.olive }, intro: { gap: 12 }, eyebrow: { fontSize: 11, color: palette.olive, letterSpacing: 1 }, title: { fontFamily: fonts.editorial, fontSize: 34, lineHeight: 40, color: palette.ink }, heading: { fontFamily: fonts.editorial, fontSize: 24, lineHeight: 30, color: palette.ink }, body: { fontSize: 15, lineHeight: 24, color: palette.muted }, small: { fontSize: 12, lineHeight: 20, color: palette.muted }, label: { fontSize: 14, lineHeight: 22, fontWeight: '600', color: palette.ink }, instructions: { padding: 20, borderRadius: 16, backgroundColor: palette.sage, gap: 14 }, card: { borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, borderRadius: 18, overflow: 'hidden' }, copy: { padding: 20, gap: 14 }, error: { padding: 16, borderWidth: 1, borderColor: '#A33827', borderRadius: 12, fontSize: 14, lineHeight: 22, color: '#A33827' }, notice: { padding: 16, borderRadius: 12, backgroundColor: palette.sage, color: palette.ink, fontSize: 14, lineHeight: 22 } });
