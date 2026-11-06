import Constants from 'expo-constants';
import { invitationCode, invitationLink } from './invitation';
import { wateringPlan } from '../plants/irrigation';
import { PlantVisual } from '../plants/PlantVisual';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { createDelegation, listDelegations, loadSharedGarden, revokeDelegation, waterSharedPlant, loadCaretakerActivity, type AccountSession, type Delegation, type SharedGarden } from '../accounts/accountApi';
import { type Plant } from '../../shared/model';
import { palette, fonts, useReadableStyles } from '../../shared/ui/theme';
const statuses = { pending: 'À accepter', 'invitation-expired': 'Invitation expirée', scheduled: 'Accès à venir', active: 'Accès actif', expired: 'Accès terminé', revoked: 'Accès retiré' };
const dateLabel = (value: string) => new Date(value).toLocaleString('fr-FR');
function dateValue(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function boundary(value: string, end: boolean) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Saisissez les dates au format AAAA-MM-JJ.');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (dateValue(date) !== value) throw new Error('Date invalide.');
  if (end) date.setDate(date.getDate() + 1);
  return date.toISOString();
}
export function DelegationPanel({ session, plants, email, notes, disabled, onOpenInvitation }: { session: AccountSession; plants: Plant[]; email: string; notes: string; disabled: boolean; onOpenInvitation: (code: string) => void }) {
  const styles = useReadableStyles(baseStyles);
  const [start, setStart] = useState(dateValue(new Date()));
  const [end, setEnd] = useState(dateValue(new Date(Date.now() + 7 * 86400000)));
  const [ids, setIds] = useState<string[]>([]);
  const [invitation, setInvitation] = useState('');
  const [created, setCreated] = useState('');
  const [lists, setLists] = useState<{ outgoing: Delegation[]; incoming: Delegation[] }>({ outgoing: [], incoming: [] });
  const [shared, setShared] = useState<SharedGarden | null>(null);
  const [activity, setActivity] = useState<{ plantId: string; wateredAt: string; email: string; viaLink: number }[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const lock = useRef(false);
  async function reload() {
    const [next, log] = await Promise.all([listDelegations(session), loadCaretakerActivity(session)]);
    setLists(next); setActivity(log.activity);
  }
  useEffect(() => {
    let active = true;
    Promise.all([listDelegations(session), loadCaretakerActivity(session)]).then(([next, log]) => { if (active) { setLists(next); setActivity(log.activity); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [session.token]);
  useEffect(() => {
    if (!shared) return;
    const timer = setInterval(() => {
      if (Date.parse(shared.delegation.endsAt) <= Date.now()) { setShared(null); setMessage('La période d’accès est terminée.'); return; }
      loadSharedGarden(session, shared.delegation.id).then(setShared).catch(e => { setShared(null); setError(e.message); });
    }, 30000);
    return () => clearInterval(timer);
  }, [session.token, shared?.delegation.id]);
  async function run(action: () => Promise<void>) {
    if (disabled || lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Action impossible. Réessayez.'); }
    finally { lock.current = false; setBusy(false); }
  }
  const blocked = disabled || busy;
  function button(title: string, action: () => Promise<void>) {
    return <Pressable accessibilityRole="button" disabled={blocked} style={[styles.button, blocked && { opacity: .5 }]} onPress={() => void run(action)}><Text style={styles.buttonText}>{title}</Text></Pressable>;
  }
  function field(label: string, value: string, change: (value: string) => void) {
    return <View style={{ gap: 8 }}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} style={styles.input} editable={!blocked} value={value} onChangeText={change} autoCapitalize="none" autoCorrect={false} /></View>;
  }
  return <View style={{ gap: 24 }}>
    <Text accessibilityRole="header" style={styles.title}>Confier mes plantes temporairement</Text>
    <Text style={styles.body}>Le lien ouvre directement les plantes confiées et vos consignes, sans inscription ni connexion. Toute personne disposant du lien peut confirmer leurs arrosages pendant la période choisie. L’e-mail ci-dessus sert à identifier le destinataire dans votre suivi.</Text>
    {field('Début (AAAA-MM-JJ)', start, setStart)}{field('Dernier jour inclus (AAAA-MM-JJ)', end, setEnd)}
    <Text style={styles.label}>Plantes à confier</Text>
    <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">{plants.map(plant => <View key={plant.id} style={styles.row}><Text style={[styles.body, { flex: 1 }]}>{plant.name}</Text><Switch accessibilityLabel={`Confier ${plant.name}`} value={ids.includes(plant.id)} disabled={blocked} onValueChange={checked => setIds(current => checked ? [...current, plant.id] : current.filter(id => id !== plant.id))} /></View>)}</ScrollView>
    {!plants.length && <Text style={styles.body}>Ajoutez une plante avant de créer une invitation.</Text>}
    {button('Créer une invitation', async () => {
      const result = await createDelegation(session, { email, notes, startsAt: boundary(start, false), endsAt: boundary(end, true), plantIds: ids.filter(id => plants.some(p => p.id === id)) });
      const base = Platform.OS === 'web' ? `${window.location.origin}${window.location.pathname}` : process.env.EXPO_PUBLIC_WEB_URL || Constants.expoConfig?.hostUri;
      const link = invitationLink(result.invitation, base);
      setCreated(link); setMessage(`Accès direct créé jusqu’au ${dateLabel(result.delegation.endsAt)}. Partagez le lien ou le code avec la personne, qui pourra l’ouvrir sans compte.`); await reload();
    })}
    {!!created && <View style={{ gap: 8 }}><Text style={styles.label}>Lien / code à partager (visible ici uniquement après création)</Text><TextInput accessibilityLabel="Invitation à partager" style={styles.input} value={created} editable={false} multiline selectTextOnFocus /></View>}
    <Text accessibilityRole="header" style={styles.title}>Mes invitations envoyées</Text>
    {lists.outgoing.map(item => <View key={item.id} style={styles.card}><Text style={styles.label}>{item.email} · {statuses[item.status]}{item.accessMode === 'link' ? ' · accès par lien' : ''}</Text><Text style={styles.body}>{dateLabel(item.startsAt)} → {dateLabel(item.endsAt)} · {item.plantIds.length} plante(s)</Text>{!['revoked', 'expired'].includes(item.status) && button('Retirer cet accès', async () => { await revokeDelegation(session, item.id); setCreated(''); await reload(); setMessage('Accès retiré immédiatement.'); })}</View>)}
    {!lists.outgoing.length && <Text style={styles.body}>Aucune invitation envoyée.</Text>}
    <Text accessibilityRole="header" style={styles.title}>Ouvrir un accès reçu</Text>
    {field('Code ou lien reçu', invitation, setInvitation)}
    {button('Ouvrir le jardin partagé', async () => {
      const code = invitationCode(invitation);
      if (!code) throw new Error('Lien ou code invalide. Copiez le lien complet reçu.');
      onOpenInvitation(code);
    })}
    {!!lists.incoming.length && <>
    <Text accessibilityRole="header" style={styles.title}>Plantes qui me sont confiées</Text>
    {button('Actualiser les accès', async () => { setShared(null); await reload(); })}
    {lists.incoming.map(item => <View key={item.id} style={styles.card}><Text style={styles.label}>{statuses[item.status]} · {item.plantIds.length} plante(s)</Text><Text style={styles.body}>{dateLabel(item.startsAt)} → {dateLabel(item.endsAt)}</Text>{item.status === 'active' && button('Voir les plantes et consignes', async () => { setShared(null); setShared(await loadSharedGarden(session, item.id)); })}</View>)}
    {shared && <View style={styles.card}><Text style={styles.title}>Espace d’entretien</Text><Text style={styles.body}>{shared.delegation.notes || 'Aucune consigne supplémentaire.'}</Text>{shared.plants.map(plant => <View key={plant.id} style={styles.card}><Text style={styles.label}>{plant.name} · {plant.species}</Text><PlantVisual plant={plant} /><Text style={styles.body}>{plant.room} · Vérification : {wateringPlan(plant).nextCheck.toLocaleDateString('fr-FR')}{'\n'}Dernier arrosage : {plant.lastWatered ? dateLabel(plant.lastWatered) : 'Non renseigné'}{plant.waterAmount != null ? `\nQuantité indicative si le terreau est sec : ${plant.waterAmount} ml` : ''}{plant.wateringAdvice ? `\n${plant.wateringAdvice}` : ''}</Text>{button('J’ai arrosé', async () => {
      try { setShared(await waterSharedPlant(session, shared.delegation.id, plant.id)); setMessage('Arrosage enregistré dans la collection du propriétaire.'); }
      catch (e) { setShared(null); throw e; }
    })}</View>)}{!shared.plants.length && <Text style={styles.body}>Les plantes confiées ont été retirées de la collection.</Text>}</View>}
    </>}
    {!!activity.length && <View style={styles.card}><Text style={styles.title}>Arrosages des personnes de confiance</Text>{activity.map((item, index) => <Text key={index} style={styles.body}>{plants.find(p => p.id === item.plantId)?.name || 'Plante retirée'} · {item.viaLink ? `Lien envoyé à ${item.email}` : item.email} · {dateLabel(item.wateredAt)}</Text>)}</View>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{!!message && <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text>}
  </View>;
}
const baseStyles = StyleSheet.create({ title: { fontFamily: fonts.editorial, color: palette.ink, fontSize: 26 }, body: { color: palette.muted, fontSize: 15, lineHeight: 23 }, label: { color: palette.olive, fontSize: 14 }, input: { padding: 14, borderWidth: 1, borderColor: palette.line, color: palette.ink, backgroundColor: palette.surface, fontSize: 16 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }, card: { padding: 16, gap: 12, borderWidth: 1, borderColor: palette.line, borderRadius: 12 }, button: { alignSelf: 'flex-start', padding: 14, minHeight: 44, backgroundColor: palette.forest, borderRadius: 10 }, buttonText: { color: palette.surface, fontSize: 14 }, error: { color: '#A33827', fontSize: 15 } });
