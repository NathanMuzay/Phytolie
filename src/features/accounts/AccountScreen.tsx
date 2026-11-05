import { SafeAreaView } from 'react-native-safe-area-context';
import { botanicalPhoto, palette, fonts, useReadableStyles, useThemePalette } from '../../shared/ui/theme';
import { ActionButton } from '../../shared/ui/ActionButton';
import { useAccessibility } from '../../shared/accessibility/AccessibilityProvider';
import { useRef, useState } from 'react';
import { Image, ScrollView, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, View, useWindowDimensions } from 'react-native';
import { authenticate, type AccountSession } from './accountApi';
export function AccountScreen({ onConnected, onPreferences, onPrivacy }: { onPrivacy: () => void; onConnected: (session: AccountSession) => void; onPreferences: () => void }) {
  const styles = useReadableStyles(baseStyles);
  const colors = useThemePalette();
  const { width } = useWindowDimensions();
  const { settings } = useAccessibility();
  const wide = Platform.OS === 'web' && width >= 1000 && settings.textScale < 1.5;
  const passwordInput = useRef<TextInput>(null);
  const confirmationInput = useRef<TextInput>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  function changeMode(next: 'login' | 'register') { setMode(next); setError(''); setPassword(''); setConfirmation(''); setShowPassword(false); }
  async function submit() {
    if (busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Renseignez une adresse e-mail valide, par exemple vous@exemple.fr.'); return; }
    if (password.length < 12 || password.length > 128) { setError('Le mot de passe doit contenir de 12 à 128 caractères.'); return; }
    if (mode === 'register' && password !== confirmation) { setError('Les mots de passe ne correspondent pas.'); return; }
    setBusy(true); setError('');
    try { const session = await authenticate(mode, email.trim(), password); setPassword(''); setConfirmation(''); onConnected(session); }
    catch (error) { setError(error instanceof Error ? error.message : 'Connexion impossible.'); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={styles.page}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={[styles.content, wide && styles.contentWide]} keyboardShouldPersistTaps="handled">
    <View style={[styles.welcome, wide && styles.welcomeWide]}>
      <Text style={styles.brand}>Phytolie<Text style={styles.dot}>.</Text></Text>
      {wide ? <><View style={styles.welcomeCopy}><Text style={styles.eyebrow}>LE CARNET DU VIVANT</Text><Text style={styles.welcomeTitle}>Un peu de nature.{'\n'}Beaucoup d’attention.</Text><Text style={styles.welcomeText}>Vos plantes, leurs besoins et les bons gestes, réunis au même endroit.</Text></View><Image source={botanicalPhoto} resizeMode="contain" accessibilityLabel="Composition botanique de monstera en pot" style={styles.photo} /><View style={styles.benefits}><Text style={styles.benefit}>01   Identifiez vos plantes</Text><Text style={styles.benefit}>02   Retrouvez les soins du jour</Text><Text style={styles.benefit}>03   Voyez votre collection grandir</Text></View></> : <Text style={styles.small}>Votre jardin au quotidien.</Text>}
    </View>
    <View style={[styles.form, wide && styles.formWide]}>
      <View style={styles.tabs}>{([['login', 'Connexion'], ['register', 'Inscription']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: mode === value, disabled: busy }} disabled={busy} onPress={() => changeMode(value)} style={[styles.tab, mode === value && styles.tabActive]}><Text style={[styles.tabText, mode === value && styles.tabActiveText]}>{label}</Text></Pressable>)}</View>
      <View style={styles.intro}><Text accessibilityRole="header" style={styles.title}>{mode === 'login' ? 'Heureux de vous revoir.' : 'Faisons pousser votre jardin.'}</Text><Text style={styles.text}>{mode === 'login' ? 'Connectez-vous pour retrouver vos plantes et leurs prochains soins.' : 'Créez votre compte pour conserver vos fiches et retrouver votre collection sur vos appareils.'}</Text></View>
      <Pressable accessibilityRole="button" disabled={busy} onPress={onPrivacy} style={styles.accessibility}><Text style={styles.accessibilityText}>Confidentialité et données personnelles (RGPD)</Text></Pressable>
      <View style={styles.field}><Text style={styles.label}>Adresse e-mail</Text><TextInput accessibilityLabel="Adresse e-mail" placeholder="vous@exemple.fr" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" returnKeyType="next" onSubmitEditing={() => passwordInput.current?.focus()} maxLength={254} editable={!busy} style={styles.input} /></View>
      <View style={styles.field}><Text style={styles.label}>Mot de passe</Text><View style={styles.passwordRow}><TextInput ref={passwordInput} accessibilityLabel="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} returnKeyType={mode === 'login' ? 'go' : 'next'} onSubmitEditing={() => mode === 'login' ? void submit() : confirmationInput.current?.focus()} maxLength={128} editable={!busy} style={[styles.input, styles.passwordInput]} /><Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} accessibilityState={{ expanded: showPassword }} onPress={() => setShowPassword(value => !value)} style={styles.reveal}><Text style={styles.revealText}>{showPassword ? 'Masquer' : 'Afficher'}</Text></Pressable></View><Text style={styles.small}>12 caractères minimum.</Text></View>
      {mode === 'register' && <View style={styles.field}><Text style={styles.label}>Confirmer le mot de passe</Text><TextInput ref={confirmationInput} accessibilityLabel="Confirmer le mot de passe" value={confirmation} onChangeText={setConfirmation} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" returnKeyType="go" onSubmitEditing={() => void submit()} maxLength={128} editable={!busy} style={styles.input} /></View>}
      {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text>}
      <ActionButton fullWidth disabled={busy} title={busy ? 'Connexion en cours…' : mode === 'login' ? 'Se connecter →' : 'Créer mon compte →'} onPress={() => void submit()} />
      <Text style={styles.session}>Votre session dure jusqu’à 24 h et se ferme en quittant l’application. La récupération du mot de passe par e-mail n’est pas encore disponible.</Text>
      <View style={styles.footer}><Pressable accessibilityRole="button" onPress={onPreferences} style={styles.accessibility}><Text style={styles.accessibilityText}>Accessibilité et affichage</Text><Text style={styles.small}>Taille du texte, contraste, animations →</Text></Pressable><Text style={styles.small}>Vous avez déjà un carnet local ? Vous pourrez l’importer après connexion dans Mon espace.</Text></View>
    </View>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const baseStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.paper }, content: { flexGrow: 1, padding: 24, paddingTop: 32, gap: 28, width: '100%', maxWidth: 620, alignSelf: 'center' }, contentWide: { maxWidth: 1360, flexDirection: 'row', padding: 36, gap: 72, alignItems: 'center' },
  welcome: { gap: 8 }, welcomeWide: { flex: 1, alignSelf: 'stretch', backgroundColor: palette.sage, borderRadius: 28, padding: 40, gap: 24, justifyContent: 'space-between' }, brand: { fontFamily: fonts.editorial, fontSize: 42, color: palette.olive, letterSpacing: -1.8 }, dot: { color: palette.terracotta }, welcomeCopy: { gap: 16 }, eyebrow: { fontFamily: fonts.annotation, fontSize: 10, letterSpacing: 1.4, color: palette.olive }, welcomeTitle: { fontFamily: fonts.editorial, fontSize: 38, lineHeight: 44, color: palette.ink, letterSpacing: -1.3 }, welcomeText: { fontSize: 14, lineHeight: 23, color: palette.muted }, photo: { width: '100%', height: 235, borderRadius: 120 }, benefits: { gap: 14, borderTopWidth: 1, borderColor: palette.line, paddingTop: 24 }, benefit: { fontSize: 12, color: palette.olive },
  form: { gap: 22 }, formWide: { flex: 1, maxWidth: 480, paddingVertical: 24 }, tabs: { flexDirection: 'row', borderRadius: 14, padding: 5, backgroundColor: palette.sage, gap: 6 }, tab: { flex: 1, minHeight: 44, padding: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10 }, tabActive: { backgroundColor: palette.surface }, tabText: { color: palette.muted, fontSize: 14 }, tabActiveText: { color: palette.ink, fontWeight: '600' }, intro: { gap: 12 }, title: { fontFamily: fonts.editorial, fontSize: 34, lineHeight: 40, color: palette.ink, letterSpacing: -.9 }, text: { fontSize: 14, lineHeight: 22, color: palette.muted }, field: { gap: 9 }, label: { fontSize: 13, fontWeight: '600', color: palette.ink }, input: { backgroundColor: palette.surface, minHeight: 52, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.line, color: palette.ink, fontSize: 16 }, passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, passwordInput: { flex: 1, minWidth: 0 }, reveal: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 }, revealText: { color: palette.olive, fontSize: 12 }, small: { color: palette.muted, fontSize: 11, lineHeight: 18 }, session: { fontSize: 11, lineHeight: 18, color: palette.muted }, footer: { borderTopWidth: 1, borderColor: palette.line, paddingTop: 16, gap: 16 }, accessibility: { minHeight: 48, justifyContent: 'center', gap: 5 }, accessibilityText: { color: palette.olive, fontSize: 13, fontWeight: '600' }, error: { color: '#A33827', fontSize: 14, lineHeight: 22, padding: 14, borderWidth: 1, borderColor: '#A33827', borderRadius: 12 },
});
