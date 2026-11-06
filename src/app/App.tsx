import Constants from 'expo-constants';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { configureApiHost } from '../services/apiBase';
import { AccessibilityProvider, useAccessibility } from '../shared/accessibility/AccessibilityProvider';
import { PrivacyScreen } from '../features/privacy/PrivacyScreen';
import { PreferencesScreen } from '../features/settings/PreferencesScreen';
import { gardenWithHome } from '../features/home/homeGarden';
import { HomeScreen, PlacementPicker } from '../features/home/HomeScreen';
import { estimatePlacement, validPosition, type PlantPosition } from '../features/home/home';
import { GuestCareScreen } from '../features/caretakers/GuestCareScreen';
import { guestInvitationFromUrl } from '../features/caretakers/invitation';
import { CaretakerScreen } from '../features/caretakers/CaretakerScreen';
import { usePage } from './usePage';
import { AppHeader, AppBottomNav } from './AppHeader';
import { CollectionScreen } from '../features/plants/CollectionScreen';
import { ActionButton as Button } from '../shared/ui/ActionButton';
import { type Page } from './navigation';
import { PlantVisual } from '../features/plants/PlantVisual';
import { TasksScreen } from '../features/plants/TasksScreen';
import { botanicalLabel, preferredPhotoMode, type BotanicalImage, type PhotoMode, type PhotoFit } from '../features/plants/botanical';
import { palette, fonts, useReadableStyles, useThemePalette } from '../shared/ui/theme';
import { DimensionMeasure } from '../features/measurement/DimensionMeasure';
import { type Measurement } from '../features/measurement/measurement';
import { LightMeasure } from '../features/light/LightMeasure';
import { type LightReading } from '../features/light/light';
import { SubstratePicker } from '../features/plants/SubstratePicker';
import { validSubstrate, type SubstrateSelection } from '../features/plants/substrates';
import { recordSubstrateChange, setArchived } from '../features/plants/careRecords';
import { PlantDetailScreen } from '../features/plants/PlantDetailScreen';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';
import { Garden, Plant, STORAGE_KEY, daysUntil, dueDate, parseGarden, waterPlant, sortPlantsByUrgency, DEFAULT_REMINDER_TIME, isReminderTime } from '../shared/model';
import { requestReminders, syncReminders, onReminderOpened } from '../services/notifications';
import { careDefaults, estimateWaterAmount } from '../features/plants/care';
import { wateringPlan, defaultIrrigation, Irrigation } from '../features/plants/irrigation';
import { searchCities, fetchWeather, outdoorTemperature, City, Weather } from '../services/weather';
import { AccountScreen } from '../features/accounts/AccountScreen';
import { AccountSession, AccountError, loadAccountGarden, saveAccountGarden, logoutAccount, mergeLocalPlants } from '../features/accounts/accountApi';
import { identifyPlant, PlantIdentification } from '../features/plants/plantApi';

configureApiHost(Constants.expoConfig?.hostUri, Platform.OS === 'web' ? window.location.origin : undefined);

const empty: Garden = { plants: [], reminders: false };
const dateLabel = (date: Date) => date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
const initialForm = { name: '', species: '', room: 'Salon', interval: '7', height: '30', width: '', pot: '14', temperature: '20', soil: 'Terreau universel', caretaker: '', photo: '', photoMode: 'botanical' as PhotoMode, photoFit: 'contain' as PhotoFit, botanicalImage: undefined as BotanicalImage | undefined, repotDate: '', waterAmount: '175', wateringAdvice: '', identificationConfidence: '', identificationSource: '', family: '', description: '' };
type Form = typeof initialForm;
type FormField = Exclude<keyof Form, 'botanicalImage'>;

function PagePanel({ visible, children, onRequestClose, animationType }: React.ComponentProps<typeof Modal>) {
  const { settings } = useAccessibility();
  if (Platform.OS !== 'web') return <Modal visible={visible} onRequestClose={onRequestClose} animationType={settings.reduceMotion ? 'none' : animationType}><SafeAreaProvider>{children}</SafeAreaProvider></Modal>;
  return visible ? <View style={{ flex: 1 }}>{children}</View> : null;
}

function Field({ label, value, onChange, numeric = false, placeholder = '' }: { label: string; value: string; onChange: (v: string) => void; numeric?: boolean; placeholder?: string }) {
  const palette = useThemePalette();
  const styles = useReadableStyles(baseStyles);
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} keyboardType={numeric ? 'numeric' : 'default'} placeholder={placeholder} placeholderTextColor={palette.muted} style={styles.input} maxLength={numeric ? 7 : 100} /></View>;
}

export default function App() {
  return <SafeAreaProvider initialMetrics={initialWindowMetrics}><AccessibilityProvider><AppContent /></AccessibilityProvider></SafeAreaProvider>;
}

function AppContent() {
  const colors = useThemePalette();
  const [account, setAccount] = useState<AccountSession | null>(null);
  const [invitation, setInvitation] = useState<string | null>(() => Platform.OS === 'web' ? guestInvitationFromUrl(window.location.href) : null);
  const { page, navigate } = usePage();
  useEffect(() => {
    if (Platform.OS === 'web') {
      const changed = () => setInvitation(guestInvitationFromUrl(window.location.href));
      window.addEventListener('hashchange', changed);
      return () => window.removeEventListener('hashchange', changed);
    }
    let active = true;
    const open = (url: string) => { const code = guestInvitationFromUrl(url); if (active && code !== null) setInvitation(code); };
    void Linking.getInitialURL().then(url => { if (url) open(url); }).catch(() => {});
    const subscription = Linking.addEventListener('url', event => open(event.url));
    return () => { active = false; subscription.remove(); };
  }, []);
  function openInvitation(code: string) {
    setInvitation(code);
    if (Platform.OS === 'web') window.location.hash = `/personne-de-confiance?invitation=${encodeURIComponent(code)}`;
  }
  function exitInvitation() {
    setInvitation(null);
    if (Platform.OS === 'web') {
      const url = new URL(window.location.href); url.searchParams.delete('invitation');
      window.history.replaceState(null, '', url.href);
    }
    navigate(account ? 'garden' : 'account');
  }
  useEffect(() => {
    if (!account) return;
    const expire = () => { if (Date.parse(account.expiresAt) <= Date.now()) { setAccount(null); if (invitation === null) navigate('account'); void syncReminders([], false).catch(() => {}); } };
    const timer = setTimeout(expire, Math.max(0, Date.parse(account.expiresAt) - Date.now()));
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') expire(); });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [account, navigate, invitation]);
  if (invitation !== null) return <GuestCareScreen key={invitation} invitation={invitation} onExit={exitInvitation} />;
  if (!account && page === 'privacy') return <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}><ScrollView contentContainerStyle={{ padding: 24, gap: 24, width: '100%', maxWidth: 980, alignSelf: 'center' }}><PrivacyScreen onBack={() => navigate('account')} backLabel="Connexion" /></ScrollView></SafeAreaView>;
  if (!account && page === 'preferences') return <SafeAreaView style={{ flex: 1 }}><ScrollView contentContainerStyle={{ padding: 24, gap: 24 }}><PreferencesScreen /><Button title="Retour à la connexion" onPress={() => navigate('account')} /></ScrollView></SafeAreaView>;
  if (!account || page === 'account') return <AccountScreen onOpenInvitation={openInvitation} onPrivacy={() => navigate('privacy')} onPreferences={() => navigate('preferences')} onConnected={session => { setAccount(session); navigate('garden'); }} />;
  return <GardenApp page={page} navigate={navigate} key={account.user.id} account={account} onOpenInvitation={openInvitation} onDisconnected={() => { setAccount(null); navigate('account'); }} />;
}

function GardenApp({ page, navigate, account, onOpenInvitation, onDisconnected }: { page: Page; navigate: (page: Page) => void; account: AccountSession; onOpenInvitation: (code: string) => void; onDisconnected: () => void }) {
  const palette = useThemePalette();
  const styles = useReadableStyles(baseStyles);
  const { width } = useWindowDimensions();
  const { settings: appearance } = useAccessibility();
  const wide = Platform.OS === 'web' && width >= 860;
  const contentLimit = page === 'home' ? 1440 : page === 'garden' || page === 'tasks' ? 1280 : page === 'settings' ? 1080 : page === 'caretaker' ? 820 : 980;
  const twoSettingsColumns = wide && width >= 1000 && appearance.textScale < 1.5;
  const [substrateDetails, setSubstrateDetails] = useState<SubstrateSelection>();
  const [irrigation, setIrrigation] = useState<Irrigation>({ ...defaultIrrigation });
  const [lastWateredInput, setLastWateredInput] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherStatus, setWeatherStatus] = useState('');
  const [citySearchStatus, setCitySearchStatus] = useState('');
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherRefresh, setWeatherRefresh] = useState(0);
  const [searchingCity, setSearchingCity] = useState(false);
  const [reminderTimeInput, setReminderTimeInput] = useState(DEFAULT_REMINDER_TIME);
  const [reminderStatus, setReminderStatus] = useState('');
  const [reminderError, setReminderError] = useState('');
  const [garden, setGarden] = useState<Garden>(empty);
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const loading = useRef(false);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [measurement, setMeasurement] = useState<Measurement | undefined>();
  const [lightReading, setLightReading] = useState<LightReading | undefined>();
  const [suggestions, setSuggestions] = useState<PlantIdentification[]>([]);
  const [scanStatus, setScanStatus] = useState('');
  const lock = useRef(false);
  const tab = page;
  const missingPlant = ready && (page.startsWith('edit/') || page.startsWith('plant/')) && !garden.plants.some(p => p.id === page.slice(page.indexOf('/') + 1));
  const modal = ready && !loadFailed && !missingPlant && (page === 'new' || page.startsWith('edit/'));
  const setModal = (visible: boolean) => navigate(visible ? 'new' : 'garden');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [position, setPosition] = useState<PlantPosition | undefined>();
  const [form, setForm] = useState<Form>(initialForm);
  const [error, setError] = useState('');
  const [formStep, setFormStep] = useState(0);
  const formScroll = useRef<ScrollView>(null);
  useEffect(() => { formScroll.current?.scrollTo({ y: 0, animated: false }); }, [formStep]);
  const [notice, setNotice] = useState('');
  const selected = page.startsWith('plant/') ? page.slice(6) : null;
  const setSelected = (id: string | null) => navigate(id ? `plant/${id}` : 'garden');
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
    if (!garden.city) { setWeather(null); setWeatherStatus(''); setWeatherLoading(false); return; }
    const city = garden.city;
    let active = true;
    let controller: AbortController | undefined;
    async function update() {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      setWeatherLoading(true); setWeatherStatus('');
      setWeather(previous => previous?.cityId === city.id ? previous : null);
      try {
        const next = await fetchWeather(city, request.signal);
        if (active && !request.signal.aborted) setWeather(next);
      } catch (error) {
        if (active && !request.signal.aborted) { setWeather(null); setWeatherStatus(error instanceof Error ? error.message : 'Météo indisponible.'); }
      } finally {
        if (active && controller === request) setWeatherLoading(false);
      }
    }
    void update();
    const timer = setInterval(() => void update(), 3600000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void update(); });
    return () => { active = false; controller?.abort(); clearInterval(timer); subscription.remove(); };
  }, [garden.city?.id, garden.city?.latitude, garden.city?.longitude, weatherRefresh]);
  useEffect(() => { if (ready && !loadFailed) schedule(garden); }, [weather]);
  async function findCities() {
    setSearchingCity(true); setCities([]); setCitySearchStatus('');
    try { const results = await searchCities(cityQuery); setCities(results); setCitySearchStatus(results.length ? 'Choisissez la ville correspondante.' : 'Aucune ville trouvée.'); }
    catch (error) { setCitySearchStatus(error instanceof Error ? error.message : 'Recherche impossible.'); }
    finally { setSearchingCity(false); }
  }
  async function selectCity(city: City) {
    const sameCity = garden.city?.id === city.id && garden.city.latitude === city.latitude && garden.city.longitude === city.longitude;
    if (await save({ ...garden, city })) {
      setCities([]); setCitySearchStatus('');
      if (sameCity) setWeatherRefresh(value => value + 1);
    }
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
  async function loadGarden(silent = false) {
    if (loading.current || lock.current || scanning || measuring || leaving.current) return;
    loading.current = true; setRefreshing(true);
    if (!silent) setReady(false);
    setLoadFailed(false);
    try {
      let loaded: Garden;
      const result = await loadAccountGarden(account); loaded = result.garden; revision.current = result.revision;
      if (!mounted.current) return;
      setGarden(loaded); setReminderTimeInput(loaded.reminderTime ?? DEFAULT_REMINDER_TIME); schedule(loaded);
    } catch (error) {
      if (mounted.current) { setLoadFailed(true); setNotice(error instanceof Error ? error.message : 'Impossible de lire la collection. Les données existantes sont conservées.'); }
    } finally { loading.current = false; if (mounted.current) { setReady(true); setRefreshing(false); } }
  }
  useEffect(() => {
    mounted.current = true; void loadGarden();
    return () => { mounted.current = false; };
  }, []);
  // Returning to the collection fetches changes made from another device.
  useEffect(() => { if (page === 'garden' && ready) void loadGarden(true); }, [page]);
  async function switchAccount() {
    if (lock.current || scanning || measuring || leaving.current) return;
    leaving.current = true; setBusy(true);
    try {
      if (account) { try { await logoutAccount(account); } catch (error) { if (!(error instanceof AccountError && error.status === 401)) throw error; } }
      await scheduleQueue.current;
      await syncReminders([], false);
      onDisconnected();
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
    if (lock.current || loading.current || loadFailed || leaving.current) return false;
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
      }
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
          const results = await identifyPlant(base64, account.token);
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
    setScanStatus('Saisissez l’espèce dans le champ « Espèce ». La photo et le surnom sont conservés.');
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
  function moveForm(step: number) {
    if (step > formStep) {
      if (formStep === 0 && !form.name.trim()) { setError('Donnez un nom à votre plante pour continuer.'); return; }
      if (formStep === 1) {
        if (substrateDetails && !validSubstrate(substrateDetails)) { setError('Renseignez le nom et la composition du substrat réellement utilisé.'); return; }
        const interval = Number(form.interval), height = Number(form.height), pot = Number(form.pot), temperature = Number(form.temperature), amount = Number(form.waterAmount);
        if (!Number.isInteger(interval) || interval < 1 || interval > 90 || !Number.isFinite(height) || height <= 0 || !Number.isFinite(pot) || pot <= 0 || pot > 100 || !Number.isFinite(irrigation.depth) || irrigation.depth <= 0 || irrigation.depth > 100 || !form.temperature.trim() || !Number.isFinite(temperature) || temperature < -10 || temperature > 50 || !Number.isFinite(amount) || amount < 0 || amount > 5000) { setError('Vérifiez les dimensions, la température et les réglages d’arrosage avant de continuer.'); return; }
        if (form.width.trim() && (!Number.isFinite(Number(form.width)) || Number(form.width) < 1 || Number(form.width) > 1000)) { setError('Largeur de la plante : entre 1 et 1 000 cm.'); return; }
        if (!editingId && lastWateredInput) {
          const date = new Date(`${lastWateredInput}T00:00:00`);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(lastWateredInput) || !Number.isFinite(+date) || +date > Date.now() || `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` !== lastWateredInput) { setError('Dernier arrosage : indiquez une date passée valide au format AAAA-MM-JJ.'); return; }
        }
      }
    }
    setError(''); setFormStep(step);
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
    let plant: Plant = { ...existing, ...form, substrateDetails, position, lightReading, width: form.width.trim() ? Number(form.width) : undefined, measurement, irrigation, id: existing?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: form.name.trim(), species: form.species.trim() || 'Espèce à préciser', room: form.room.trim() || 'Appartement', interval, height, pot, temperature, waterAmount, identificationConfidence: form.identificationConfidence ? Number(form.identificationConfidence) : undefined, lastWatered: existing?.lastWatered ?? initialWatered?.toISOString() ?? null, createdAt: existing?.createdAt ?? new Date().toISOString(), repotDate: repot.toISOString(), history: existing?.history ?? (initialWatered ? [initialWatered.toISOString()] : []) };
    try {
      if (substrateDetails && !validSubstrate(substrateDetails)) throw new Error('Renseignez le nom et la composition du substrat.');
      if (existing) plant = recordSubstrateChange(existing, plant);
    } catch (error) { setError(error instanceof Error ? error.message : 'Substrat invalide.'); return; }
    if (await save({ ...garden, plants: existing ? garden.plants.map(p => p.id === existing.id ? plant : p) : [...garden.plants, plant] })) { setModal(false); setEditingId(null); setForm(initialForm); setNotice(existing ? 'Fiche modifiée. Historique des arrosages conservé.' : initialWatered ? 'Plante ajoutée avec son dernier arrosage connu.' : 'Plante ajoutée. Aucun arrosage n’est enregistré pour le moment.'); }
  }
  const sortedPlants = sortPlantsByUrgency(withWeather(garden.plants.filter(p => !p.archivedAt)));
  const due = sortedPlants.filter(p => daysUntil(dueDate(p)) <= 0);
  const current = withWeather(garden.plants).find(p => p.id === selected);
  const disabled = busy || scanning || measuring || refreshing || !ready || loadFailed;
  function openAdd(enter = true) { setSubstrateDetails(undefined); setFormStep(0); setLightReading(undefined); setPosition(undefined); setMeasurement(undefined); setIrrigation({ ...defaultIrrigation }); setLastWateredInput(''); setSuggestions([]); setEditingId(null); setForm(initialForm); setError(''); setScanStatus(''); if (enter) navigate('new'); }
  function openEdit(plant: Plant, enter = true) {
    setFormStep(0);
    plant = garden.plants.find(p => p.id === plant.id) || plant;
    setSubstrateDetails(plant.substrateDetails);
    setPosition(plant.position);
    setLightReading(plant.lightReading);
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
    if (page === 'new') openAdd(false);
    if (page.startsWith('edit/')) {
      const plant = garden.plants.find(p => p.id === page.slice(5));
      if (plant) openEdit(plant, false);
    }
  }, [page, ready]);
  async function watered(p: Plant) {
    try { if (await save({ ...garden, plants: garden.plants.map(item => item.id === p.id ? waterPlant(item) : item) })) setNotice(`Arrosage de ${p.name} enregistré.`); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Arrosage impossible.'); }
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
  const noticeMessage = !!notice && <View style={[styles.notice, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}><Text accessibilityLiveRegion="polite" style={[styles.body, { flex: 1 }]}>{notice}</Text><Pressable onPress={() => setNotice('')} accessibilityRole="button" accessibilityLabel="Fermer le message" style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={styles.body}>×</Text></Pressable></View>;
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" backgroundColor={palette.paper} /><View style={styles.shell}>
    <AppHeader page={page} navigate={navigate} dueCount={due.length} wide={wide && appearance.textScale < 1.5} />
    <ScrollView key={page} contentContainerStyle={[styles.content, { maxWidth: contentLimit }, !wide && styles.mobileContent]} style={Platform.OS === 'web' && (modal || current) ? { display: 'none' } : undefined}
      refreshControl={Platform.OS !== 'web' && tab === 'garden' ? <RefreshControl refreshing={refreshing} enabled={!busy && !scanning && !measuring} onRefresh={() => void loadGarden(true)} tintColor={palette.forest} colors={[palette.forest]} /> : undefined}>
      {noticeMessage}
      {missingPlant && <Text accessibilityRole="alert" style={styles.body}>Cette plante n’existe plus dans votre collection.</Text>}
      {!ready ? <Text style={styles.body}>Ouverture de votre jardin…</Text> : loadFailed && tab === 'garden' ? <View style={styles.task}><Text style={styles.sectionTitle}>Collection indisponible</Text><Text style={styles.body}>Vérifiez votre connexion au serveur, puis réessayez.</Text><Button title="Réessayer" onPress={() => void loadGarden()} /></View> : <>
      {tab === 'garden' && <CollectionScreen plants={withWeather(garden.plants)} disabled={disabled} onAdd={openAdd} onOpen={plant => { setSelected(plant.id); }} onTasks={() => navigate('tasks')} />}
      {tab === 'tasks' && <TasksScreen plants={sortedPlants} disabled={disabled} onWatered={plant => void watered(plant)} onObserve={(plant, moisture) => void observeMoisture(plant, moisture)} onOpenPlant={plant => { setSelected(plant.id); }} onAddPlant={garden.plants.length ? () => navigate('garden') : openAdd} />}
      {tab === 'home' && <HomeScreen home={garden.home} plants={garden.plants.filter(p => !p.archivedAt)} latitude={garden.city?.latitude} disabled={disabled} onSave={(home, positions, plants) => save(gardenWithHome({ ...garden, plants: [...plants, ...garden.plants.filter(p => p.archivedAt)] }, home, positions))} />}
      {tab === 'caretaker' && <CaretakerScreen session={account} plants={garden.plants.filter(p => !p.archivedAt)} onOpenInvitation={onOpenInvitation} contact={garden.caretaker} disabled={disabled} onSave={caretaker => save({ ...garden, caretaker })} />}
      {tab === 'preferences' && <PreferencesScreen account={{ email: account.user.email, session: account, disabled: busy || scanning || measuring, onDisconnect: () => void switchAccount(), onRevoked: () => { void (async () => { try { await scheduleQueue.current; await syncReminders([], false); } finally { onDisconnected(); } })().catch(() => {}); } }} />}
      {tab === 'privacy' && <PrivacyScreen onBack={() => navigate('settings')} />}
      {tab === 'settings' && <>
        <Text accessibilityRole="header" style={styles.title}>Mon espace</Text>
        <View style={styles.task}><Text style={styles.sectionTitle}>Vos données personnelles</Text><Text style={styles.body}>Découvrez quelles données sont utilisées, pourquoi, à qui elles sont transmises et comment exercer vos droits.</Text><Button title="Confidentialité et données personnelles (RGPD)" secondary onPress={() => navigate('privacy')} /></View>
        <View style={styles.row}><Button title="Ma maison ↗" secondary onPress={() => navigate('home')} /><Button title="Personne de confiance ↗" secondary onPress={() => navigate('caretaker')} /></View>
        {account && <View style={styles.task}><Text style={styles.sectionTitle}>Ma collection en ligne</Text><Text style={styles.body}>Collection sauvegardée sur le serveur, actualisée à chaque retour dans Mes plantes. Sur téléphone, tirez la liste vers le bas pour l’actualiser.</Text><Button title="Importer mes plantes locales" secondary disabled={disabled} onPress={() => void importLocalGarden()} /><Text style={styles.footnote}>Import des plantes absentes et de leurs photos. Si les plans diffèrent, replacez les plantes importées.</Text></View>}
        <View style={[styles.settingsGrid, { flexDirection: twoSettingsColumns ? 'row' : 'column' }]} >
        <View style={[styles.task, twoSettingsColumns && styles.settingsPanel]}><View style={styles.section}><Text style={styles.sectionTitle}>Rappels à {garden.reminderTime ?? DEFAULT_REMINDER_TIME}</Text><Switch accessibilityLabel="Activer les rappels quotidiens" value={garden.reminders} disabled={disabled || Platform.OS === 'web'} trackColor={{ true: '#356148' }} onValueChange={async value => { try { if (value && !(await requestReminders())) { setNotice('Autorisez les notifications dans les paramètres Android.'); return; } await save({ ...garden, reminders: value }); } catch { setNotice('Impossible d’activer les notifications sur cet appareil.'); } }} /></View><Field label="Heure des rappels (HH:MM)" value={reminderTimeInput} onChange={value => { setReminderTimeInput(value); setReminderError(''); }} placeholder="09:00" /><Button title="Enregistrer l’heure" secondary disabled={disabled} onPress={() => void saveReminderTime()} />{!!reminderError && <Text accessibilityRole="alert" style={styles.error}>{reminderError}</Text>}{!!reminderStatus && <Text accessibilityLiveRegion="polite" style={styles.body}>{reminderStatus}</Text>}<Text style={styles.body}>{Platform.OS === 'web' ? 'Les notifications locales sont disponibles dans l’application Android.' : 'Rappel quotidien à l’échéance, jusqu’à confirmation. Programmation sur 30 jours renouvelée à l’ouverture. Après un changement de fuseau horaire, rouvrez l’application.'}</Text></View>
        <View style={[styles.task, twoSettingsColumns && styles.settingsPanel]}>
          <Text style={styles.sectionTitle}>Météo extérieure</Text>
          <Field label="Rechercher une ville" value={cityQuery} onChange={setCityQuery} placeholder="Paris" />
          <Button title={searchingCity ? 'Recherche…' : 'Rechercher'} secondary disabled={disabled || searchingCity} onPress={() => void findCities()} />
          {!!citySearchStatus && <Text accessibilityLiveRegion="polite" style={styles.body}>{citySearchStatus}</Text>}
          {cities.map(city => <Button key={city.id} secondary title={`${city.name}, ${city.admin1 || ''}, ${city.country || ''}`} disabled={disabled} onPress={() => void selectCity(city)} />)}
          {garden.city && <Text style={styles.body}>{garden.city.name} : {outdoorTemperature(weather, garden.city) != null ? `${weather!.temperature} °C · relevé à ${new Date(weather!.fetchedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'température saisie utilisée en attendant la météo'}</Text>}
          {weatherLoading && <Text accessibilityLiveRegion="polite" style={styles.body}>{outdoorTemperature(weather, garden.city) != null ? 'Actualisation de la météo…' : 'Chargement de la météo…'}</Text>}
          {!!weatherStatus && <Text accessibilityRole="alert" style={styles.body}>{weatherStatus}</Text>}
          {garden.city && <View style={styles.row}><Button title={weatherLoading ? 'Actualisation…' : 'Actualiser la météo'} secondary disabled={disabled || weatherLoading} onPress={() => setWeatherRefresh(value => value + 1)} /><Button title="Désactiver la météo" secondary disabled={disabled} onPress={async () => { if (await save({ ...garden, city: undefined })) { setCities([]); setCitySearchStatus(''); } }} /></View>}
          <Text style={styles.footnote}>Météo Open-Meteo, actualisée chaque heure pour les plantes dehors. En cas d’échec, température saisie utilisée. La pluie n’est pas déduite de l’arrosage.</Text>
        </View>
        </View>
        <View style={styles.task}><Text style={styles.sectionTitle}>Données et photos</Text><Text style={styles.body}>Vos fiches et photos sont sauvegardées sur le serveur Phytolie. Identification : photo transmise à plant.id via le serveur. Mesure IA : photo transmise à OpenAI. Les mesures manuelles restent locales.</Text></View>

      </>}
      </>}
    </ScrollView>
    {(!wide || appearance.textScale >= 1.5) && !modal && !current && <AppBottomNav page={page} navigate={navigate} dueCount={due.length} />}
    <PagePanel visible={modal} animationType="slide" onRequestClose={() => { if (!scanning && !busy && !measuring) setModal(false); }}><SafeAreaView style={styles.safe}><KeyboardAvoidingView style={[styles.shell, { maxWidth: 720 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView ref={formScroll} contentContainerStyle={[styles.content, !wide && styles.mobileContent]} keyboardShouldPersistTaps="handled">
      <View style={styles.section}><Button title="← Mes plantes" secondary disabled={scanning || busy || measuring} onPress={() => setModal(false)} /><Text style={styles.footnote}>Étape {formStep + 1} sur 3</Text></View>
      <View style={styles.formSteps}>{['La plante', 'Ses besoins', 'Récapitulatif'].map((label, index) => <View key={label} style={[styles.formStep, index === formStep && styles.formStepActive]}><Text style={[styles.formStepText, index === formStep && styles.formStepActiveText]}>{index < formStep ? '✓' : index + 1} · {label}</Text></View>)}</View>
      <Text accessibilityRole="header" style={styles.title}>{editingId ? 'Modifier la plante' : 'Ajouter une plante'}</Text>
      <Text accessibilityLiveRegion="polite" style={styles.body}>{['Une photo pour l’identifier, ou un nom pour commencer. La saisie manuelle reste toujours possible.', 'Adaptez les repères à votre pot et à son environnement. Vous pourrez les modifier à tout moment.', 'Vérifiez votre fiche avant de l’enregistrer dans votre collection.'][formStep]}</Text>
      {formStep === 0 && <>
      <View style={styles.row}><Button title={scanning ? 'Analyse…' : 'Prendre une photo'} onPress={() => void choosePhoto(true)} disabled={scanning || measuring || busy} /><Button title="Choisir dans la galerie" secondary onPress={() => void choosePhoto(false)} disabled={scanning || measuring || busy} /></View>
      <Text style={styles.footnote}>Facultatif : continuez ci-dessous pour saisir votre plante sans photo.</Text>
      {([{ key: 'name', label: 'Nom de la plante (obligatoire)', placeholder: 'Monstera du salon' }, { key: 'species', label: 'Espèce (facultatif)', placeholder: 'Monstera deliciosa' }, { key: 'room', label: 'Pièce', placeholder: 'Salon' }] as { key: FormField; label: string; placeholder?: string }[]).map(f => <Field key={f.key} label={f.label} placeholder={f.placeholder} value={form[f.key]} onChange={value => updateForm(f.key, value)} />)}
      <View style={styles.task}>
        <Text style={styles.sectionTitle}>Le visuel de votre plante</Text>
        <View style={styles.row}>
          <Button title="Visuel botanique" secondary={form.photoMode !== 'botanical'} disabled={busy || scanning || measuring} onPress={() => setForm(f => ({ ...f, photoMode: 'botanical' }))} />
          <Button title="Ma photo" secondary={form.photoMode !== 'personal'} disabled={!form.photo || busy || scanning || measuring} onPress={() => setForm(f => ({ ...f, photoMode: 'personal' }))} />
        </View>
        <PlantVisual plant={form} style={{ height: 180, aspectRatio: undefined }} />
        <Text style={styles.footnote}>{form.photoMode === 'botanical' ? `${botanicalLabel(form)}. Votre photo personnelle reste conservée.` : 'Votre photo, avec le cadrage choisi pour le carnet et la fiche.'}</Text>
        {form.photoMode === 'personal' && <View style={styles.row}>
          <Button title="Photo entière" secondary={form.photoFit !== 'contain'} onPress={() => setForm(f => ({ ...f, photoFit: 'contain' }))} />
          <Button title="Remplir le cadre" secondary={form.photoFit !== 'cover'} onPress={() => setForm(f => ({ ...f, photoFit: 'cover' }))} />
        </View>}
      </View>
      {!!suggestions.length && <View style={styles.task}><Text style={styles.sectionTitle}>Quelle plante reconnaissez-vous ?</Text><Text style={styles.body}>Choisissez l’espèce proposée par plant.id.</Text>{suggestions.map((item, index) => <Button key={`${item.scientificName}-${index}`} secondary={form.species !== item.scientificName || form.identificationSource !== 'plant.id'} title={`${item.commonName} (${item.scientificName}) · ${Math.round(item.confidence * 100)} %`} onPress={() => applyIdentification(item)} disabled={scanning || measuring || busy} />)}<Button title="Aucune : saisir l’espèce manuellement" secondary onPress={manualIdentification} disabled={scanning || measuring || busy} /></View>}
      {!!form.species && <View style={styles.task}><Text style={styles.sectionTitle}>Fiche d’entretien · {form.species}</Text>{!!form.family && <Text style={styles.body}>Famille : {form.family}</Text>}{!!form.description && <Text style={styles.body}>{form.description}{'\n'}Source : plant.id</Text>}<Text style={styles.body}>Terreau : {form.soil}{'\n'}Vérification tous les {preview.interval} jours{preview.amount > 0 ? ` · environ ${preview.amount} ml si le terreau est sec` : ''}.</Text><Text style={styles.footnote}>Repères indicatifs, modifiables ci-dessous. Vérifiez le terreau.</Text></View>}
      {!!scanStatus && <Text accessibilityLiveRegion="polite" style={styles.scanStatus}>{scanStatus}</Text>}
      </>}
      {formStep === 1 && <>
      {!!form.photo && <DimensionMeasure token={account.token} key={form.photo} photo={form.photo} disabled={busy || scanning} onBusy={setMeasuring} onApply={value => { setMeasurement(value); setForm(previous => ({ ...previous, height: String(value.height), width: String(value.width), pot: String(value.pot), waterAmount: String(estimateWaterAmount(value.pot, previous.species)) })); }} />}
      {measurement && <Text style={styles.footnote}>Dimensions estimées sur photo ({measurement.method === 'vision' ? 'points détectés par IA' : 'points placés manuellement'}) le {dateLabel(new Date(measurement.measuredAt))}. Vérifiez les valeurs avant d’enregistrer.</Text>}
      {garden.home ? <PlacementPicker home={garden.home} species={form.species} position={position} disabled={disabled} onChange={next => {
        setPosition(next);
        if (!next) return;
        const area = garden.home!.areas.find(a => a.id === next.areaId);
        const estimate = estimatePlacement(garden.home!, next, form.species);
        if (area) { setForm(f => ({ ...f, room: area.name })); setIrrigation(c => ({ ...c, location: area.kind === 'garden' ? 'outdoor' : 'indoor', exposure: estimate?.hours != null ? estimate.exposure : c.exposure })); }
      }} /> : <Text style={styles.footnote}>Créez votre plan dans « Ma maison » pour placer cette plante et estimer sa lumière.</Text>}
      {([{ key: 'interval', label: 'Fréquence manuelle (jours, utilisée si calcul désactivé)', numeric: true }, { key: 'waterAmount', label: 'Dose manuelle (ml, utilisée si calcul désactivé)', numeric: true }, { key: 'height', label: 'Hauteur de la plante (cm)', numeric: true }, { key: 'width', label: 'Largeur de la plante (cm, facultatif)', numeric: true }, { key: 'pot', label: 'Diamètre du pot (cm)', numeric: true }, { key: 'temperature', label: 'Température de la pièce ou de repli météo (°C)', numeric: true }, { key: 'soil', label: 'Terreau conseillé / notes (rétention réelle choisie ci-dessus)' }] as { key: FormField; label: string; placeholder?: string; numeric?: boolean }[]).filter(f => !irrigation.automatic || !['interval', 'waterAmount'].includes(f.key)).map(f => <Field key={f.key} label={f.label} placeholder={f.placeholder} numeric={f.numeric} value={form[f.key]} onChange={value => updateForm(f.key, value)} />)}
      <View style={styles.task}><Text style={styles.sectionTitle}>Adapter l’arrosage</Text><View style={styles.section}><Text style={styles.body}>Calcul automatique</Text><Switch accessibilityLabel="Calcul automatique de l’arrosage" value={irrigation.automatic} onValueChange={automatic => setIrrigation(c => ({ ...c, automatic }))} /></View><Field label="Profondeur utile du pot (cm)" numeric value={Number.isNaN(irrigation.depth) ? '' : String(irrigation.depth)} onChange={value => setIrrigation(c => ({ ...c, depth: value ? Number(value) : NaN }))} />
      {([
        ['material', 'Matériau du pot', [['plastic', 'Plastique / émaillé'], ['terracotta', 'Terre cuite']]],
        ['drainage', 'Trous de drainage', [['yes', 'Oui'], ['no', 'Non'], ['unknown', 'À vérifier']]],
        ['location', 'Emplacement', [['indoor', 'Intérieur'], ['outdoor', 'Extérieur']]],
        ['exposure', 'Exposition', [['shade', 'Faible lumière'], ['indirect', 'Lumière indirecte'], ['sun', 'Soleil direct']]],
        ['season', 'Cycle actuel de la plante', [['growing', 'Croissance'], ['rest', 'Repos végétatif']]],
      ] as const).map(([key, label, options]) => <View key={key} style={styles.field}><Text style={styles.label}>{label}</Text><View style={[styles.row, { flexWrap: 'wrap' }]}>{options.map(([value, title]) => <Button key={value} title={`${irrigation[key] === value ? '✓ ' : ''}${title}`} secondary={irrigation[key] !== value} onPress={() => setIrrigation(c => ({ ...c, [key]: value }))} />)}</View>{key === 'exposure' && <LightMeasure key={editingId ?? 'new'} reading={lightReading} room={form.room} active={modal} disabled={disabled} onChange={setLightReading} />}</View>)}
      <SubstratePicker value={substrateDetails} fallbackType={irrigation.substrate} disabled={disabled} onChange={value => { setSubstrateDetails(value); setIrrigation(previous => ({ ...previous, substrate: value.type })); }} />
      {!editingId && <Field label="Dernier arrosage connu (AAAA-MM-JJ, facultatif)" value={lastWateredInput} onChange={setLastWateredInput} />}
      <Text style={styles.body}>{preview.instruction}</Text><Text style={styles.body}>Prochaine vérification : {Number.isFinite(+preview.nextCheck) ? dateLabel(preview.nextCheck) : 'date à corriger'}</Text>{preview.reasons.map(reason => <Text key={reason} style={styles.footnote}>{reason}</Text>)}<Text style={styles.footnote}>Le cycle est choisi selon la plante, sans supposer l’hémisphère. Sans capteur, l’humidité doit être vérifiée sur la fiche. Les dimensions décrivent le pot intérieur, pas le cache-pot.</Text></View>
      </>}
      {formStep === 2 && <>
      <View style={styles.task}><Text style={styles.sectionTitle}>{form.name}</Text><Text style={styles.body}>{form.species || 'Espèce à préciser'} · {form.room || 'Appartement'}</Text><Text style={styles.body}>Pot de {form.pot} cm · {form.height} cm de haut</Text><Text style={styles.body}>Vérification tous les {preview.interval} jours{preview.amount > 0 ? ` · dose indicative de ${preview.amount} ml` : ''}.</Text><Text style={styles.footnote}>{preview.instruction}</Text><Button title="Modifier l’identité" secondary onPress={() => moveForm(0)} /><Button title="Modifier les besoins" secondary onPress={() => moveForm(1)} /></View>
      <Text style={styles.sectionTitle}>Pour plus tard (facultatif)</Text>
      <Field label="Vérifier le rempotage le (AAAA-MM-JJ)" placeholder="Par défaut : dans un an" value={form.repotDate} onChange={value => updateForm('repotDate', value)} />
      <Field label="Personne référente pendant une absence" placeholder="Prénom — note personnelle" value={form.caretaker} onChange={value => updateForm('caretaker', value)} />
      {!!form.wateringAdvice && <View style={styles.task}><Text style={styles.sectionTitle}>Conseil fourni par plant.id</Text><Text style={styles.body}>{form.wateringAdvice}</Text></View>}
      <Text style={styles.footnote}>La reconnaissance est une proposition, pas une certitude. Le calcul automatique utilise le pot et son substrat, l’espèce et l’environnement. Les coefficients sont indicatifs : l’humidité réelle prime sur l’échéance. Les dimensions ne peuvent pas être déduites d’une photo sans repère d’échelle.</Text>
      </>}
      {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text>}
      <View style={styles.formActions}>{formStep > 0 && <Button title="← Précédent" secondary disabled={disabled} onPress={() => moveForm(formStep - 1)} />}{formStep < 2 ? <Button title={formStep === 0 ? 'Continuer : ses besoins →' : 'Vérifier ma fiche →'} disabled={disabled} onPress={() => moveForm(formStep + 1)} /> : <Button title={busy ? 'Enregistrement…' : editingId ? 'Enregistrer les modifications' : 'Ajouter à mes plantes'} onPress={() => void addPlant()} disabled={disabled} />}</View>
    </ScrollView></KeyboardAvoidingView></SafeAreaView></PagePanel>
    <PagePanel visible={!!current} animationType="slide" onRequestClose={() => setSelected(null)}><SafeAreaView style={styles.safe}>
      <ScrollView key={current?.id} contentContainerStyle={[styles.content, !wide && styles.mobileContent, { maxWidth: 1200 }]}>
        {noticeMessage}
        {current && <PlantDetailScreen key={current.id} plant={current} home={garden.home} caretaker={garden.caretaker} disabled={disabled}
          onBack={() => setSelected(null)} onEdit={() => openEdit(current)} onPlan={() => navigate('home')} onCaretaker={() => navigate('caretaker')}
          onSavePlant={async (next, message) => { const ok = await save({ ...garden, plants: garden.plants.map(p => p.id === next.id ? next : p) }); if (ok) setNotice(message); return ok; }}
          onArchive={async () => { if (await save({ ...garden, plants: garden.plants.map(p => p.id === current.id ? setArchived(p, !p.archivedAt) : p) })) { setNotice(current.archivedAt ? 'Plante restaurée. Rappels réactivés selon vos réglages.' : 'Plante archivée. Ses données sont conservées et ses rappels suspendus.'); setSelected(null); } }}
          onWatered={() => void watered(current)} onObserve={moisture => void observeMoisture(current, moisture)}
          onDelete={async () => { if (await save({ ...garden, plants: garden.plants.filter(plant => plant.id !== current.id) })) setSelected(null); }} />}
      </ScrollView>
    </SafeAreaView></PagePanel>
  </View></SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  formSteps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, formStep: { flexGrow: 1, padding: 12, borderRadius: 10, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line }, formStepActive: { backgroundColor: palette.forest, borderColor: palette.forest }, formStepText: { color: palette.muted, fontSize: 12 }, formStepActiveText: { color: palette.surface, fontWeight: '600' }, formActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', paddingVertical: 16, borderTopWidth: 1, borderColor: palette.line },
  safe: { flex: 1, backgroundColor: palette.paper },
  shell: { flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? 1440 : 1200, alignSelf: 'center' },
  content: { width: '100%', alignSelf: 'center', padding: 40, paddingTop: 28, paddingBottom: 48, gap: 24 },
  mobileContent: { padding: 20, paddingBottom: 36, gap: 20 },
  settingsGrid: { gap: 24, alignItems: 'stretch' }, settingsPanel: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.editorial, fontSize: 44, lineHeight: 49, fontWeight: '400', color: palette.ink, letterSpacing: -1.8 },
  body: { fontSize: 15, lineHeight: 23, color: palette.muted },
  section: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  sectionTitle: { fontFamily: fonts.editorial, fontSize: 28, color: palette.ink, fontWeight: '400' },
  footnote: { color: palette.muted, fontSize: 12, lineHeight: 19 }, task: { borderLeftWidth: 4, borderLeftColor: palette.terracotta, padding: 22, borderRadius: 14, backgroundColor: palette.surface, gap: 15, borderWidth: 1, borderColor: palette.line },
  field: { gap: 8 }, label: { fontSize: 13, color: palette.olive, fontWeight: '600' },
  input: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: 10, padding: 14, fontSize: 16, color: palette.ink },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  error: { color: '#A33827', lineHeight: 21 }, notice: { padding: 15, backgroundColor: palette.sage, borderRadius: 10, color: palette.ink, lineHeight: 21 },
  scanStatus: { padding: 15, backgroundColor: palette.sage, borderRadius: 10, color: palette.ink, lineHeight: 21 },
});
