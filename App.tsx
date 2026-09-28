import React, { useEffect, useRef, useState } from 'react';
import { AppState, Image, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';
import { Garden, Plant, STORAGE_KEY, daysUntil, dueDate, parseGarden, waterPlant } from './src/model';
import { requestReminders, syncReminders } from './src/notifications';
import { careDefaults, estimateWaterAmount } from './src/care';
import { identifyPlant } from './src/plantApi';

const empty: Garden = { plants: [], reminders: false };
const dateLabel = (date: Date) => date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
const initialForm = { name: '', species: '', room: 'Salon', interval: '7', height: '30', pot: '14', temperature: '20', soil: 'Terreau universel', caretaker: '', photo: '', repotDate: '', waterAmount: '175', wateringAdvice: '', identificationConfidence: '', identificationSource: '' };
type Form = typeof initialForm;

function Button({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, (pressed || disabled) && { opacity: .5 }]}><Text style={[styles.buttonText, secondary && { color: '#245940' }]}>{title}</Text></Pressable>;
}
function Field({ label, value, onChange, numeric = false, placeholder = '' }: { label: string; value: string; onChange: (v: string) => void; numeric?: boolean; placeholder?: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} keyboardType={numeric ? 'numeric' : 'default'} placeholder={placeholder} placeholderTextColor="#849087" style={styles.input} maxLength={numeric ? 4 : 100} /></View>;
}

export default function App() {
  const [garden, setGarden] = useState<Garden>(empty);
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const lock = useRef(false);
  const [tab, setTab] = useState<'garden' | 'tasks' | 'settings'>('garden');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Form>(initialForm);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, refresh] = useState(0);
  const scheduleQueue = useRef(Promise.resolve());

  function schedule(next: Garden) {
    scheduleQueue.current = scheduleQueue.current.catch(() => {}).then(() => syncReminders(next.plants, next.reminders)).catch(() => {
      setNotice('Données enregistrées, mais les rappels n’ont pas pu être programmés. Vérifiez les autorisations dans Android.');
    });
  }
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      const loaded = raw ? parseGarden(raw) : empty;
      setGarden(loaded); schedule(loaded);
    }).catch(() => { setLoadFailed(true); setNotice('Impossible de lire la sauvegarde. Redémarrez l’application ; les données existantes sont conservées.'); }).finally(() => setReady(true));
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state === 'active' && ready && !loadFailed) { refresh(n => n + 1); schedule(garden); } });
    const timer = setInterval(() => refresh(n => n + 1), 60000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, [garden, ready, loadFailed]);

  async function save(next: Garden): Promise<boolean> {
    if (lock.current || loadFailed) return false;
    lock.current = true; setBusy(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setGarden(next); schedule(next); return true;
    } catch { setNotice('Enregistrement impossible. Réessayez : la modification n’a pas été sauvegardée.'); return false; }
    finally { lock.current = false; setBusy(false); }
  }
  async function choosePhoto(camera: boolean) {
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) { setError('Autorisez l’appareil photo ou choisissez une image dans la galerie.'); return; }
      const options = { quality: .65, base64: true as const };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync({ ...options, mediaTypes: ['images'] });
      if (!result.canceled) {
        const asset = result.assets[0];
        let uri = asset.uri;
        if (Platform.OS !== 'web') {
          const destination = new File(Paths.document, `plant-${Date.now()}.jpg`);
          new File(uri).copy(destination); uri = destination.uri;
        } else {
          const blob = await (await fetch(uri)).blob();
          uri = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
        }
        setForm(f => ({ ...f, photo: uri })); setError(''); setScanning(true); setScanStatus('Analyse de la photo par plant.id…');
        try {
          const base64 = asset.base64 || (Platform.OS === 'web' ? uri.split(',')[1] : await new File(asset.uri).base64());
          const identification = await identifyPlant(base64);
          const profile = careDefaults(`${identification.scientificName} ${identification.commonName}`);
          setForm(previous => ({
            ...previous,
            photo: uri,
            name: identification.commonName,
            species: identification.scientificName,
            interval: String(profile.interval),
            soil: profile.soil,
            waterAmount: String(estimateWaterAmount(Number(previous.pot), identification.scientificName)),
            wateringAdvice: identification.wateringAdvice,
            identificationConfidence: String(identification.confidence),
            identificationSource: 'plant.id',
          }));
          setScanStatus(`Proposition : ${identification.commonName} · confiance ${Math.round(identification.confidence * 100)} %. Vérifiez et corrigez les champs avant d’ajouter.`);
        } catch (scanError) {
          const message = scanError instanceof Error ? scanError.message : '';
          setScanStatus(message === 'API_NOT_CONFIGURED' ? 'Photo ajoutée, mais l’API n’est pas configurée. Consultez le README.' : `Identification impossible : ${message || 'réessayez avec une photo plus nette.'}`);
        } finally { setScanning(false); }
      }
    } catch { setError('Impossible d’ouvrir cette photo. Réessayez avec une autre image.'); }
  }
  function updateForm(key: keyof Form, value: string) {
    setForm(previous => {
      const next = { ...previous, [key]: value };
      if (key === 'pot') next.waterAmount = String(estimateWaterAmount(Number(value), previous.species));
      return next;
    });
  }
  async function addPlant() {
    if (!form.name.trim()) { setError('Donnez un nom à votre plante.'); return; }
    const interval = Number(form.interval), height = Number(form.height), pot = Number(form.pot), temperature = Number(form.temperature), waterAmount = Number(form.waterAmount);
    if (!Number.isInteger(interval) || interval < 1 || interval > 90 || !Number.isFinite(height) || height <= 0 || !Number.isFinite(pot) || pot <= 0 || !form.temperature.trim() || !Number.isFinite(temperature) || temperature < -10 || temperature > 50 || !Number.isFinite(waterAmount) || waterAmount < 0 || waterAmount > 5000) { setError('Vérifiez les valeurs : fréquence de 1 à 90 jours, dimensions positives, température de −10 à 50 °C et quantité de 0 à 5 000 ml.'); return; }
    const repot = form.repotDate ? new Date(`${form.repotDate}T12:00:00`) : new Date(new Date().setFullYear(new Date().getFullYear() + 1));
    if (form.repotDate && (!/^\d{4}-\d{2}-\d{2}$/.test(form.repotDate) || !Number.isFinite(+repot) || repot.toISOString().slice(0, 10) !== form.repotDate)) { setError('La date doit être valide, au format AAAA-MM-JJ.'); return; }
    const plant: Plant = { ...form, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: form.name.trim(), species: form.species.trim() || 'Espèce à préciser', room: form.room.trim() || 'Appartement', interval, height, pot, temperature, waterAmount, identificationConfidence: form.identificationConfidence ? Number(form.identificationConfidence) : undefined, lastWatered: null, createdAt: new Date().toISOString(), repotDate: repot.toISOString(), history: [] };
    if (await save({ ...garden, plants: [...garden.plants, plant] })) { setModal(false); setForm(initialForm); setNotice('Plante ajoutée. Aucun arrosage n’est enregistré pour le moment.'); }
  }
  const due = garden.plants.filter(p => daysUntil(dueDate(p)) <= 0);
  const current = garden.plants.find(p => p.id === selected);
  const disabled = busy || !ready || loadFailed;
  function openAdd() { setForm(initialForm); setError(''); setScanStatus(''); setModal(true); }
  async function watered(p: Plant) {
    if (await save({ ...garden, plants: garden.plants.map(item => item.id === p.id ? waterPlant(item) : item) })) setNotice(`Arrosage de ${p.name} enregistré.`);
  }

  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" backgroundColor="#F7F8F2" /><View style={styles.shell}>
    <View style={styles.header}><View><Text style={styles.brand}>folia<Text style={{ color: '#7EA175' }}>.</Text></Text><Text style={styles.subtitle}>UN PEU PLUS PROCHE DU VIVANT</Text></View><View style={styles.badge}><Text style={{ color: '#356148' }}>🌿 Mon espace</Text></View></View>
    <ScrollView contentContainerStyle={styles.content}>
      {!!notice && <Pressable onPress={() => setNotice('')} accessibilityRole="button" accessibilityLabel="Fermer le message"><Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}  ×</Text></Pressable>}
      {!ready ? <Text style={styles.body}>Ouverture de votre jardin…</Text> : <>
      {tab === 'garden' && <>
        <Text style={styles.eyebrow}>VOTRE PETIT COIN DE NATURE</Text><Text style={styles.title}>La vie pousse{ '\n' }chez vous.</Text><Text style={styles.body}>Un carnet pour vos plantes, un rythme à votre mesure.</Text>
        <View style={styles.hero}><Text style={styles.heroIcon}>🌱</Text><View style={{ flex: 1 }}><Text style={styles.heroTitle}>{garden.plants.length ? `${garden.plants.length} plante${garden.plants.length > 1 ? 's' : ''} à vos côtés` : 'Votre jardin commence ici'}</Text><Text style={styles.heroBody}>{due.length ? `${due.length} plante${due.length > 1 ? 's' : ''} à vérifier aujourd’hui` : 'Prenez le temps de les voir grandir.'}</Text></View></View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Mes plantes</Text><Text style={styles.counter}>{garden.plants.length}</Text></View>
        {garden.plants.length === 0 && <View style={styles.empty}><Text style={styles.emptyIcon}>🪴</Text><Text style={styles.sectionTitle}>Faites entrer la première.</Text><Text style={[styles.body, { textAlign: 'center' }]}>Une photo, un petit nom et votre carnet prend vie.</Text></View>}
        {garden.plants.map(p => <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Ouvrir ${p.name}`} onPress={() => { setSelected(p.id); setConfirmDelete(false); }} style={styles.card}>
          {p.photo ? <Image source={{ uri: p.photo }} style={styles.thumbnail} /> : <View style={[styles.thumbnail, styles.placeholder]}><Text style={{ fontSize: 36 }}>🪴</Text></View>}
          <View style={{ flex: 1 }}><Text style={styles.plantName}>{p.name}</Text><Text style={styles.muted}>{p.species} · {p.room}</Text><Text style={[styles.status, daysUntil(dueDate(p)) <= 0 && { color: '#936329' }]}>{!p.lastWatered ? 'Premier arrosage à renseigner' : daysUntil(dueDate(p)) <= 0 ? 'Terreau à vérifier' : `À vérifier le ${dateLabel(dueDate(p))}`}</Text></View><Text style={styles.muted}>↗</Text>
        </Pressable>)}
        <Button title="＋ Ajouter une plante" onPress={openAdd} disabled={disabled} />
        <Text style={styles.footnote}>Chaque plante a son rythme. Les rappels invitent à vérifier le terreau avant d’arroser.</Text>
      </>}
      {tab === 'tasks' && <>
        <Text style={styles.eyebrow}>LES PETITES ATTENTIONS</Text><Text style={styles.title}>À faire aujourd’hui</Text><Text style={styles.body}>Sans confirmation, un arrosage reste à faire.</Text>
        {!due.length && <View style={styles.empty}><Text style={styles.emptyIcon}>☀️</Text><Text style={styles.sectionTitle}>Rien à signaler.</Text><Text style={styles.body}>Vos prochaines échéances apparaîtront ici.</Text></View>}
        {due.map(p => <View key={p.id} style={styles.task}><Text style={styles.plantName}>💧 {p.name}</Text><Text style={styles.body}>{p.lastWatered ? `Échéance : ${dateLabel(dueDate(p))}` : 'Aucun arrosage enregistré'}. Vérifiez si le terreau a besoin d’eau.{p.waterAmount ? ` Si le terreau est sec, commencez par environ ${p.waterAmount} ml et arrêtez si l’eau s’écoule.` : ''}</Text>{!!p.caretaker && <Text style={styles.status}>Référent : {p.caretaker}</Text>}<Button title="J’ai arrosé" disabled={disabled} onPress={() => void watered(p)} /></View>)}
        <Text style={styles.sectionTitle}>À venir</Text>{garden.plants.filter(p => daysUntil(dueDate(p)) > 0).map(p => <View style={styles.card} key={p.id}><Text style={styles.plantName}>{p.name}</Text><Text style={styles.muted}>{dateLabel(dueDate(p))}</Text></View>)}
        <Text style={styles.sectionTitle}>Rempotage à vérifier</Text>{garden.plants.map(p => <View key={p.id} style={styles.card}><Text style={styles.plantName}>{p.name}</Text><Text style={styles.muted}>{dateLabel(new Date(p.repotDate))}</Text></View>)}
      </>}
      {tab === 'settings' && <>
        <Text style={styles.eyebrow}>À VOTRE RYTHME</Text><Text style={styles.title}>Mon appartement</Text>
        <View style={styles.task}><View style={styles.section}><Text style={styles.sectionTitle}>Rappels à 9 h</Text><Switch accessibilityLabel="Activer les rappels quotidiens" value={garden.reminders} disabled={disabled || Platform.OS === 'web'} trackColor={{ true: '#356148' }} onValueChange={async value => { try { if (value && !(await requestReminders())) { setNotice('Autorisez les notifications dans les paramètres Android.'); return; } await save({ ...garden, reminders: value }); } catch { setNotice('Impossible d’activer les notifications sur cet appareil.'); } }} /></View><Text style={styles.body}>{Platform.OS === 'web' ? 'Les notifications locales sont disponibles dans l’application Android.' : 'Un rappel quotidien dès l’échéance, jusqu’à confirmation de l’arrosage. Programmation sur 30 jours, renouvelée à chaque ouverture.'}</Text></View>
        <View style={styles.task}><Text style={styles.sectionTitle}>Données et photos</Text><Text style={styles.body}>Le carnet reste sur cet appareil. Lors d’une identification, la photo est envoyée à votre serveur local puis à plant.id. Consultez les conditions et la politique de confidentialité de Kindwise avant un usage public.</Text></View>
        <View style={styles.task}><Text style={styles.sectionTitle}>Première pousse · v1.1</Text><Text style={styles.body}>La reconnaissance remplit l’espèce, un nom courant, un terreau et une fréquence de départ. La quantité est une estimation liée au diamètre du pot. Validez toujours l’humidité réelle du terreau.</Text><Text style={styles.body}>Le diagnostic de maladies, le scan de pièce, la météo extérieure et la mesure automatique des dimensions restent à développer.</Text></View>
      </>}
      </>}
    </ScrollView>
    <View style={styles.nav}>{([{ id: 'garden', icon: '⌂', label: 'Mes plantes' }, { id: 'tasks', icon: '✓', label: 'À faire' }, { id: 'settings', icon: '⚙', label: 'Mon espace' }] as const).map(item => <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: tab === item.id }} onPress={() => setTab(item.id)} style={[styles.navItem, tab === item.id && styles.navActive]}><Text style={styles.navIcon}>{item.icon}</Text><Text style={styles.navLabel}>{item.label}{item.id === 'tasks' && due.length ? ` · ${due.length}` : ''}</Text></Pressable>)}</View>
    <Modal visible={modal} animationType="slide" onRequestClose={() => setModal(false)}><SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.shell} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Text style={styles.eyebrow}>UNE NOUVELLE RENCONTRE</Text><Text style={styles.title}>Scanner une plante</Text><Text style={styles.body}>Prenez une photo nette de la plante entière ou d’une feuille. plant.id proposera une espèce et préremplira la fiche.</Text>
      {!!form.photo && <Image source={{ uri: form.photo }} style={styles.largePhoto} />}
      <View style={styles.row}><Button title={scanning ? 'Analyse…' : '📷 Scanner'} secondary onPress={() => void choosePhoto(true)} disabled={scanning} /><Button title="Galerie" secondary onPress={() => void choosePhoto(false)} disabled={scanning} /></View>
      {!!scanStatus && <Text accessibilityLiveRegion="polite" style={styles.scanStatus}>{scanStatus}</Text>}
      {([{ key: 'name', label: 'Petit nom *', placeholder: 'Monstera du salon' }, { key: 'species', label: 'Espèce', placeholder: 'Monstera deliciosa' }, { key: 'room', label: 'Pièce' }, { key: 'interval', label: 'Vérifier l’arrosage tous les… jours *', numeric: true }, { key: 'waterAmount', label: 'Quantité indicative si le terreau est sec (ml)', numeric: true }, { key: 'height', label: 'Hauteur de la plante (cm)', numeric: true }, { key: 'pot', label: 'Diamètre du pot (cm)', numeric: true }, { key: 'temperature', label: 'Température de la pièce (°C)', numeric: true }, { key: 'soil', label: 'Type de terreau' }, { key: 'repotDate', label: 'Vérifier le rempotage le (AAAA-MM-JJ)', placeholder: 'Par défaut : dans un an' }, { key: 'caretaker', label: 'Personne référente pendant une absence', placeholder: 'Prénom — note personnelle' }] as { key: keyof Form; label: string; placeholder?: string; numeric?: boolean }[]).map(f => <Field key={f.key} label={f.label} placeholder={f.placeholder} numeric={f.numeric} value={form[f.key]} onChange={value => updateForm(f.key, value)} />)}
      {!!form.wateringAdvice && <View style={styles.task}><Text style={styles.sectionTitle}>Conseil fourni par plant.id</Text><Text style={styles.body}>{form.wateringAdvice}</Text></View>}
      <Text style={styles.footnote}>La reconnaissance est une proposition, pas une certitude. La quantité est calculée à partir du diamètre saisi et doit être ajustée au drainage, à la saison et à l’humidité du terreau. Les dimensions ne peuvent pas être déduites d’une photo sans repère d’échelle.</Text>
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}<Button title="Ajouter à mon appartement" onPress={() => void addPlant()} disabled={disabled || scanning} /><Button title="Annuler" secondary onPress={() => setModal(false)} />
    </ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>
    <Modal visible={!!current} animationType="slide" onRequestClose={() => setSelected(null)}><SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={[styles.content, { maxWidth: 720, width: '100%', alignSelf: 'center' }]}>{current && <>
      <Button title="← Mes plantes" secondary onPress={() => setSelected(null)} />{!!current.photo && <Image source={{ uri: current.photo }} style={styles.largePhoto} />}<Text style={styles.title}>{current.name}</Text><Text style={styles.body}>{current.species} · {current.room}</Text>
      <View style={styles.task}><Text style={styles.sectionTitle}>Son environnement</Text><Text style={styles.body}>{current.height} cm de haut · pot de {current.pot} cm{ '\n' }{current.soil} · {current.temperature} °C{ '\n' }Vérification tous les {current.interval} jours{current.waterAmount ? ` · environ ${current.waterAmount} ml si le terreau est sec` : ''}{ '\n' }Rempotage à vérifier : {dateLabel(new Date(current.repotDate))}</Text>{!!current.wateringAdvice && <Text style={styles.body}>Conseil plant.id : {current.wateringAdvice}</Text>}{current.identificationSource === 'plant.id' && current.identificationConfidence != null && <Text style={styles.status}>Identification plant.id · confiance {Math.round(current.identificationConfidence * 100)} %</Text>}{!!current.caretaker && <Text style={styles.body}>Référent (note) : {current.caretaker}</Text>}</View>
      <Button title="💧 J’ai arrosé" onPress={() => void watered(current)} disabled={disabled || (!!current.lastWatered && daysUntil(new Date(current.lastWatered)) === 0)} /><Text style={styles.footnote}>{current.lastWatered ? `Dernier arrosage : ${dateLabel(new Date(current.lastWatered))}` : 'Aucun arrosage enregistré. Vérifiez le terreau avant d’arroser.'}</Text>
      <Text style={styles.sectionTitle}>Historique des arrosages</Text>{current.history.length ? current.history.map((entry, i) => <Text style={styles.history} key={`${entry}-${i}`}>✓  {dateLabel(new Date(entry))} à {new Date(entry).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>) : <Text style={styles.body}>Les arrosages confirmés apparaîtront ici.</Text>}
      {confirmDelete ? <View style={styles.task}><Text style={styles.body}>Supprimer cette plante et son historique ?</Text><Button title="Confirmer la suppression" disabled={disabled} onPress={async () => { if (await save({ ...garden, plants: garden.plants.filter(p => p.id !== current.id) })) setSelected(null); }} /><Button title="Conserver la plante" secondary onPress={() => setConfirmDelete(false)} /></View> : <Button title="Supprimer cette plante" secondary onPress={() => setConfirmDelete(true)} />}
    </>}</ScrollView></SafeAreaView></Modal>
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8F2', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  shell: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { paddingHorizontal: 24, paddingVertical: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#E2E7DC' },
  brand: { fontSize: 36, fontWeight: '800', color: '#224B37', letterSpacing: -2 }, subtitle: { fontSize: 8, letterSpacing: 1.5, color: '#758471', marginTop: 4 },
  badge: { backgroundColor: '#E8EFDF', padding: 10, borderRadius: 25 }, content: { padding: 24, paddingBottom: 38, gap: 16 },
  eyebrow: { fontSize: 10, letterSpacing: 2, fontWeight: '700', color: '#66805A', marginTop: 12 },
  title: { fontSize: 36, lineHeight: 42, fontWeight: '700', color: '#233E2D', letterSpacing: -1.2 },
  body: { fontSize: 15, lineHeight: 23, color: '#64715F' }, hero: { padding: 23, backgroundColor: '#284D38', borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 8 },
  heroIcon: { fontSize: 46 }, heroTitle: { color: '#F7F8F2', fontSize: 19, fontWeight: '600' }, heroBody: { color: '#CCDCC5', fontSize: 13, lineHeight: 20, marginTop: 6 },
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, sectionTitle: { fontSize: 20, color: '#2A4734', fontWeight: '600' }, counter: { color: '#64715F', backgroundColor: '#E8EFDF', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  empty: { alignItems: 'center', padding: 28, gap: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C7D4BD', borderRadius: 22 }, emptyIcon: { fontSize: 56 },
  card: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderWidth: 1, borderColor: '#E6EBDD', flexWrap: 'wrap' },
  thumbnail: { width: 70, height: 82, borderRadius: 14 }, placeholder: { backgroundColor: '#EBEFDF', alignItems: 'center', justifyContent: 'center' }, plantName: { fontSize: 18, fontWeight: '600', color: '#294632' }, muted: { fontSize: 12, color: '#73816A', marginTop: 4 }, status: { fontSize: 12, color: '#477655', marginTop: 8 },
  button: { backgroundColor: '#315C40', borderRadius: 15, paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', minHeight: 50 }, secondary: { backgroundColor: '#E8EFDF' }, buttonText: { color: '#FFF', fontWeight: '600', fontSize: 15 },
  footnote: { color: '#7E8976', fontSize: 12, lineHeight: 19 }, task: { padding: 20, borderRadius: 22, backgroundColor: '#FFF', gap: 15, borderWidth: 1, borderColor: '#E6EBDD' },
  nav: { flexDirection: 'row', padding: 12, gap: 6, borderTopWidth: 1, borderColor: '#E2E7DC', backgroundColor: '#F7F8F2' }, navItem: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 4, borderRadius: 16 }, navActive: { backgroundColor: '#E6EEDC' }, navIcon: { color: '#315C40', fontSize: 22 }, navLabel: { fontSize: 11, color: '#315C40', fontWeight: '600' },
  field: { gap: 8 }, label: { fontSize: 13, color: '#3D573F', fontWeight: '600' }, input: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DCE3D3', borderRadius: 12, padding: 14, fontSize: 16, color: '#233E2D' },
  row: { flexDirection: 'row', gap: 12 }, largePhoto: { width: '100%', height: 250, borderRadius: 22 }, error: { color: '#A33827', lineHeight: 21 }, notice: { padding: 15, backgroundColor: '#E8EFDF', borderRadius: 12, color: '#36543C', lineHeight: 21 }, scanStatus: { padding: 15, backgroundColor: '#EEF3E8', borderRadius: 12, color: '#36543C', lineHeight: 21 }, history: { paddingVertical: 12, borderBottomWidth: 1, borderColor: '#E2E7DC', color: '#64715F' },
});
