import { useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Plant } from '../../shared/model';
import { ActionButton } from '../../shared/ui/ActionButton';
import { palette, useReadableStyles } from '../../shared/ui/theme';
import { localDate, parseCareDate, careEvents, cancelWatering, currentSubstrate, recordRepotting, recordWatering, type WateringEvent } from './careRecords';
import { defaultRepotObservations, repottingAdvice, type RepotObservations } from './repotting';
import { SubstratePicker } from './SubstratePicker';

export function CareJournal({ plant, disabled, onSave }: { plant: Plant; disabled: boolean; onSave: (next: Plant, message: string) => Promise<boolean> }) {
  const styles = useReadableStyles(baseStyles);
  const [mode, setMode] = useState<'watering' | 'repotting' | null>(null);
  const [editId, setEditId] = useState<string>();
  const [date, setDate] = useState(''), [time, setTime] = useState(''), [amount, setAmount] = useState(''), [note, setNote] = useState('');
  const [pot, setPot] = useState(''), [depth, setDepth] = useState(''), [nextCheck, setNextCheck] = useState('');
  const [substrate, setSubstrate] = useState(() => currentSubstrate(plant));
  const [error, setError] = useState(''), [saving, setSaving] = useState(false), [confirmCancel, setConfirmCancel] = useState<string>();
  const [observations, setObservations] = useState<RepotObservations>(defaultRepotObservations);
  const [historyOpen, setHistoryOpen] = useState(false);
  const locked = disabled || saving;
  const advice = repottingAdvice(plant, observations);
  function open(kind: 'watering' | 'repotting', event?: WateringEvent) {
    const now = event ? new Date(event.occurredAt) : new Date();
    setMode(kind); setEditId(event?.id); setDate(localDate(now)); setTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`); setAmount(event?.amountMl == null ? '' : String(event.amountMl)); setNote(event?.note ?? ''); setError(''); setConfirmCancel(undefined);
    setPot(String(plant.pot)); setDepth(String(plant.irrigation?.depth ?? 12)); setSubstrate(currentSubstrate(plant));
    const check = new Date(); check.setFullYear(check.getFullYear() + 1); setNextCheck(localDate(check));
  }
  async function commit(make: () => Plant, message: string) {
    setSaving(true); setError('');
    try { if (await onSave(make(), message)) { setMode(null); setConfirmCancel(undefined); setHistoryOpen(true); } }
    catch (error) { setError(error instanceof Error ? error.message : 'Enregistrement impossible.'); }
    finally { setSaving(false); }
  }
  function submit() {
    void commit(() => mode === 'watering' ? recordWatering(plant, { occurredAt: parseCareDate(date, time), amountMl: amount.trim() ? Number(amount.replace(',', '.')) : undefined, note }, new Date(), editId) : recordRepotting(plant, { occurredAt: parseCareDate(date, time), pot: Number(pot.replace(',', '.')), depth: Number(depth.replace(',', '.')), substrate, nextCheck: parseCareDate(nextCheck, '12:00'), note }), mode === 'watering' ? (editId ? 'Arrosage corrigé. Échéances recalculées.' : 'Arrosage enregistré. Échéances recalculées.') : 'Rempotage enregistré. Pot, substrat et conseils actualisés.');
  }
  function field(label: string, value: string, change: (value: string) => void, numeric = false, maxLength = 1000) {
    return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} editable={!locked} value={value} onChangeText={change} keyboardType={numeric ? 'decimal-pad' : 'default'} maxLength={maxLength} style={styles.input} /></View>;
  }
  const events = [...careEvents(plant)].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  return <View style={styles.panel}>
    <Text accessibilityRole="header" style={styles.title}>Journal des soins</Text>
    {!plant.archivedAt && <View style={styles.row}><ActionButton title="Saisir un arrosage daté" secondary disabled={locked} onPress={() => open('watering')} /><ActionButton title="Confirmer un rempotage" secondary disabled={locked} onPress={() => open('repotting')} /></View>}
    {mode && !plant.archivedAt && <View style={styles.form}>
      <Text accessibilityRole="header" style={styles.label}>{mode === 'watering' ? editId ? 'Corriger cet arrosage' : 'Nouvel arrosage' : 'Rempotage réalisé'}</Text>
      <Text style={styles.small}>Date et heure locales. Les dates futures sont refusées.</Text>
      {field('Date du soin (AAAA-MM-JJ)', date, setDate, false, 10)}{field('Heure du soin (HH:MM)', time, setTime, false, 5)}
      {mode === 'watering' ? <>{field('Quantité réellement versée (ml, facultatif)', amount, setAmount, true, 8)}<Text style={styles.small}>Laissez vide si vous ne connaissez pas la quantité. Cette valeur décrit le soin ; elle ne remplace pas la dose conseillée.</Text></> : <>
        <Text style={styles.label}>{advice.title}</Text>
        {([['roots', 'Racines', [['unknown', 'Non observées'], ['comfortable', 'À l’aise'], ['crowded', 'À l’étroit']]], ['soil', 'État du substrat', [['unknown', 'Non observé'], ['healthy', 'Aéré et drainant'], ['compacted', 'Tassé / drainant mal']]], ['growth', 'Croissance observée', [['unknown', 'À préciser'], ['growing', 'Active'], ['rest', 'Au repos']]]] as const).map(([key, title, options]) => <View key={key} style={styles.field}><Text style={styles.label}>{title}</Text><View style={styles.row}>{options.map(([value, title]) => <ActionButton key={value} title={`${observations[key] === value ? '✓ ' : ''}${title}`} secondary={observations[key] !== value} disabled={locked} onPress={() => setObservations(previous => ({ ...previous, [key]: value }))} />)}</View></View>)}
        {advice.reasons.map(reason => <Text key={reason} style={styles.small}>{reason}</Text>)}<ActionButton title="Conseils de rempotage RHS ↗" secondary onPress={() => void Linking.openURL(advice.source)} />
        {field('Nouveau diamètre du pot (cm)', pot, setPot, true, 6)}{field('Nouvelle profondeur utile (cm)', depth, setDepth, true, 6)}
        <Text style={styles.small}>Le même pot peut être conservé si seul le substrat est renouvelé. Aucun arrosage n’est créé par le rempotage.</Text>
        <SubstratePicker value={substrate} disabled={locked} onChange={setSubstrate} />
        {field('Prochain contrôle de rempotage (AAAA-MM-JJ)', nextCheck, setNextCheck, false, 10)}<Text style={styles.small}>La date proposée dans un an est un rappel modifiable pour observer la motte.</Text>
      </>}
      {field('Note du soin (facultatif)', note, setNote)}
      <View style={styles.row}><ActionButton title={saving ? 'Enregistrement…' : 'Enregistrer le soin'} disabled={locked} onPress={submit} /><ActionButton title="Abandonner la saisie" secondary disabled={locked} onPress={() => { setMode(null); setError(''); }} /></View>
    </View>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <ActionButton title={`${historyOpen ? 'Masquer' : 'Afficher'} l’historique des soins (${events.length})`} secondary onPress={() => setHistoryOpen(previous => !previous)} />
    {historyOpen && <>{!events.length && <Text style={styles.small}>Aucun soin enregistré.</Text>}{events.map(event => <View key={event.id} style={styles.entry}>
      <Text style={styles.label}>{event.kind === 'watering' ? event.cancelledAt ? 'Arrosage annulé' : 'Arrosage' : event.kind === 'repotting' ? 'Rempotage' : 'Changement de substrat'} · {new Date(event.occurredAt).toLocaleString('fr-FR')}</Text>
      {event.kind === 'watering' ? <><Text style={styles.small}>{event.amountMl == null ? 'Quantité non renseignée' : `${event.amountMl} ml réellement versés`}{event.updatedAt ? ` · corrigé le ${new Date(event.updatedAt).toLocaleString('fr-FR')}` : ''}</Text>{event.cancelledAt && <Text style={styles.small}>Annulé le {new Date(event.cancelledAt).toLocaleString('fr-FR')}, sans effet sur les échéances.</Text>}</> : <><Text style={styles.small}>{event.kind === 'repotting' ? `Pot : ${event.previousPot} → ${event.pot} cm · profondeur : ${event.previousDepth} → ${event.depth} cm · ancien substrat : ${event.previousSubstrate.name}` : `Ancien substrat : ${event.previousSubstrate.name}`}</Text><Text style={styles.small}>Substrat : {event.substrate.name} · {event.substrate.composition}</Text><Text style={styles.small}>Provenance : {event.substrate.origin === 'catalogue' ? 'profil du catalogue' : 'déclaration utilisateur'}{event.substrate.productCode ? ` · code ${event.substrate.productCode}` : ''}</Text></>}
      {event.kind === 'repotting' && <Text style={styles.small}>Prochain contrôle choisi : {new Date(event.nextCheck).toLocaleDateString('fr-FR')}</Text>}
      {!!event.note && <Text style={styles.body}>{event.note}</Text>}
      {event.kind === 'watering' && !event.cancelledAt && !plant.archivedAt && <View style={styles.row}>{confirmCancel === event.id ? <><Text style={styles.small}>Annuler cet arrosage et recalculer les échéances ?</Text><ActionButton title="Confirmer l’annulation du soin" disabled={locked} onPress={() => void commit(() => cancelWatering(plant, event.id), 'Arrosage annulé. Échéances recalculées.')} /><ActionButton title="Garder cet arrosage" secondary disabled={locked} onPress={() => setConfirmCancel(undefined)} /></> : <><ActionButton title="Corriger cet arrosage" secondary disabled={locked} onPress={() => open('watering', event)} /><ActionButton title="Annuler cet arrosage" secondary disabled={locked} onPress={() => setConfirmCancel(event.id)} /></>}</View>}
    </View>)}</>}
  </View>;
}
const baseStyles = StyleSheet.create({ panel: { gap: 16 }, title: { fontSize: 22, color: palette.ink, fontWeight: '600' }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, form: { backgroundColor: palette.paper, borderRadius: 14, padding: 16, gap: 16 }, field: { gap: 8 }, label: { color: palette.ink, fontSize: 14, fontWeight: '600', lineHeight: 22 }, body: { color: palette.muted, fontSize: 14, lineHeight: 22 }, small: { color: palette.muted, fontSize: 12, lineHeight: 19 }, input: { borderWidth: 1, borderColor: palette.line, borderRadius: 10, padding: 14, color: palette.ink, backgroundColor: palette.surface, fontSize: 16, minHeight: 48 }, entry: { borderTopWidth: 1, borderColor: palette.line, paddingVertical: 16, gap: 10 }, error: { color: '#A33827', fontSize: 14, lineHeight: 22 } });
