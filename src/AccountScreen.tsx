import React, { useState } from 'react';
import { SafeAreaView, ScrollView, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { authenticate, type AccountSession } from './accountApi';
export function AccountScreen({ onConnected, onCancel }: { onConnected: (session: AccountSession) => void; onCancel: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit() {
    if (busy) return;
    if (password.length < 12 || password.length > 128) { setError('Le mot de passe doit contenir de 12 à 128 caractères.'); return; }
    if (mode === 'register' && password !== confirmation) { setError('Les mots de passe ne correspondent pas.'); return; }
    setBusy(true); setError('');
    try { const session = await authenticate(mode, email, password); setPassword(''); setConfirmation(''); onConnected(session); }
    catch (error) { setError(error instanceof Error ? error.message : 'Connexion impossible.'); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={styles.page}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.brand}>folia.</Text><Text style={styles.title}>{mode === 'login' ? 'Retrouver mes plantes' : 'Créer mon compte'}</Text>
    <Text style={styles.text}>Votre collection sera sauvegardée sur le serveur Folia. Vos plantes locales restent disponibles et pourront être importées après connexion.</Text>
    <Text style={styles.label}>Adresse e-mail</Text><TextInput accessibilityLabel="Adresse e-mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" maxLength={254} editable={!busy} style={styles.input} />
    <Text style={styles.label}>Mot de passe (12 caractères minimum)</Text><TextInput accessibilityLabel="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} maxLength={128} editable={!busy} style={styles.input} />
    {mode === 'register' && <><Text style={styles.label}>Confirmer le mot de passe</Text><TextInput accessibilityLabel="Confirmer le mot de passe" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoCapitalize="none" autoComplete="new-password" maxLength={128} editable={!busy} style={styles.input} /></>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <Pressable accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => void submit()}><Text style={styles.buttonText}>{busy ? 'Veuillez patienter…' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}</Text></Pressable>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setPassword(''); setConfirmation(''); }}><Text style={styles.link}>{mode === 'login' ? 'Pas de compte ? S’inscrire' : 'Déjà un compte ? Se connecter'}</Text></Pressable>
    <Pressable accessibilityRole="button" disabled={busy} onPress={onCancel}><Text style={styles.link}>Continuer avec ma collection locale</Text></Pressable>
    <Text style={styles.text}>La connexion dure jusqu’à la fermeture de l’application, au maximum 24 h. Le mot de passe n’est pas enregistré sur cet appareil. Cette version ne propose pas encore de récupération par e-mail.</Text>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#F7F8F2' }, content: { padding: 24, gap: 16, maxWidth: 620, width: '100%', alignSelf: 'center' }, brand: { fontSize: 40, fontWeight: '800', color: '#224B37' }, title: { fontSize: 28, fontWeight: '700', color: '#233E2D' }, text: { fontSize: 15, lineHeight: 23, color: '#64715F' }, label: { fontWeight: '600', color: '#3D573F' }, input: { backgroundColor: '#FFF', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#DCE3D3', color: '#233E2D', fontSize: 16 }, button: { backgroundColor: '#315C40', borderRadius: 15, padding: 16, alignItems: 'center' }, buttonText: { color: '#FFF', fontWeight: '600' }, link: { color: '#245940', paddingVertical: 12 }, error: { color: '#A33827', lineHeight: 22 } });
