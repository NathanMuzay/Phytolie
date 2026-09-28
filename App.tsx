import React, { useEffect, useRef, useState } from 'react';
import { AppState, Image, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';
import { Garden, Plant, STORAGE_KEY, daysUntil, dueDate, parseGarden, waterPlant, sortPlantsByUrgency, DEFAULT_REMINDER_TIME, isReminderTime } from './src/model';
import { requestReminders, syncReminders, onReminderOpened } from './src/notifications';
import { careDefaults, estimateWaterAmount } from './src/care';
import { wateringPlan, defaultIrrigation, Irrigation } from './src/irrigation';
import { searchCities, fetchWeather, outdoorTemperature, City, Weather } from './src/weather';
import { AccountScreen } from './src/AccountScreen';
import { AccountSession, loadAccountGarden, saveAccountGarden, logoutAccount, mergeLocalPlants } from './src/accountApi';
import { identifyPlant, PlantIdentification } from './src/plantApi';

const empty: Garden = { plants: [], reminders: false };
const dateLabel = (date: Date) => date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
const initialForm = { name: '', species: '', room: 'Salon', interval: '7', height: '30', pot: '14', temperature: '20', soil: 'Terreau universel', caretaker: '', photo: '', repotDate: '', waterAmount: '175', wateringAdvice: '', identificationConfidence: '', identificationSource: '', family: '', description: '' };
type Form = typeof initialForm;

function Button({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, (pressed || disabled) && { opacity: .5 }]}><Text style={[styles.buttonText, secondary && { color: '#245940' }]}>{title}</Text></Pressable>;
}
function Field({ label, value, onChange, numeric = false, placeholder = '' }: { label: string; value: string; onChange: (v: string) => void; numeric?: boolean; placeholder?: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} keyboardType={numeric ? 'numeric' : 'default'} placeholder={placeholder} placeholderTextColor="#849087" style={styles.input} maxLength={numeric ? 4 : 100} /></View>;
}

export default function App() {
  const [account, setAccount] = useState<AccountSession | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  if (showAuth) return <AccountScreen onConnected={session => { setAccount(session); setShowAuth(false); }} onCancel={() => setShowAuth(false)} />;
  return <GardenApp key={account?.user.id || 'local'} account={account} onOpenAuth={() => setShowAuth(true)} onDisconnected={() => { setAccount(null); setShowAuth(false); }} />;
}

function GardenApp({ account, onOpenAuth, onDisconnected }: { account: AccountSession | null; onOpenAuth: () => void; onDisconnected: () => void }) {
  const [irrigation, setIrrigation] = useState<Irrigation>({ ...defaultIrrigation });
  const [lastWateredInput, setLastWateredInput] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherStatus, setWeatherStatus] = useState('');
  const [searchingCity, setSearchingCity] = useState(false);
  const [reminderTimeInput, setReminderTimeInput] = useState(DEFAULT_REMINDER_TIME);
  const [reminderStatus, setReminderStatus] = useState('');
  const [reminderError, setReminderError] = useState('');
  const [garden, setGarden] = useState<Garden>(empty);
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [suggestions, setSuggestions] = useState<PlantIdentification[]>([]);
  const [scanStatus, setScanStatus] = useState('');
  const lock = useRef(false);
  const [tab, setTab] = useState<'garden' | 'tasks' | 'settings'>('garden');
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortByUrgency, setSortByUrgency] = useState(true);
  const [form, setForm] = useState<Form>(initialForm);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, refresh] = useState(0);
  const revision = useRef(0);
  const leaving = useRef(false);
  const mounted = useRef(true);
  const scheduleQueue = useRef(Promise.resolve());

  function withWeather(plants: Plant[], city = garden.city) {
    const temperature = outdoorTemperature(weather, city);
    return plants.map(p => p.irrigation?.location === 'outdoor' && temperature != null ? { ...p, temperature } : p);
  }
  useEffect(() => {
    if (!garden.city) { setWeather(null); return; }
    const city = garden.city;
    let active = true;
    async function update() {
      try { const next = await fetchWeather(city); if (active) { setWeather(next); setWeatherStatus(''); } }
      catch (error) { if (active) { setWeather(null); setWeatherStatus(error instanceof Error ? error.message : 'Météo indisponible.'); } }
    }
    void update();
    const timer = setInterval(() => void update(), 3600000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void update(); });
    return () => { active = false; clearInterval(timer); subscription.remove(); };
  }, [garden.city?.id]);
  useEffect(() => { if (ready && !loadFailed) schedule(garden); }, [weather]);
  async function findCities() {
    setSearchingCity(true); setCities([]);
    try { const results = await searchCities(cityQuery); setCities(results); setWeatherStatus(results.length ? 'Choisissez la ville correspondante.' : 'Aucune ville trouvée.'); }
    catch (error) { setWeatherStatus(error instanceof Error ? error.message : 'Recherche impossible.'); }
    finally { setSearchingCity(false); }
  }
  function schedule(next: Garden) {
    if (leaving.current || !mounted.current) return;
    scheduleQueue.current = scheduleQueue.current.catch(() => {}).then(async () => {
      if (leaving.current || !mounted.current) return;
      const count = await syncReminders(withWeather(next.plants, next.city), next.reminders, next.reminderTime ?? DEFAULT_REMINDER_TIME);
      setReminderStatus(Platform.OS === 'web' ? 'Heure sauvegardée. Notifications disponibles sur Android.' : !next.reminders ? 'Rappels désactivés.' : count ? `${count} rappels programmés à ${next.reminderTime ?? DEFAULT_REMINDER_TIME}.` : 'Aucune échéance dans les 30 prochains jours.');
    }).catch(error => {
      setReminderStatus('Programmation des rappels en échec.');
      setNotice(`Données enregistrées, mais les rappels n’ont pas pu être programmés. ${error instanceof Error ? error.message : 'Vérifiez les autorisations dans Android.'}`);
    });
  }
  useEffect(() => onReminderOpened(() => { setTab('tasks'); setSelected(null); setModal(false); }), []);
  async function saveReminderTime() {
    if (!isReminderTime(reminderTimeInput)) { setReminderError('Saisissez une heure valide au format HH:MM, de 00:00 à 23:59.'); return; }
    setReminderError('');
    if (await save({ ...garden, reminderTime: reminderTimeInput })) setNotice(`Heure des rappels enregistrée : ${reminderTimeInput}.`);
  }
  async function loadGarden() {
    setReady(false); setLoadFailed(false);
    try {
      let loaded: Garden;
      if (account) {
        const result = await loadAccountGarden(account); loaded = result.garden; revision.current = result.revision;
      } else {
        const raw = await AsyncStorage.getItem(STORAGE_KEY); loaded = raw ? parseGarden(raw) : empty;
      }
      if (!mounted.current) return;
      setGarden(loaded); setReminderTimeInput(loaded.reminderTime ?? DEFAULT_REMINDER_TIME); schedule(loaded);
    } catch (error) {
      if (mounted.current) { setLoadFailed(true); setNotice(error instanceof Error ? error.message : 'Impossible de lire la collection. Les données existantes sont conservées.'); }
    } finally { if (mounted.current) setReady(true); }
  }
  useEffect(() => {
    mounted.current = true; void loadGarden();
    return () => { mounted.current = false; };
  }, []);
  async function switchAccount() {
    if (lock.current || scanning || leaving.current) return;
    leaving.current = true; setBusy(true);
    try {
      if (account) await logoutAccount(account);
      await scheduleQueue.current;
      await syncReminders([], false);
      if (account) onDisconnected(); else onOpenAuth();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Changement de compte impossible. Réessayez.'); leaving.current = false; }
    finally { if (mounted.current) setBusy(false); }
  }
  async function importLocalGarden() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) { setNotice('Aucune collection locale à importer.'); return; }
      const local = parseGarden(raw);
      const merged = mergeLocalPlants(garden, local);
      const count = merged.plants.length - garden.plants.length;
      if (!count) { setNotice('Aucune nouvelle plante locale à importer.'); return; }
      if (await save(merged)) setNotice(`${count} plantes importées. La copie locale reste conservée.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Import impossible. La collection locale est conservée.'); }
  }
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state === 'active' && ready && !loadFailed) { refresh(n => n + 1); schedule(garden); } });
    const timer = setInterval(() => refresh(n => n + 1), 60000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, [garden, ready, loadFailed, weather]);

  async function save(next: Garden): Promise<boolean> {
    if (lock.current || loadFailed || leaving.current) return false;
    lock.current = true; setBusy(true);
    try {
      if (account) {
        const portable: Garden = { ...next, plants: await Promise.all(next.plants.map(async plant => {
          if (!plant.photo || plant.photo.startsWith('data:')) return plant;
          if (Platform.OS === 'web') throw new Error('Cette photo locale n’est plus disponible. Choisissez-la à nouveau.');
          const photo = new File(plant.photo);
          return { ...plant, photo: `data:${photo.type || 'image/jpeg'};base64,${await photo.base64()}` };
        })) };
        revision.current = await saveAccountGarden(account, portable, revision.current);
        next = portable;
      } else await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setGarden(next); schedule(next); return true;
    } catch (error) { const message = error instanceof Error ? error.message : 'Enregistrement impossible. Réessayez : la modification n’a pas été sauvegardée.'; setNotice(message); setError(message); return false; }
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
        if (account && asset.base64) {
          uri = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
        } else if (Platform.OS !== 'web') {
          const destination = new File(Paths.document, `plant-${Date.now()}.jpg`);
          new File(uri).copy(destination); uri = destination.uri;
        } else {
          const blob = await (await fetch(uri)).blob();
          uri = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
        }
        setSuggestions([]);
        setForm(f => ({ ...f, photo: uri, species: '', identificationSource: '', identificationConfidence: '', wateringAdvice: '', family: '', description: '' })); setError(''); setScanning(true); setScanStatus('Analyse de la photo par plant.id…');
        try {
          const base64 = asset.base64 || (Platform.OS === 'web' ? uri.split(',')[1] : await new File(asset.uri).base64());
          const results = await identifyPlant(base64);
          setSuggestions(results);
          if (results[0].confidence >= 0.8) {
            applyIdentification(results[0]);
          } else {
            setScanStatus('Identification incertaine : choisissez une proposition ci-dessous ou saisissez l’espèce manuellement.');
          }
        } catch (scanError) {
          const message = scanError instanceof Error ? scanError.message : '';
          setScanStatus(message === 'API_NOT_CONFIGURED' ? 'Photo ajoutée, mais l’API n’est pas configurée. Consultez le README.' : `Identification impossible : ${message || 'réessayez avec une photo plus nette.'} Vous pouvez saisir l’espèce manuellement.`);
        } finally { setScanning(false); }
      }
    } catch { setError('Impossible d’ouvrir cette photo. Réessayez avec une autre image.'); }
  }
  function applyIdentification(identification: PlantIdentification) {
    const profile = careDefaults(`${identification.scientificName} ${identification.commonName}`);
    setForm(previous => ({ ...previous,
      name: previous.name.trim() || identification.commonName,
      species: identification.scientificName, interval: String(profile.interval), soil: profile.soil,
      waterAmount: String(estimateWaterAmount(Number(previous.pot), identification.scientificName)),
      wateringAdvice: identification.wateringAdvice || '', family: identification.family || '', description: identification.description || '',
      identificationConfidence: String(identification.confidence), identificationSource: 'plant.id',
    }));
    setScanStatus(`Espèce sélectionnée : ${identification.scientificName} · confiance ${Math.round(identification.confidence * 100)} %. Vérifiez la fiche d’entretien.`);
  }
  function manualIdentification() {
    setSuggestions([]);
    setForm(previous => ({ ...previous, species: '', family: '', description: '', wateringAdvice: '', identificationSource: '', identificationConfidence: '' }));
    setScanStatus('Saisissez l’espèce dans le champ ci-dessous. La photo et le surnom sont conservés.');
  }
  function updateForm(key: keyof Form, value: string) {
    setForm(previous => {
      const next = { ...previous, [key]: value };
      if (key === 'species') {
        next.identificationSource = ''; next.identificationConfidence = ''; next.family = ''; next.description = ''; next.wateringAdvice = '';
        const profile = careDefaults(value); next.interval = String(profile.interval); next.soil = profile.soil;
        next.waterAmount = String(estimateWaterAmount(Number(previous.pot), value));
      }
      if (key === 'pot') next.waterAmount = String(estimateWaterAmount(Number(value), previous.species));
      return next;
    });
  }
  async function addPlant() {
    const existing = editingId ? garden.plants.find(p => p.id === editingId) : undefined;
    if (editingId && !existing) { setError("Cette plante n’existe plus."); return; }
    if (!form.name.trim()) { setError('Donnez un nom à votre plante.'); return; }
    if (!Number.isFinite(irrigation.depth) || irrigation.depth <= 0 || irrigation.depth > 100 || Number(form.pot) > 100) { setError('Diamètre et profondeur du pot : entre 1 et 100 cm.'); return; }
    const initialWatered = !editingId && lastWateredInput ? new Date(`${lastWateredInput}T00:00:00`) : null;
    if (initialWatered && (!/^\d{4}-\d{2}-\d{2}$/.test(lastWateredInput) || !Number.isFinite(+initialWatered) || `${initialWatered.getFullYear()}-${String(initialWatered.getMonth() + 1).padStart(2, '0')}-${String(initialWatered.getDate()).padStart(2, '0')}` !== lastWateredInput || +initialWatered > Date.now())) { setError('Dernier arrosage : une date passée valide au format AAAA-MM-JJ.'); return; }
    const interval = Number(form.interval), height = Number(form.height), pot = Number(form.pot), temperature = Number(form.temperature), waterAmount = Number(form.waterAmount);
    if (!Number.isInteger(interval) || interval < 1 || interval > 90 || !Number.isFinite(height) || height <= 0 || !Number.isFinite(pot) || pot <= 0 || !form.temperature.trim() || !Number.isFinite(temperature) || temperature < -10 || temperature > 50 || !Number.isFinite(waterAmount) || waterAmount < 0 || waterAmount > 5000) { setError('Vérifiez les valeurs : fréquence de 1 à 90 jours, dimensions positives, température de −10 à 50 °C et quantité de 0 à 5 000 ml.'); return; }
    const repot = form.repotDate ? new Date(`${form.repotDate}T12:00:00`) : new Date(new Date().setFullYear(new Date().getFullYear() + 1));
    if (form.repotDate && (!/^\d{4}-\d{2}-\d{2}$/.test(form.repotDate) || !Number.isFinite(+repot) || repot.toISOString().slice(0, 10) !== form.repotDate)) { setError('La date doit être valide, au format AAAA-MM-JJ.'); return; }
    const plant: Plant = { ...form, irrigation, id: existing?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: form.name.trim(), species: form.species.trim() || 'Espèce à préciser', room: form.room.trim() || 'Appartement', interval, height, pot, temperature, waterAmount, identificationConfidence: form.identificationConfidence ? Number(form.identificationConfidence) : undefined, lastWatered: existing?.lastWatered ?? initialWatered?.toISOString() ?? null, createdAt: existing?.createdAt ?? new Date().toISOString(), repotDate: repot.toISOString(), history: existing?.history ?? (initialWatered ? [initialWatered.toISOString()] : []) };
    if (await save({ ...garden, plants: existing ? garden.plants.map(p => p.id === existing.id ? plant : p) : [...garden.plants, plant] })) { setModal(false); setEditingId(null); setForm(initialForm); setNotice(existing ? 'Fiche modifiée. Historique des arrosages conservé.' : 'Plante ajoutée. Aucun arrosage n’est enregistré pour le moment.'); }
  }
  const sortedPlants = sortPlantsByUrgency(withWeather(garden.plants));
  const collection = sortByUrgency ? sortedPlants : withWeather(garden.plants);
  const due = sortedPlants.filter(p => daysUntil(dueDate(p)) <= 0);
  const current = withWeather(garden.plants).find(p => p.id === selected);
  const disabled = busy || scanning || !ready || loadFailed;
  function openAdd() { setIrrigation({ ...defaultIrrigation }); setLastWateredInput(''); setSuggestions([]); setEditingId(null); setForm(initialForm); setError(''); setScanStatus(''); setModal(true); }
  function openEdit(plant: Plant) {
    plant = garden.plants.find(p => p.id === plant.id) || plant;
    setIrrigation(plant.irrigation || { ...defaultIrrigation, automatic: false }); setLastWateredInput('');
    setSuggestions([]); setEditingId(plant.id);
    setForm({ name: plant.name, species: plant.species, room: plant.room, photo: plant.photo || '',
      interval: String(plant.interval), height: String(plant.height), pot: String(plant.pot),
      temperature: String(plant.temperature), soil: plant.soil, caretaker: plant.caretaker,
      repotDate: plant.repotDate.slice(0, 10), waterAmount: String(plant.waterAmount ?? estimateWaterAmount(plant.pot, plant.species)),
      wateringAdvice: plant.wateringAdvice || '', identificationConfidence: plant.identificationConfidence == null ? '' : String(plant.identificationConfidence),
      identificationSource: plant.identificationSource || '', family: plant.family || '', description: plant.description || '' });
    setError(''); setScanStatus(''); setSelected(null); setModal(true);
  }
  async function watered(p: Plant) {
    if (await save({ ...garden, plants: garden.plants.map(item => item.id === p.id ? waterPlant(item) : item) })) setNotice(`Arrosage de ${p.name} enregistré.`);
  }

  async function observeMoisture(plant: Plant, moisture: 'dry' | 'moist') {
    const checkedAt = new Date().toISOString();
    if (await save({ ...garden, plants: garden.plants.map(p => p.id === plant.id ? { ...p, irrigation: { ...(p.irrigation || { ...defaultIrrigation, automatic: false }), moisture, checkedAt } } : p) })) {
      setNotice(moisture === 'moist' ? 'Terreau humide : vérification reportée à demain, sans ajouter d’arrosage.' : 'Terreau sec noté. Consultez la dose et vérifiez le drainage.');
    }
  }
  const formTemperature = irrigation.location === 'outdoor' ? outdoorTemperature(weather, garden.city) ?? Number(form.temperature) : Number(form.temperature);
  const preview = wateringPlan({ species: form.species, pot: Number(form.pot), temperature: formTemperature,
    interval: Number(form.interval), waterAmount: Number(form.waterAmount), irrigation,
    lastWatered: editingId ? garden.plants.find(p => p.id === editingId)?.lastWatered ?? null : lastWateredInput && /^\d{4}-\d{2}-\d{2}$/.test(lastWateredInput) ? `${lastWateredInput}T00:00:00` : null,
    createdAt: garden.plants.find(p => p.id === editingId)?.createdAt ?? new Date().toISOString() });
  function careSummary(plant: Plant) {
    const plan = wateringPlan(plant);
    return <View style={styles.task}><Text style={styles.sectionTitle}>Conseil d’arrosage</Text><Text style={styles.body}>Vérifier tous les {plan.interval} jours · prochaine vérification : {dateLabel(plan.nextCheck)}{plan.amount > 0 ? ` · dose indicative : ${plan.amount} ml` : ''}</Text><Text style={styles.body}>{plan.instruction}</Text>{plan.reasons.map(reason => <Text key={reason} style={styles.footnote}>{reason}</Text>)}{plant.irrigation?.checkedAt && <Text style={styles.footnote}>Terreau déclaré {plant.irrigation.moisture === 'moist' ? 'humide' : 'sec'} le {dateLabel(new Date(plant.irrigation.checkedAt))}.</Text>}<Button title="Terreau encore humide · vérifier demain" secondary disabled={disabled} onPress={() => void observeMoisture(plant, 'moist')} /><Button title="Terreau sec" secondary disabled={disabled} onPress={() => void observeMoisture(plant, 'dry')} /></View>;
  }

  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" backgroundColor="#F7F8F2" /><View style={styles.shell}>
    <View style={styles.header}><View><Text style={styles.brand}>folia<Text style={{ color: '#7EA175' }}>.</Text></Text><Text style={styles.subtitle}>UN PEU PLUS PROCHE DU VIVANT</Text></View><View style={styles.badge}><Text style={{ color: '#356148' }}>🌿 Mon espace</Text></View></View>
    <ScrollView contentContainerStyle={styles.content}>
      {!!notice && <Pressable onPress={() => setNotice('')} accessibilityRole="button" accessibilityLabel="Fermer le message"><Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}  ×</Text></Pressable>}
      <View style={styles.section}><Text style={styles.muted}>{account ? `Compte : ${account.user.email}` : 'Collection locale · sans compte'}</Text><Button title={account ? 'Se déconnecter' : 'Connexion / Inscription'} secondary disabled={busy || scanning} onPress={() => void switchAccount()} /></View>
      {(account || loadFailed) && <Button title="Recharger la collection" secondary disabled={busy || scanning || !ready} onPress={() => void loadGarden()} />}
      {!ready ? <Text style={styles.body}>Ouverture de votre jardin…</Text> : <>
      {tab === 'garden' && <>
        <Text style={styles.eyebrow}>VOTRE PETIT COIN DE NATURE</Text><Text style={styles.title}>La vie pousse{ '\n' }chez vous.</Text><Text style={styles.body}>Un carnet pour vos plantes, un rythme à votre mesure.</Text>
        <View style={styles.hero}><Text style={styles.heroIcon}>🌱</Text><View style={{ flex: 1 }}><Text style={styles.heroTitle}>{garden.plants.length ? `${garden.plants.length} plante${garden.plants.length > 1 ? 's' : ''} à vos côtés` : 'Votre jardin commence ici'}</Text><Text style={styles.heroBody}>{due.length ? `${due.length} plante${due.length > 1 ? 's' : ''} à vérifier aujourd’hui` : 'Prenez le temps de les voir grandir.'}</Text></View></View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Mes plantes</Text><Text style={styles.counter}>{garden.plants.length}</Text></View>
        <View style={styles.section}><Text style={styles.body}>Trier par urgence d’arrosage</Text><Switch accessibilityLabel="Trier par urgence d’arrosage" value={sortByUrgency} onValueChange={setSortByUrgency} /></View>
        {garden.plants.length === 0 && <View style={styles.empty}><Text style={styles.emptyIcon}>🪴</Text><Text style={styles.sectionTitle}>Faites entrer la première.</Text><Text style={[styles.body, { textAlign: 'center' }]}>Une photo, un petit nom et votre carnet prend vie.</Text></View>}
        {collection.map(p => <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Ouvrir ${p.name}`} onPress={() => { setSelected(p.id); setConfirmDelete(false); }} style={styles.card}>
          {p.photo ? <Image source={{ uri: p.photo }} style={styles.thumbnail} /> : <View style={[styles.thumbnail, styles.placeholder]}><Text style={{ fontSize: 36 }}>🪴</Text></View>}
          <View style={{ flex: 1 }}><Text style={styles.plantName}>{p.name}</Text><Text style={styles.muted}>{p.species} · {p.room}</Text><Text style={[styles.status, daysUntil(dueDate(p)) <= 0 && { color: '#936329' }]}>{!p.lastWatered ? `Premier arrosage à renseigner · ${dateLabel(dueDate(p))}` : daysUntil(dueDate(p)) <= 0 ? `À vérifier depuis le ${dateLabel(dueDate(p))}` : `À vérifier le ${dateLabel(dueDate(p))}`}</Text></View><Text style={styles.muted}>↗</Text>
        </Pressable>)}
        <Button title="＋ Ajouter une plante" onPress={openAdd} disabled={disabled} />
        <Text style={styles.footnote}>Chaque plante a son rythme. Les rappels invitent à vérifier le terreau avant d’arroser.</Text>
      </>}
      {tab === 'tasks' && <>
        <Text style={styles.eyebrow}>LES PETITES ATTENTIONS</Text><Text style={styles.title}>À faire aujourd’hui</Text><Text style={styles.body}>Sans confirmation, un arrosage reste à faire.</Text>
        {!due.length && <View style={styles.empty}><Text style={styles.emptyIcon}>☀️</Text><Text style={styles.sectionTitle}>Rien à signaler.</Text><Text style={styles.body}>Vos prochaines échéances apparaîtront ici.</Text></View>}
        {due.map(p => <View key={p.id} style={styles.task}><Text style={styles.plantName}>💧 {p.name}</Text><Text style={styles.body}>{p.lastWatered ? `Échéance : ${dateLabel(dueDate(p))}` : 'Aucun arrosage enregistré'}. Vérifiez si le terreau a besoin d’eau.</Text>{!!p.caretaker && <Text style={styles.status}>Référent : {p.caretaker}</Text>}{careSummary(p)}<Button title="J’ai arrosé" disabled={disabled || (!!p.lastWatered && daysUntil(new Date(p.lastWatered)) === 0)} onPress={() => void watered(p)} /></View>)}
        <Text style={styles.sectionTitle}>À venir</Text>{sortedPlants.filter(p => daysUntil(dueDate(p)) > 0).map(p => <View style={styles.card} key={p.id}><Text style={styles.plantName}>{p.name}</Text><Text style={styles.muted}>{dateLabel(dueDate(p))}</Text></View>)}
        <Text style={styles.sectionTitle}>Rempotage à vérifier</Text>{garden.plants.map(p => <View key={p.id} style={styles.card}><Text style={styles.plantName}>{p.name}</Text><Text style={styles.muted}>{dateLabel(new Date(p.repotDate))}</Text></View>)}
      </>}
      {tab === 'settings' && <>
        {account && <View style={styles.task}><Text style={styles.sectionTitle}>Ma collection en ligne</Text><Text style={styles.body}>Les modifications sont sauvegardées sur le serveur Folia. Rechargez pour récupérer celles d’un autre appareil.</Text><Button title="Importer mes plantes locales" secondary disabled={disabled} onPress={() => void importLocalGarden()} /><Text style={styles.footnote}>L’import ajoute les plantes absentes sans remplacer vos fiches ni vos préférences. Les photos sont transférées avec les plantes.</Text></View>}
        <Text style={styles.eyebrow}>À VOTRE RYTHME</Text><Text style={styles.title}>Mon appartement</Text>
        <View style={styles.task}><View style={styles.section}><Text style={styles.sectionTitle}>Rappels à {garden.reminderTime ?? DEFAULT_REMINDER_TIME}</Text><Switch accessibilityLabel="Activer les rappels quotidiens" value={garden.reminders} disabled={disabled || Platform.OS === 'web'} trackColor={{ true: '#356148' }} onValueChange={async value => { try { if (value && !(await requestReminders())) { setNotice('Autorisez les notifications dans les paramètres Android.'); return; } await save({ ...garden, reminders: value }); } catch { setNotice('Impossible d’activer les notifications sur cet appareil.'); } }} /></View><Field label="Heure des rappels (HH:MM)" value={reminderTimeInput} onChange={value => { setReminderTimeInput(value); setReminderError(''); }} placeholder="09:00" /><Button title="Enregistrer l’heure" secondary disabled={disabled} onPress={() => void saveReminderTime()} />{!!reminderError && <Text accessibilityRole="alert" style={styles.error}>{reminderError}</Text>}{!!reminderStatus && <Text accessibilityLiveRegion="polite" style={styles.body}>{reminderStatus}</Text>}<Text style={styles.body}>{Platform.OS === 'web' ? 'Les notifications locales sont disponibles dans l’application Android.' : 'Un rappel quotidien dès l’échéance, jusqu’à confirmation de l’arrosage. Une notification regroupe les plantes du jour. Un arrosage confirmé recalcule la prochaine échéance ; un terreau humide reporte la vérification. Programmation sur 30 jours, renouvelée à chaque ouverture. Heure locale du téléphone ; après un changement de fuseau, rouvrez l’application.'}</Text></View>
        <View style={styles.task}><Text style={styles.sectionTitle}>Météo extérieure</Text><Field label="Rechercher une ville" value={cityQuery} onChange={setCityQuery} placeholder="Paris" /><Button title={searchingCity ? 'Recherche…' : 'Rechercher'} secondary disabled={disabled || searchingCity} onPress={() => void findCities()} />{cities.map(city => <Button key={city.id} secondary title={`${city.name}, ${city.admin1 || ''}, ${city.country || ''}`} disabled={disabled} onPress={async () => { if (await save({ ...garden, city })) { setCities([]); setWeatherStatus('Chargement de la météo…'); } }} />)}{garden.city && <Text style={styles.body}>{garden.city.name} : {outdoorTemperature(weather, garden.city) != null ? `${weather!.temperature} °C · relevé à ${new Date(weather!.fetchedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'température saisie utilisée en attendant la météo'}</Text>}{!!weatherStatus && <Text style={styles.body}>{weatherStatus}</Text>}{garden.city && <Button title="Désactiver la météo" secondary disabled={disabled} onPress={() => void save({ ...garden, city: undefined })} />}<Text style={styles.footnote}>Source : Open-Meteo (open-meteo.com). Actualisation à l’ouverture et chaque heure. Uniquement pour les plantes en extérieur ; en cas d’échec, température saisie. La pluie n’est pas déduite de l’arrosage.</Text></View>
        <View style={styles.task}><Text style={styles.sectionTitle}>Données et photos</Text><Text style={styles.body}>En mode local, le carnet reste sur cet appareil. Avec un compte, les fiches et photos sont sauvegardées sur votre serveur Folia. Lors d’une identification, la photo est envoyée au serveur puis à plant.id. Consultez les conditions et la politique de confidentialité de Kindwise avant un usage public.</Text></View>
        <View style={styles.task}><Text style={styles.sectionTitle}>Première pousse · v1.1</Text><Text style={styles.body}>La reconnaissance remplit l’espèce, un nom courant, un terreau et une fréquence de départ. La fréquence et la dose peuvent être estimées selon le pot, le terreau et l’environnement. Validez toujours l’humidité réelle du terreau.</Text><Text style={styles.body}>Le diagnostic de maladies, le scan de pièce et la mesure automatique des dimensions restent à développer.</Text></View>
      </>}
      </>}
    </ScrollView>
    <View style={styles.nav}>{([{ id: 'garden', icon: '⌂', label: 'Mes plantes' }, { id: 'tasks', icon: '✓', label: 'À faire' }, { id: 'settings', icon: '⚙', label: 'Mon espace' }] as const).map(item => <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: tab === item.id }} onPress={() => setTab(item.id)} style={[styles.navItem, tab === item.id && styles.navActive]}><Text style={styles.navIcon}>{item.icon}</Text><Text style={styles.navLabel}>{item.label}{item.id === 'tasks' && due.length ? ` · ${due.length}` : ''}</Text></Pressable>)}</View>
    <Modal visible={modal} animationType="slide" onRequestClose={() => { if (!scanning && !busy) setModal(false); }}><SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.shell} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Text style={styles.eyebrow}>UNE NOUVELLE RENCONTRE</Text><Text style={styles.title}>{editingId ? 'Modifier la plante' : 'Scanner une plante'}</Text><Text style={styles.body}>Prenez une photo nette de la plante entière ou d’une feuille. plant.id proposera une espèce et préremplira la fiche.</Text>
      {!!form.photo && <Image source={{ uri: form.photo }} style={styles.largePhoto} />}
      <View style={styles.row}><Button title={scanning ? 'Analyse…' : '📷 Scanner'} secondary onPress={() => void choosePhoto(true)} disabled={scanning} /><Button title="Galerie" secondary onPress={() => void choosePhoto(false)} disabled={scanning} /></View>
      {!!suggestions.length && <View style={styles.task}><Text style={styles.sectionTitle}>Quelle plante reconnaissez-vous ?</Text><Text style={styles.body}>Les scores sont ceux de plant.id. Choisissez la proposition qui correspond à votre photo.</Text>{suggestions.map((item, index) => <Button key={`${item.scientificName}-${index}`} secondary={form.species !== item.scientificName || form.identificationSource !== 'plant.id'} title={`${item.commonName} (${item.scientificName}) · ${Math.round(item.confidence * 100)} %`} onPress={() => applyIdentification(item)} disabled={scanning || busy} />)}<Button title="Aucune : saisir l’espèce manuellement" secondary onPress={manualIdentification} disabled={scanning || busy} /></View>}
      {!!form.species && <View style={styles.task}><Text style={styles.sectionTitle}>Fiche d’entretien · {form.species}</Text>{!!form.family && <Text style={styles.body}>Famille : {form.family}</Text>}{!!form.description && <Text style={styles.body}>{form.description}{'\n'}Source : plant.id</Text>}<Text style={styles.body}>Terreau : {form.soil}{'\n'}Vérification tous les {preview.interval} jours{preview.amount > 0 ? ` · environ ${preview.amount} ml si le terreau est sec` : ''}.</Text><Text style={styles.footnote}>Fréquence, terreau et dose : repères indicatifs Folia, modifiables ci-dessous. Vérifiez le terreau avant d’arroser.</Text></View>}
      {!!scanStatus && <Text accessibilityLiveRegion="polite" style={styles.scanStatus}>{scanStatus}</Text>}
      {([{ key: 'name', label: 'Petit nom *', placeholder: 'Monstera du salon' }, { key: 'species', label: 'Espèce', placeholder: 'Monstera deliciosa' }, { key: 'room', label: 'Pièce' }, { key: 'interval', label: 'Fréquence manuelle (jours, utilisée si calcul désactivé)', numeric: true }, { key: 'waterAmount', label: 'Dose manuelle (ml, utilisée si calcul désactivé)', numeric: true }, { key: 'height', label: 'Hauteur de la plante (cm)', numeric: true }, { key: 'pot', label: 'Diamètre du pot (cm)', numeric: true }, { key: 'temperature', label: 'Température de la pièce ou de repli météo (°C)', numeric: true }, { key: 'soil', label: 'Terreau conseillé / notes (rétention réelle choisie ci-dessus)' }, { key: 'repotDate', label: 'Vérifier le rempotage le (AAAA-MM-JJ)', placeholder: 'Par défaut : dans un an' }, { key: 'caretaker', label: 'Personne référente pendant une absence', placeholder: 'Prénom — note personnelle' }] as { key: keyof Form; label: string; placeholder?: string; numeric?: boolean }[]).filter(f => !irrigation.automatic || !['interval', 'waterAmount'].includes(f.key)).map(f => <Field key={f.key} label={f.label} placeholder={f.placeholder} numeric={f.numeric} value={form[f.key]} onChange={value => updateForm(f.key, value)} />)}
      <View style={styles.task}><Text style={styles.sectionTitle}>Adapter l’arrosage</Text><View style={styles.section}><Text style={styles.body}>Calcul automatique</Text><Switch accessibilityLabel="Calcul automatique de l’arrosage" value={irrigation.automatic} onValueChange={automatic => setIrrigation(c => ({ ...c, automatic }))} /></View><Field label="Profondeur utile du pot (cm)" numeric value={Number.isNaN(irrigation.depth) ? '' : String(irrigation.depth)} onChange={value => setIrrigation(c => ({ ...c, depth: value ? Number(value) : NaN }))} />
      {([
        ['material', 'Matériau du pot', [['plastic', 'Plastique / émaillé'], ['terracotta', 'Terre cuite']]],
        ['drainage', 'Trous de drainage', [['yes', 'Oui'], ['no', 'Non'], ['unknown', 'À vérifier']]],
        ['substrate', 'Rétention du terreau réel', [['standard', 'Standard'], ['draining', 'Très drainant'], ['retentive', 'Rétenteur'], ['bark', 'Écorces']]],
        ['location', 'Emplacement', [['indoor', 'Intérieur'], ['outdoor', 'Extérieur']]],
        ['exposure', 'Exposition', [['shade', 'Ombre'], ['indirect', 'Lumière indirecte'], ['sun', 'Soleil']]],
        ['season', 'Cycle actuel de la plante', [['growing', 'Croissance'], ['rest', 'Repos végétatif']]],
      ] as const).map(([key, label, options]) => <View key={key} style={styles.field}><Text style={styles.label}>{label}</Text><View style={[styles.row, { flexWrap: 'wrap' }]}>{options.map(([value, title]) => <Button key={value} title={`${irrigation[key] === value ? '✓ ' : ''}${title}`} secondary={irrigation[key] !== value} onPress={() => setIrrigation(c => ({ ...c, [key]: value }))} />)}</View></View>)}
      {!editingId && <Field label="Dernier arrosage connu (AAAA-MM-JJ, facultatif)" value={lastWateredInput} onChange={setLastWateredInput} />}
      <Text style={styles.body}>{preview.instruction}</Text><Text style={styles.body}>Prochaine vérification : {Number.isFinite(+preview.nextCheck) ? dateLabel(preview.nextCheck) : 'date à corriger'}</Text>{preview.reasons.map(reason => <Text key={reason} style={styles.footnote}>{reason}</Text>)}<Text style={styles.footnote}>Le cycle est choisi selon la plante, sans supposer l’hémisphère. Sans capteur, l’humidité doit être vérifiée sur la fiche. Les dimensions décrivent le pot intérieur, pas le cache-pot.</Text></View>
      {!!form.wateringAdvice && <View style={styles.task}><Text style={styles.sectionTitle}>Conseil fourni par plant.id</Text><Text style={styles.body}>{form.wateringAdvice}</Text></View>}
      <Text style={styles.footnote}>La reconnaissance est une proposition, pas une certitude. Le calcul automatique utilise le pot et son substrat, l’espèce et l’environnement. Les coefficients sont indicatifs : l’humidité réelle prime sur l’échéance. Les dimensions ne peuvent pas être déduites d’une photo sans repère d’échelle.</Text>
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}<Button title={editingId ? "Enregistrer les modifications" : "Ajouter à mon appartement"} onPress={() => void addPlant()} disabled={disabled || scanning} /><Button title="Annuler" secondary disabled={scanning || busy} onPress={() => setModal(false)} />
    </ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>
    <Modal visible={!!current} animationType="slide" onRequestClose={() => setSelected(null)}><SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={[styles.content, { maxWidth: 720, width: '100%', alignSelf: 'center' }]}>{current && <>
      <Button title="← Mes plantes" secondary onPress={() => setSelected(null)} />{!!current.photo && <Image source={{ uri: current.photo }} style={styles.largePhoto} />}<Text style={styles.title}>{current.name}</Text><Text style={styles.body}>{current.species} · {current.room}</Text>
      {!!current.description && <View style={styles.task}><Text style={styles.sectionTitle}>À propos de cette espèce</Text><Text style={styles.body}>{current.description}</Text>{!!current.family && <Text style={styles.body}>Famille : {current.family}</Text>}<Text style={styles.footnote}>Description fournie par plant.id.</Text></View>}
      <View style={styles.task}><Text style={styles.sectionTitle}>Fiche d’entretien</Text><Text style={styles.body}>{current.height} cm de haut · pot de {current.pot} cm{ '\n' }{current.soil} · {current.temperature} °C{ '\n' }Vérification tous les {wateringPlan(current).interval} jours{ '\n' }Rempotage à vérifier : {dateLabel(new Date(current.repotDate))}</Text>{!!current.wateringAdvice && <Text style={styles.body}>Conseil plant.id : {current.wateringAdvice}</Text>}{current.identificationSource === 'plant.id' && current.identificationConfidence != null && <Text style={styles.status}>Identification plant.id · confiance {Math.round(current.identificationConfidence * 100)} %</Text>}{!!current.caretaker && <Text style={styles.body}>Référent (note) : {current.caretaker}</Text>}</View>
      {careSummary(current)}
      <Button title="Modifier la fiche" secondary onPress={() => openEdit(current)} disabled={disabled} />
      <Text style={styles.body}>Prochaine vérification : {dateLabel(dueDate(current))}{daysUntil(dueDate(current)) <= 0 ? " · à faire" : ""}</Text>
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
