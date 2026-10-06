import { AccessibilityProvider, useAccessibility } from './src/AccessibilityProvider';
import { PreferencesScreen } from './src/PreferencesScreen';
import { gardenWithHome } from './src/homeGarden';
import { HomeScreen, PlacementPicker, ExposureDetails } from './src/HomeScreen';
import { estimatePlacement, validPosition, type PlantPosition } from './src/home';
import { CaretakerScreen } from './src/CaretakerScreen';
import { usePage } from './src/usePage';
import type { Page } from './src/navigation';
import { PlantVisual } from './src/PlantVisual';
import { botanicalLabel, preferredPhotoMode, type BotanicalImage, type PhotoMode, type PhotoFit } from './src/botanical';
import { palette, fonts, useReadableStyles, useThemePalette, botanicalPhoto } from './src/theme';
import { DimensionMeasure } from './src/DimensionMeasure';
import { type Measurement } from './src/measurement';
import { wateringTolerance } from './src/tolerance';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, Image, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View } from 'react-native';
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
const initialForm = { name: '', species: '', room: 'Salon', interval: '7', height: '30', width: '', pot: '14', temperature: '20', soil: 'Terreau universel', caretaker: '', photo: '', photoMode: 'botanical' as PhotoMode, photoFit: 'contain' as PhotoFit, botanicalImage: undefined as BotanicalImage | undefined, repotDate: '', waterAmount: '175', wateringAdvice: '', identificationConfidence: '', identificationSource: '', family: '', description: '' };
type Form = typeof initialForm;
type FormField = Exclude<keyof Form, 'botanicalImage'>;

function PagePanel({ visible, children, onRequestClose, animationType }: React.ComponentProps<typeof Modal>) {
  const { settings } = useAccessibility();
  if (Platform.OS !== 'web') return <Modal visible={visible} onRequestClose={onRequestClose} animationType={settings.reduceMotion ? 'none' : animationType}>{children}</Modal>;
  return visible ? <View style={{ flex: 1 }}>{children}</View> : null;
}

function Button({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  const palette = useThemePalette();
  const styles = useReadableStyles(baseStyles);
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, (pressed || disabled) && { opacity: .5 }]}><Text style={[styles.buttonText, secondary && { color: palette.olive }]}>{title}</Text></Pressable>;
}
function Field({ label, value, onChange, numeric = false, placeholder = '' }: { label: string; value: string; onChange: (v: string) => void; numeric?: boolean; placeholder?: string }) {
  const palette = useThemePalette();
  const styles = useReadableStyles(baseStyles);
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} keyboardType={numeric ? 'numeric' : 'default'} placeholder={placeholder} placeholderTextColor={palette.muted} style={styles.input} maxLength={numeric ? 7 : 100} /></View>;
}

export default function App() {
  return <AccessibilityProvider><AppContent /></AccessibilityProvider>;
}

function AppContent() {
  const [account, setAccount] = useState<AccountSession | null>(null);
  const { page, navigate } = usePage();
  if (page === 'account') return <AccountScreen onPreferences={() => navigate('preferences')} onConnected={session => { setAccount(session); navigate('garden'); }} onCancel={() => navigate('garden')} />;
  return <GardenApp page={page} navigate={navigate} key={account?.user.id || 'local'} account={account} onOpenAuth={() => navigate('account')} onDisconnected={() => { setAccount(null); navigate('garden'); }} />;
}

function GardenApp({ page, navigate, account, onOpenAuth, onDisconnected }: { page: Page; navigate: (page: Page) => void; account: AccountSession | null; onOpenAuth: () => void; onDisconnected: () => void }) {
  const palette = useThemePalette();
  const styles = useReadableStyles(baseStyles);
  const { width } = useWindowDimensions();
  const { settings: appearance } = useAccessibility();
  const wide = Platform.OS === 'web' && width >= 860;
  const columns = appearance.textScale >= 1.75 ? 1 : appearance.textScale >= 1.3 ? 2 : 3;
  const [collectionWidth, setCollectionWidth] = useState(0);
  const cardColumns = Math.min(columns, Math.max(1, Math.floor((collectionWidth + 20) / 300)));
  const contentLimit = page === 'home' ? 1440 : page === 'garden' ? 1280 : page === 'settings' ? 1080 : page === 'caretaker' ? 820 : 980;
  const twoSettingsColumns = wide && width >= 1000 && appearance.textScale < 1.5;
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
  const [measuring, setMeasuring] = useState(false);
  const [measurement, setMeasurement] = useState<Measurement | undefined>();
  const [suggestions, setSuggestions] = useState<PlantIdentification[]>([]);
  const [scanStatus, setScanStatus] = useState('');
  const lock = useRef(false);
  const tab = page;
  const setTab = navigate;
  const missingPlant = ready && (page.startsWith('edit/') || page.startsWith('plant/')) && !garden.plants.some(p => p.id === page.slice(page.indexOf('/') + 1));
  const modal = ready && !loadFailed && !missingPlant && (page === 'new' || page.startsWith('edit/'));
  const setModal = (visible: boolean) => navigate(visible ? 'new' : 'garden');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortByUrgency, setSortByUrgency] = useState(true);
  const [position, setPosition] = useState<PlantPosition | undefined>();
  const [form, setForm] = useState<Form>(initialForm);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selected = page.startsWith('plant/') ? page.slice(6) : null;
  const setSelected = (id: string | null) => navigate(id ? `plant/${id}` : 'garden');
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
  useEffect(() => onReminderOpened(() => navigate('tasks')), [navigate]);
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
    if (lock.current || scanning || measuring || leaving.current) return;
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
      if (!count && merged.home === garden.home) { setNotice('Aucune nouvelle plante ni plan local à importer.'); return; }
      if (await save(merged)) setNotice(`${count} plantes importées. ${garden.home && local.home && JSON.stringify(garden.home) !== JSON.stringify(local.home) ? 'Le plan du compte est conservé : replacez les plantes importées sur ce plan. ' : !garden.home && local.home ? 'Le plan local a aussi été importé. ' : ''}La copie locale reste conservée.`);
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
        setSuggestions([]); setMeasurement(undefined);
        setForm(f => ({ ...f, photo: uri, photoMode: 'personal', botanicalImage: undefined, species: '', identificationSource: '', identificationConfidence: '', wateringAdvice: '', family: '', description: '' })); setError(''); setScanning(true); setScanStatus('Analyse de la photo par plant.id…');
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
      species: identification.scientificName, botanicalImage: identification.botanicalImage, photoMode: 'botanical', interval: String(profile.interval), soil: profile.soil,
      waterAmount: String(estimateWaterAmount(Number(previous.pot), identification.scientificName)),
      wateringAdvice: identification.wateringAdvice || '', family: identification.family || '', description: identification.description || '',
      identificationConfidence: String(identification.confidence), identificationSource: 'plant.id',
    }));
    setScanStatus(`Espèce sélectionnée : ${identification.scientificName} · confiance ${Math.round(identification.confidence * 100)} %. Visuel botanique sélectionné automatiquement. Vérifiez la fiche d’entretien.`);
  }
  function manualIdentification() {
    setSuggestions([]);
    setForm(previous => ({ ...previous, species: '', botanicalImage: undefined, photoMode: 'personal', family: '', description: '', wateringAdvice: '', identificationSource: '', identificationConfidence: '' }));
    setScanStatus('Saisissez l’espèce dans le champ ci-dessous. La photo et le surnom sont conservés.');
  }
  function updateForm(key: FormField, value: string) {
    if (['height', 'width', 'pot'].includes(key)) setMeasurement(undefined);
    setForm(previous => {
      const next = { ...previous, [key]: value };
      if (key === 'species') {
        next.botanicalImage = undefined; next.identificationSource = ''; next.identificationConfidence = ''; next.family = ''; next.description = ''; next.wateringAdvice = '';
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
    if (position && !validPosition(position, garden.home)) { setError('L’emplacement choisi n’est plus valide. Replacez la plante sur le plan.'); return; }
    if (!form.name.trim()) { setError('Donnez un nom à votre plante.'); return; }
    if (!Number.isFinite(irrigation.depth) || irrigation.depth <= 0 || irrigation.depth > 100 || Number(form.pot) > 100) { setError('Diamètre et profondeur du pot : entre 1 et 100 cm.'); return; }
    const initialWatered = !editingId && lastWateredInput ? new Date(`${lastWateredInput}T00:00:00`) : null;
    if (initialWatered && (!/^\d{4}-\d{2}-\d{2}$/.test(lastWateredInput) || !Number.isFinite(+initialWatered) || `${initialWatered.getFullYear()}-${String(initialWatered.getMonth() + 1).padStart(2, '0')}-${String(initialWatered.getDate()).padStart(2, '0')}` !== lastWateredInput || +initialWatered > Date.now())) { setError('Dernier arrosage : une date passée valide au format AAAA-MM-JJ.'); return; }
    const interval = Number(form.interval), height = Number(form.height), pot = Number(form.pot), temperature = Number(form.temperature), waterAmount = Number(form.waterAmount);
    if (!Number.isInteger(interval) || interval < 1 || interval > 90 || !Number.isFinite(height) || height <= 0 || !Number.isFinite(pot) || pot <= 0 || !form.temperature.trim() || !Number.isFinite(temperature) || temperature < -10 || temperature > 50 || !Number.isFinite(waterAmount) || waterAmount < 0 || waterAmount > 5000) { setError('Vérifiez les valeurs : fréquence de 1 à 90 jours, dimensions positives, température de −10 à 50 °C et quantité de 0 à 5 000 ml.'); return; }
    if (form.width.trim() && (!Number.isFinite(Number(form.width)) || Number(form.width) < 1 || Number(form.width) > 1000)) { setError('Largeur de la plante : entre 1 et 1 000 cm.'); return; }
    const repot = form.repotDate ? new Date(`${form.repotDate}T12:00:00`) : new Date(new Date().setFullYear(new Date().getFullYear() + 1));
    if (form.repotDate && (!/^\d{4}-\d{2}-\d{2}$/.test(form.repotDate) || !Number.isFinite(+repot) || repot.toISOString().slice(0, 10) !== form.repotDate)) { setError('La date doit être valide, au format AAAA-MM-JJ.'); return; }
    const plant: Plant = { ...form, position, width: form.width.trim() ? Number(form.width) : undefined, measurement, irrigation, id: existing?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: form.name.trim(), species: form.species.trim() || 'Espèce à préciser', room: form.room.trim() || 'Appartement', interval, height, pot, temperature, waterAmount, identificationConfidence: form.identificationConfidence ? Number(form.identificationConfidence) : undefined, lastWatered: existing?.lastWatered ?? initialWatered?.toISOString() ?? null, createdAt: existing?.createdAt ?? new Date().toISOString(), repotDate: repot.toISOString(), history: existing?.history ?? (initialWatered ? [initialWatered.toISOString()] : []) };
    if (await save({ ...garden, plants: existing ? garden.plants.map(p => p.id === existing.id ? plant : p) : [...garden.plants, plant] })) { setModal(false); setEditingId(null); setForm(initialForm); setNotice(existing ? 'Fiche modifiée. Historique des arrosages conservé.' : 'Plante ajoutée. Aucun arrosage n’est enregistré pour le moment.'); }
  }
  const sortedPlants = sortPlantsByUrgency(withWeather(garden.plants));
  const collection = sortByUrgency ? sortedPlants : withWeather(garden.plants);
  const due = sortedPlants.filter(p => daysUntil(dueDate(p)) <= 0);
  const current = withWeather(garden.plants).find(p => p.id === selected);
  const disabled = busy || scanning || measuring || !ready || loadFailed;
  function openAdd(enter = true) { setPosition(undefined); setMeasurement(undefined); setIrrigation({ ...defaultIrrigation }); setLastWateredInput(''); setSuggestions([]); setEditingId(null); setForm(initialForm); setError(''); setScanStatus(''); if (enter) navigate('new'); }
  function openEdit(plant: Plant, enter = true) {
    plant = garden.plants.find(p => p.id === plant.id) || plant;
    setPosition(plant.position);
    setIrrigation(plant.irrigation || { ...defaultIrrigation, automatic: false }); setLastWateredInput('');
    setSuggestions([]); setEditingId(plant.id); setMeasurement(plant.measurement);
    setForm({ name: plant.name, species: plant.species, room: plant.room, photo: plant.photo || '', photoMode: preferredPhotoMode(plant), photoFit: plant.photoFit ?? 'contain', botanicalImage: plant.botanicalImage,
      interval: String(plant.interval), height: String(plant.height), width: plant.width == null ? '' : String(plant.width), pot: String(plant.pot),
      temperature: String(plant.temperature), soil: plant.soil, caretaker: plant.caretaker,
      repotDate: plant.repotDate.slice(0, 10), waterAmount: String(plant.waterAmount ?? estimateWaterAmount(plant.pot, plant.species)),
      wateringAdvice: plant.wateringAdvice || '', identificationConfidence: plant.identificationConfidence == null ? '' : String(plant.identificationConfidence),
      identificationSource: plant.identificationSource || '', family: plant.family || '', description: plant.description || '' });
    setError(''); setScanStatus(''); if (enter) navigate(`edit/${plant.id}`);
  }
  useEffect(() => {
    if (!ready) return;
    setConfirmDelete(false);
    if (page === 'new') openAdd(false);
    if (page.startsWith('edit/')) {
      const plant = garden.plants.find(p => p.id === page.slice(5));
      if (plant) openEdit(plant, false);
    }
  }, [page, ready]);
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
  function toleranceSummary(plant: Parameters<typeof wateringTolerance>[0]) {
    const tolerance = wateringTolerance(plant);
    return <View style={{ gap: 6 }}><Text style={styles.label}>Marge de retard indicative</Text><Text style={[styles.body, ['exceeded', 'check_now'].includes(tolerance.status) && { color: '#A33827' }]}>{tolerance.message}</Text>{tolerance.deadline && <Text style={styles.body}>Limite indicative : {tolerance.deadline.toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}{tolerance.hours ? ` · marge de ${tolerance.hours} h` : ''}.</Text>}<Text style={styles.footnote}>Marge indicative : vérifiez le terreau. Ne compensez pas un retard par une dose plus forte.</Text></View>;
  }
  function careSummary(plant: Plant) {
    const plan = wateringPlan(plant);
    return <View style={styles.task}><Text style={styles.sectionTitle}>Conseil d’arrosage</Text><Text style={styles.body}>Vérifier tous les {plan.interval} jours · prochaine vérification : {dateLabel(plan.nextCheck)}{plan.amount > 0 ? ` · dose indicative : ${plan.amount} ml` : ''}</Text><Text style={styles.body}>{plan.instruction}</Text>{toleranceSummary(plant)}{plan.reasons.map(reason => <Text key={reason} style={styles.footnote}>{reason}</Text>)}{plant.irrigation?.checkedAt && <Text style={styles.footnote}>Terreau déclaré {plant.irrigation.moisture === 'moist' ? 'humide' : 'sec'} le {dateLabel(new Date(plant.irrigation.checkedAt))}.</Text>}<Button title="Terreau encore humide · vérifier demain" secondary disabled={disabled} onPress={() => void observeMoisture(plant, 'moist')} /><Button title="Terreau sec" secondary disabled={disabled} onPress={() => void observeMoisture(plant, 'dry')} /></View>;
  }

  const navigation = <View style={[styles.nav, wide && styles.desktopNav]}>{([{ id: 'garden', label: 'Mes plantes' }, { id: 'tasks', label: 'À faire' }, { id: 'settings', label: 'Mon espace' }, { id: 'caretaker', label: 'Personne de confiance' }, { id: 'home', label: 'Ma maison' }, { id: 'preferences', label: 'Paramètres' }] as const).map(item => <Pressable key={item.id} accessibilityRole="tab" aria-selected={tab === item.id} accessibilityState={{ selected: tab === item.id }} onPress={() => setTab(item.id)} style={[styles.navItem, wide && styles.desktopNavItem, tab === item.id && styles.navActive]}><Text style={[styles.navLabel, tab === item.id && { color: palette.ink }]}>{item.label}{item.id === 'tasks' && due.length ? ` · ${due.length}` : ''}</Text></Pressable>)}</View>;
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" backgroundColor={palette.paper} /><View style={styles.shell}>
    <View style={[styles.header, !wide && { paddingHorizontal: 22 }]}><Pressable accessibilityRole="link" accessibilityLabel="Phytolie — Retour à l’accueil" onPress={() => navigate('garden')}><Text style={styles.brand}>Phytolie<Text style={{ color: palette.terracotta }}>.</Text></Text><Text style={styles.subtitle}>LE CARNET DU VIVANT</Text></Pressable>{wide && navigation}</View>
    {!!notice && <Pressable onPress={() => setNotice('')} accessibilityRole="button" accessibilityLabel="Fermer le message" style={{ paddingHorizontal: wide ? 40 : 22, paddingTop: 12 }}><Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}  ×</Text></Pressable>}
    <ScrollView key={page} contentContainerStyle={[styles.content, { maxWidth: contentLimit }, !wide && { padding: 22 }]} style={Platform.OS === 'web' && (modal || current) ? { display: 'none' } : undefined}>
      <View style={styles.accountBar}><Text style={[styles.muted, { flex: 1 }]}>{account ? account.user.email : ''}</Text><Pressable accessibilityRole="button" disabled={busy || scanning || measuring} onPress={() => void switchAccount()} style={styles.accountLink}><Text style={styles.accountLinkText}>{account ? 'Se déconnecter ↗' : 'Connexion / Inscription ↗'}</Text></Pressable></View>
      {(account || loadFailed) && <Button title="Recharger la collection" secondary disabled={busy || scanning || measuring || !ready} onPress={() => void loadGarden()} />}
      {missingPlant && <Text accessibilityRole="alert" style={styles.body}>Cette plante n’existe plus dans votre collection.</Text>}
      {!ready ? <Text style={styles.body}>Ouverture de votre jardin…</Text> : <>
      {tab === 'garden' && <>
        <View style={[styles.intro, wide && appearance.textScale < 1.75 && styles.introWide]}>
          <View style={[styles.introCopy, wide && appearance.textScale < 1.75 && { flex: 1, paddingRight: 40 }]}>
            <Text accessibilityRole="header" style={[styles.title, wide && styles.desktopTitle]}>Mes plantes</Text>
            <View style={{ alignSelf: 'flex-start' }}><Button title="Ajouter une plante  ↗" onPress={openAdd} disabled={disabled} /></View>
          </View>
          <View style={[styles.botanicalFrame, wide && appearance.textScale < 1.75 && { flex: 1 }]}>
            <Image source={botanicalPhoto} accessibilityLabel="Monstera en pot sur fond ivoire" resizeMode="contain" style={[styles.botanicalImage, wide && { height: 340 }]} />
          </View>
        </View>
        <View style={styles.hero}><View style={{ flex: 1 }}><Text style={styles.heroTitle}>{garden.plants.length ? `${garden.plants.length} plante${garden.plants.length > 1 ? 's' : ''} à vos côtés` : 'Aucune plante pour le moment'}</Text><Text style={styles.heroBody}>{due.length ? `${due.length} plante${due.length > 1 ? 's' : ''} à vérifier aujourd’hui` : 'Aucune vérification aujourd’hui'}</Text></View><Text style={styles.heroIndex}>{String(garden.plants.length).padStart(2, '0')}</Text></View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Mon herbier</Text><Text style={styles.counter}>{garden.plants.length}</Text></View>
        <View style={styles.section}><Text style={styles.body}>Trier par urgence d’arrosage</Text><Switch trackColor={{ false: palette.line, true: palette.olive }} accessibilityLabel="Trier par urgence d’arrosage" value={sortByUrgency} onValueChange={setSortByUrgency} /></View>
        {garden.plants.length === 0 && <View style={styles.empty}><Text style={styles.sectionTitle}>Ajoutez votre première plante</Text></View>}
        <View style={styles.plantGrid} onLayout={event => setCollectionWidth(event.nativeEvent.layout.width)}>{collection.map(p => <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Ouvrir ${p.name}`} onPress={() => { setSelected(p.id); setConfirmDelete(false); }} style={[styles.plantCard, wide && { width: cardColumns === 1 ? '100%' : (collectionWidth - 20 * (cardColumns - 1)) / cardColumns }]}>
          <PlantVisual plant={p} />
          <View style={styles.plantInfo}><Text style={styles.plantName}>{p.name}</Text><Text style={styles.muted}>{p.species} · {p.room}</Text><Text style={[styles.status, daysUntil(dueDate(p)) <= 0 && { color: '#936329' }]}>{!p.lastWatered ? `Premier arrosage à renseigner · ${dateLabel(dueDate(p))}` : daysUntil(dueDate(p)) <= 0 ? `À vérifier depuis le ${dateLabel(dueDate(p))}` : `À vérifier le ${dateLabel(dueDate(p))}`}</Text>{preferredPhotoMode(p) === 'botanical' && <Text style={styles.captionText}>{botanicalLabel(p)}</Text>}<Text style={styles.openPlant}>Voir la fiche  ↗</Text></View>
        </Pressable>)}</View>
        {!!garden.plants.length && <Button title="＋ Ajouter une plante" secondary onPress={openAdd} disabled={disabled} />}
      </>}
      {tab === 'tasks' && <>
        <Text style={styles.title}>À faire aujourd’hui</Text>
        {!due.length && <View style={styles.empty}><Text style={styles.emptyIcon}>☀️</Text><Text style={styles.sectionTitle}>Rien à signaler.</Text><Text style={styles.body}>Vos prochaines échéances apparaîtront ici.</Text></View>}
        {due.map(p => <View key={p.id} style={styles.task}><Text style={styles.plantName}>💧 {p.name}</Text><Text style={styles.body}>{p.lastWatered ? `Échéance : ${dateLabel(dueDate(p))}` : 'Aucun arrosage enregistré'}. Vérifiez si le terreau a besoin d’eau.</Text>{!!p.caretaker && <Text style={styles.status}>Référent : {p.caretaker}</Text>}{careSummary(p)}<Button title="J’ai arrosé" disabled={disabled || (!!p.lastWatered && daysUntil(new Date(p.lastWatered)) === 0)} onPress={() => void watered(p)} /></View>)}
        <Text style={styles.sectionTitle}>À venir</Text>{sortedPlants.filter(p => daysUntil(dueDate(p)) > 0).map(p => <View style={styles.card} key={p.id}><Text style={styles.plantName}>{p.name}</Text><Text style={styles.muted}>{dateLabel(dueDate(p))}</Text></View>)}
        <Text style={styles.sectionTitle}>Rempotage à vérifier</Text>{garden.plants.map(p => <View key={p.id} style={styles.card}><Text style={styles.plantName}>{p.name}</Text><Text style={styles.muted}>{dateLabel(new Date(p.repotDate))}</Text></View>)}
      </>}
      {tab === 'home' && <HomeScreen home={garden.home} plants={garden.plants} latitude={garden.city?.latitude} disabled={disabled} onSave={(home, positions, plants) => save(gardenWithHome({ ...garden, plants }, home, positions))} />}
      {tab === 'caretaker' && <CaretakerScreen contact={garden.caretaker} disabled={disabled} onSave={caretaker => save({ ...garden, caretaker })} />}
      {tab === 'preferences' && <PreferencesScreen />}
      {tab === 'settings' && <>
        <Text accessibilityRole="header" style={styles.title}>Mon espace</Text>
        <View style={styles.row}><Button title="Ma maison ↗" secondary onPress={() => navigate('home')} /><Button title="Personne de confiance ↗" secondary onPress={() => navigate('caretaker')} /></View>
        {account && <View style={styles.task}><Text style={styles.sectionTitle}>Ma collection en ligne</Text><Text style={styles.body}>Collection sauvegardée sur le serveur. Rechargez pour retrouver les changements d’un autre appareil.</Text><Button title="Importer mes plantes locales" secondary disabled={disabled} onPress={() => void importLocalGarden()} /><Text style={styles.footnote}>Import des plantes absentes et de leurs photos. Si les plans diffèrent, replacez les plantes importées.</Text></View>}
        <View style={[styles.settingsGrid, { flexDirection: twoSettingsColumns ? 'row' : 'column' }]} >
        <View style={[styles.task, twoSettingsColumns && styles.settingsPanel]}><View style={styles.section}><Text style={styles.sectionTitle}>Rappels à {garden.reminderTime ?? DEFAULT_REMINDER_TIME}</Text><Switch accessibilityLabel="Activer les rappels quotidiens" value={garden.reminders} disabled={disabled || Platform.OS === 'web'} trackColor={{ true: '#356148' }} onValueChange={async value => { try { if (value && !(await requestReminders())) { setNotice('Autorisez les notifications dans les paramètres Android.'); return; } await save({ ...garden, reminders: value }); } catch { setNotice('Impossible d’activer les notifications sur cet appareil.'); } }} /></View><Field label="Heure des rappels (HH:MM)" value={reminderTimeInput} onChange={value => { setReminderTimeInput(value); setReminderError(''); }} placeholder="09:00" /><Button title="Enregistrer l’heure" secondary disabled={disabled} onPress={() => void saveReminderTime()} />{!!reminderError && <Text accessibilityRole="alert" style={styles.error}>{reminderError}</Text>}{!!reminderStatus && <Text accessibilityLiveRegion="polite" style={styles.body}>{reminderStatus}</Text>}<Text style={styles.body}>{Platform.OS === 'web' ? 'Les notifications locales sont disponibles dans l’application Android.' : 'Rappel quotidien à l’échéance, jusqu’à confirmation. Programmation sur 30 jours renouvelée à l’ouverture. Après un changement de fuseau horaire, rouvrez l’application.'}</Text></View>
        <View style={[styles.task, twoSettingsColumns && styles.settingsPanel]}><Text style={styles.sectionTitle}>Météo extérieure</Text><Field label="Rechercher une ville" value={cityQuery} onChange={setCityQuery} placeholder="Paris" /><Button title={searchingCity ? 'Recherche…' : 'Rechercher'} secondary disabled={disabled || searchingCity} onPress={() => void findCities()} />{cities.map(city => <Button key={city.id} secondary title={`${city.name}, ${city.admin1 || ''}, ${city.country || ''}`} disabled={disabled} onPress={async () => { if (await save({ ...garden, city })) { setCities([]); setWeatherStatus('Chargement de la météo…'); } }} />)}{garden.city && <Text style={styles.body}>{garden.city.name} : {outdoorTemperature(weather, garden.city) != null ? `${weather!.temperature} °C · relevé à ${new Date(weather!.fetchedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'température saisie utilisée en attendant la météo'}</Text>}{!!weatherStatus && <Text style={styles.body}>{weatherStatus}</Text>}{garden.city && <Button title="Désactiver la météo" secondary disabled={disabled} onPress={() => void save({ ...garden, city: undefined })} />}<Text style={styles.footnote}>Météo Open-Meteo, actualisée chaque heure pour les plantes dehors. En cas d’échec, température saisie utilisée. La pluie n’est pas déduite de l’arrosage.</Text></View>
        </View>
        <View style={styles.task}><Text style={styles.sectionTitle}>Données et photos</Text><Text style={styles.body}>Sans compte, vos données restent sur cet appareil. Avec un compte, fiches et photos sont sauvegardées sur le serveur Phytolie. Identification : photo transmise à plant.id via le serveur. Mesure IA : photo transmise à OpenAI. Les mesures manuelles restent locales.</Text></View>

      </>}
      </>}
    </ScrollView>
    {!wide && <ScrollView horizontal style={{ flexGrow: 0, flexShrink: 0, height: Math.ceil(62 * appearance.textScale) }} contentContainerStyle={{ flexGrow: 1 }}>{navigation}</ScrollView>}
    <PagePanel visible={modal} animationType="slide" onRequestClose={() => { if (!scanning && !busy && !measuring) setModal(false); }}><SafeAreaView style={styles.safe}><KeyboardAvoidingView style={[styles.shell, { maxWidth: 720 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">{Platform.OS !== 'web' && <View style={styles.panelClose}><Button title="Fermer" secondary disabled={scanning || busy || measuring} onPress={() => setModal(false)} /></View>}<Text style={styles.title}>{editingId ? 'Modifier la plante' : 'Scanner une plante'}</Text><Text style={styles.body}>Une photo nette permet d’identifier l’espèce et de préremplir la fiche.</Text>
      <View style={styles.task}>
        <Text style={styles.sectionTitle}>Le visuel de votre plante</Text>
        <View style={styles.row}>
          <Button title="Visuel botanique" secondary={form.photoMode !== 'botanical'} disabled={busy || scanning || measuring} onPress={() => setForm(f => ({ ...f, photoMode: 'botanical' }))} />
          <Button title="Ma photo" secondary={form.photoMode !== 'personal'} disabled={!form.photo || busy || scanning || measuring} onPress={() => setForm(f => ({ ...f, photoMode: 'personal' }))} />
        </View>
        <PlantVisual plant={form} />
        <Text style={styles.footnote}>{form.photoMode === 'botanical' ? `${botanicalLabel(form)}. Votre photo personnelle reste conservée.` : 'Votre photo, avec le cadrage choisi pour le carnet et la fiche.'}</Text>
        {form.photoMode === 'personal' && <View style={styles.row}>
          <Button title="Photo entière" secondary={form.photoFit !== 'contain'} onPress={() => setForm(f => ({ ...f, photoFit: 'contain' }))} />
          <Button title="Remplir le cadre" secondary={form.photoFit !== 'cover'} onPress={() => setForm(f => ({ ...f, photoFit: 'cover' }))} />
        </View>}
      </View>
      <View style={styles.row}><Button title={scanning ? 'Analyse…' : '📷 Scanner'} secondary onPress={() => void choosePhoto(true)} disabled={scanning || measuring || busy} /><Button title="Galerie" secondary onPress={() => void choosePhoto(false)} disabled={scanning || measuring || busy} /></View>
      {!!form.photo && <DimensionMeasure key={form.photo} photo={form.photo} disabled={busy || scanning} onBusy={setMeasuring} onApply={value => { setMeasurement(value); setForm(previous => ({ ...previous, height: String(value.height), width: String(value.width), pot: String(value.pot), waterAmount: String(estimateWaterAmount(value.pot, previous.species)) })); }} />}
      {measurement && <Text style={styles.footnote}>Dimensions estimées sur photo ({measurement.method === 'vision' ? 'points détectés par IA' : 'points placés manuellement'}) le {dateLabel(new Date(measurement.measuredAt))}. Vérifiez les valeurs avant d’enregistrer.</Text>}
      {!!suggestions.length && <View style={styles.task}><Text style={styles.sectionTitle}>Quelle plante reconnaissez-vous ?</Text><Text style={styles.body}>Choisissez l’espèce proposée par plant.id.</Text>{suggestions.map((item, index) => <Button key={`${item.scientificName}-${index}`} secondary={form.species !== item.scientificName || form.identificationSource !== 'plant.id'} title={`${item.commonName} (${item.scientificName}) · ${Math.round(item.confidence * 100)} %`} onPress={() => applyIdentification(item)} disabled={scanning || measuring || busy} />)}<Button title="Aucune : saisir l’espèce manuellement" secondary onPress={manualIdentification} disabled={scanning || measuring || busy} /></View>}
      {!!form.species && <View style={styles.task}><Text style={styles.sectionTitle}>Fiche d’entretien · {form.species}</Text>{!!form.family && <Text style={styles.body}>Famille : {form.family}</Text>}{!!form.description && <Text style={styles.body}>{form.description}{'\n'}Source : plant.id</Text>}<Text style={styles.body}>Terreau : {form.soil}{'\n'}Vérification tous les {preview.interval} jours{preview.amount > 0 ? ` · environ ${preview.amount} ml si le terreau est sec` : ''}.</Text><Text style={styles.footnote}>Repères indicatifs, modifiables ci-dessous. Vérifiez le terreau.</Text></View>}
      {!!scanStatus && <Text accessibilityLiveRegion="polite" style={styles.scanStatus}>{scanStatus}</Text>}
      {garden.home ? <PlacementPicker home={garden.home} species={form.species} position={position} disabled={disabled} onChange={next => {
        setPosition(next);
        if (!next) return;
        const area = garden.home!.areas.find(a => a.id === next.areaId);
        const estimate = estimatePlacement(garden.home!, next, form.species);
        if (area) { setForm(f => ({ ...f, room: area.name })); setIrrigation(c => ({ ...c, location: area.kind === 'garden' ? 'outdoor' : 'indoor', exposure: estimate?.hours != null ? estimate.exposure : c.exposure })); }
      }} /> : <Text style={styles.footnote}>Créez votre plan dans « Ma maison » pour placer cette plante et estimer sa lumière.</Text>}
      {([{ key: 'name', label: 'Petit nom *', placeholder: 'Monstera du salon' }, { key: 'species', label: 'Espèce', placeholder: 'Monstera deliciosa' }, { key: 'room', label: 'Pièce' }, { key: 'interval', label: 'Fréquence manuelle (jours, utilisée si calcul désactivé)', numeric: true }, { key: 'waterAmount', label: 'Dose manuelle (ml, utilisée si calcul désactivé)', numeric: true }, { key: 'height', label: 'Hauteur de la plante (cm)', numeric: true }, { key: 'width', label: 'Largeur de la plante (cm, facultatif)', numeric: true }, { key: 'pot', label: 'Diamètre du pot (cm)', numeric: true }, { key: 'temperature', label: 'Température de la pièce ou de repli météo (°C)', numeric: true }, { key: 'soil', label: 'Terreau conseillé / notes (rétention réelle choisie ci-dessus)' }, { key: 'repotDate', label: 'Vérifier le rempotage le (AAAA-MM-JJ)', placeholder: 'Par défaut : dans un an' }, { key: 'caretaker', label: 'Personne référente pendant une absence', placeholder: 'Prénom — note personnelle' }] as { key: FormField; label: string; placeholder?: string; numeric?: boolean }[]).filter(f => !irrigation.automatic || !['interval', 'waterAmount'].includes(f.key)).map(f => <Field key={f.key} label={f.label} placeholder={f.placeholder} numeric={f.numeric} value={form[f.key]} onChange={value => updateForm(f.key, value)} />)}
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
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}<Button title={editingId ? "Enregistrer les modifications" : "Ajouter à mon appartement"} onPress={() => void addPlant()} disabled={disabled || scanning} /><Button title="Annuler" secondary disabled={scanning || measuring || busy} onPress={() => setModal(false)} />
    </ScrollView></KeyboardAvoidingView></SafeAreaView></PagePanel>
    <PagePanel visible={!!current} animationType="slide" onRequestClose={() => setSelected(null)}><SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={[styles.content, { maxWidth: 720, width: '100%', alignSelf: 'center' }]}>{current && <>
      {Platform.OS !== 'web' && <View style={styles.panelClose}><Button title="Fermer" secondary onPress={() => setSelected(null)} /></View>}<PlantVisual plant={current} />{preferredPhotoMode(current) === 'botanical' && <Text style={styles.captionText}>{botanicalLabel(current)}</Text>}<Text style={styles.title}>{current.name}</Text><Text style={styles.body}>{current.species} · {current.room}</Text>
      {!!current.description && <View style={styles.task}><Text style={styles.sectionTitle}>À propos de cette espèce</Text><Text style={styles.body}>{current.description}</Text>{!!current.family && <Text style={styles.body}>Famille : {current.family}</Text>}<Text style={styles.footnote}>Description fournie par plant.id.</Text></View>}
      <View style={styles.task}><Text style={styles.sectionTitle}>Fiche d’entretien</Text><Text style={styles.body}>{current.height} cm de haut{current.width != null ? ` · ${current.width} cm de large` : ''} · pot de {current.pot} cm{ '\n' }{current.soil} · {current.temperature} °C{ '\n' }Vérification tous les {wateringPlan(current).interval} jours{ '\n' }Rempotage à vérifier : {dateLabel(new Date(current.repotDate))}</Text>{!!current.wateringAdvice && <Text style={styles.body}>Conseil plant.id : {current.wateringAdvice}</Text>}{current.identificationSource === 'plant.id' && current.identificationConfidence != null && <Text style={styles.status}>Identification plant.id · confiance {Math.round(current.identificationConfidence * 100)} %</Text>}{!!current.caretaker && <Text style={styles.body}>Référent (note) : {current.caretaker}</Text>}</View>
      {current.measurement && <Text style={styles.footnote}>Dimensions estimées sur photo le {dateLabel(new Date(current.measurement.measuredAt))}, avec un repère de {current.measurement.referenceCm} cm.</Text>}
      {garden.caretaker && <View style={styles.task}><Text style={styles.sectionTitle}>Personne de confiance</Text><Text style={styles.body}>{garden.caretaker.name}{garden.caretaker.phone ? ` · ${garden.caretaker.phone}` : ''}{garden.caretaker.email ? ` · ${garden.caretaker.email}` : ''}</Text><Button title="Voir les coordonnées et consignes ↗" secondary onPress={() => navigate('caretaker')} /></View>}
      {garden.home && current.position && <ExposureDetails home={garden.home} position={current.position} species={current.species} />}
      <Button title="Placer mes plantes sur le plan ↗" secondary onPress={() => navigate('home')} />
      {careSummary(current)}
      <Button title="Modifier la fiche" secondary onPress={() => openEdit(current)} disabled={disabled} />
      <Text style={styles.body}>Prochaine vérification : {dateLabel(dueDate(current))}{daysUntil(dueDate(current)) <= 0 ? " · à faire" : ""}</Text>
      <Button title="💧 J’ai arrosé" onPress={() => void watered(current)} disabled={disabled || (!!current.lastWatered && daysUntil(new Date(current.lastWatered)) === 0)} /><Text style={styles.footnote}>{current.lastWatered ? `Dernier arrosage : ${dateLabel(new Date(current.lastWatered))}` : 'Aucun arrosage enregistré. Vérifiez le terreau avant d’arroser.'}</Text>
      <Text style={styles.sectionTitle}>Historique des arrosages</Text>{current.history.length ? current.history.map((entry, i) => <Text style={styles.history} key={`${entry}-${i}`}>✓  {dateLabel(new Date(entry))} à {new Date(entry).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>) : <Text style={styles.body}>Les arrosages confirmés apparaîtront ici.</Text>}
      {confirmDelete ? <View style={styles.task}><Text style={styles.body}>Supprimer cette plante et son historique ?</Text><Button title="Confirmer la suppression" disabled={disabled} onPress={async () => { if (await save({ ...garden, plants: garden.plants.filter(p => p.id !== current.id) })) setSelected(null); }} /><Button title="Conserver la plante" secondary onPress={() => setConfirmDelete(false)} /></View> : <Button title="Supprimer cette plante" secondary onPress={() => setConfirmDelete(true)} />}
    </>}</ScrollView></SafeAreaView></PagePanel>
  </View></SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.paper, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  shell: { flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? 1440 : 1200, alignSelf: 'center' },
  header: { paddingHorizontal: 40, paddingVertical: 20, gap: 24, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: palette.line },
  brand: { fontFamily: fonts.editorial, fontSize: 52, color: palette.olive, letterSpacing: -3 },
  subtitle: { fontFamily: fonts.annotation, fontSize: 9, letterSpacing: 1.6, color: palette.muted, marginTop: 2 },
  content: { width: '100%', alignSelf: 'center', padding: 40, paddingTop: 28, paddingBottom: 48, gap: 24 },
  settingsGrid: { gap: 24, alignItems: 'stretch' }, settingsPanel: { flex: 1, minWidth: 0 },
  panelClose: { alignSelf: 'flex-end' },
  accountBar: { paddingBottom: 8, borderBottomWidth: 1, borderColor: palette.line, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  accountLink: { minHeight: 44, justifyContent: 'center' }, accountLinkText: { fontSize: 12, color: palette.olive, textDecorationLine: 'underline' },
  title: { fontFamily: fonts.editorial, fontSize: 44, lineHeight: 49, fontWeight: '400', color: palette.ink, letterSpacing: -1.8 },
  desktopTitle: { fontSize: 60, lineHeight: 68, letterSpacing: -3 },
  intro: { gap: 28, paddingVertical: 10 }, introWide: { flexDirection: 'row', alignItems: 'center', gap: 24, paddingVertical: 16 },
  introCopy: { gap: 24 },
  botanicalFrame: { borderRadius: 100, overflow: 'hidden', borderWidth: 1, borderColor: palette.terracotta, padding: 8, backgroundColor: palette.surface },
  botanicalImage: { width: '100%', height: 240 },
  captionText: { fontFamily: fonts.annotation, fontSize: 9, letterSpacing: .7, color: palette.olive },
  body: { fontSize: 15, lineHeight: 23, color: palette.muted },
  hero: { borderRadius: 16, paddingVertical: 22, paddingHorizontal: 24, backgroundColor: palette.terracotta, flexDirection: 'row', alignItems: 'center', gap: 18, marginVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.line },
  heroTitle: { color: palette.onTerracotta, fontFamily: fonts.editorial, fontSize: 25 }, heroBody: { color: palette.onTerracotta, fontSize: 13, lineHeight: 20, marginTop: 6 },
  heroIndex: { fontFamily: fonts.editorial, fontSize: 42, color: palette.onTerracotta },
  section: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  sectionTitle: { fontFamily: fonts.editorial, fontSize: 28, color: palette.ink, fontWeight: '400' },
  counter: { fontFamily: fonts.annotation, color: palette.olive, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: palette.line },
  empty: { alignItems: 'center', padding: 30, gap: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface },
  emptyIcon: { fontFamily: fonts.editorial, fontSize: 48, color: palette.olive },
  plantGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 }, plantCard: { borderRadius: 16, overflow: 'hidden', width: '100%', borderWidth: 1, borderTopWidth: 4, borderTopColor: palette.terracotta, borderColor: palette.line, backgroundColor: palette.surface },
  plantInfo: { padding: 18, gap: 4 },
  openPlant: { marginTop: 14, color: palette.olive, fontSize: 12 },
  card: { backgroundColor: palette.surface, padding: 18, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderWidth: 1, borderColor: palette.line, flexWrap: 'wrap' },
  plantName: { fontFamily: fonts.editorial, fontSize: 25, color: palette.ink }, muted: { fontSize: 12, color: palette.muted, marginTop: 4 }, status: { fontSize: 12, lineHeight: 19, color: palette.olive, marginTop: 8 },
  button: { alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: palette.forest, borderRadius: 10, paddingVertical: 16, paddingHorizontal: 22, alignItems: 'center', minHeight: 50, borderWidth: 1, borderColor: palette.forest },
  secondary: { backgroundColor: palette.paper, borderColor: palette.line }, buttonText: { textAlign: 'center', color: palette.surface, fontWeight: '500', fontSize: 14 },
  footnote: { color: palette.muted, fontSize: 12, lineHeight: 19 }, task: { borderLeftWidth: 4, borderLeftColor: palette.terracotta, padding: 22, borderRadius: 14, backgroundColor: palette.surface, gap: 15, borderWidth: 1, borderColor: palette.line },
  nav: { flexDirection: 'row', flexWrap: 'nowrap', padding: 12, gap: 6, borderTopWidth: 1, borderColor: palette.line, backgroundColor: palette.paper },
  desktopNav: { minWidth: 280, padding: 0, borderTopWidth: 0, columnGap: 12, rowGap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1 },
  desktopNavItem: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', minWidth: 140, maxWidth: 220, paddingHorizontal: 20 },
  navItem: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', minWidth: 120, maxWidth: 240, borderRadius: 10, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent', minHeight: 54 },
  navActive: { backgroundColor: palette.sage, borderBottomColor: palette.forest }, navLabel: { fontSize: 12, color: palette.olive, textAlign: 'center' },
  field: { gap: 8 }, label: { fontSize: 13, color: palette.olive, fontWeight: '600' },
  input: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: 10, padding: 14, fontSize: 16, color: palette.ink },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  error: { color: '#A33827', lineHeight: 21 }, notice: { padding: 15, backgroundColor: palette.sage, borderRadius: 10, color: palette.ink, lineHeight: 21 },
  scanStatus: { padding: 15, backgroundColor: palette.sage, borderRadius: 10, color: palette.ink, lineHeight: 21 }, history: { paddingVertical: 12, borderBottomWidth: 1, borderColor: palette.line, color: palette.muted },
});
