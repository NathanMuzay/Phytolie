import { DelegationPanel } from './DelegationPanel';
import type { AccountSession } from './accountApi';
import type { Plant } from './model';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Caretaker } from './model';
import { palette, fonts, useReadableStyles, useThemePalette } from './theme';
const empty: Caretaker = { name: '', phone: '', email: '', notes: '' };
export function CaretakerScreen({ contact, disabled, onSave, session, plants, initialInvitation, onAccepted }: { session: AccountSession; plants: Plant[]; initialInvitation: string; onAccepted: () => void; contact?: Caretaker; disabled: boolean; onSave: (contact: Caretaker | undefined) => Promise<boolean> }) {
  const palette = useThemePalette();
  const styles = useReadableStyles(baseStyles);
  const [form, setForm] = useState<Caretaker>(contact ?? empty);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function submit() {
    const next = { name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(), notes: form.notes.trim() };
    if (!next.name) { setError('Renseignez le nom de la personne de confiance.'); return; }
    if (next.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)) { setError('Renseignez une adresse e-mail valide.'); return; }
    setError(''); setMessage('');
    if (await onSave(next)) { setForm(next); setMessage('Personne de confiance enregistrée.'); }
    else setError('Enregistrement impossible. Vérifiez le message de la collection puis réessayez.');
  }
  return <View style={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>Personne de confiance</Text>
    <Text style={styles.body}>Qui prendra soin de vos plantes en votre absence ?</Text>
    {(['name', 'phone', 'email', 'notes'] as const).map(key => {
      const label = { name: 'Nom et prénom *', phone: 'Téléphone', email: 'Adresse e-mail', notes: 'Consignes pour les plantes' }[key];
      return <View key={key} style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={form[key]} editable={!disabled} onChangeText={value => { setForm(current => ({ ...current, [key]: value })); setMessage(''); setError(''); }} keyboardType={key === 'phone' ? 'phone-pad' : key === 'email' ? 'email-address' : 'default'} autoCapitalize={key === 'email' ? 'none' : 'sentences'} autoCorrect={key !== 'email'} multiline={key === 'notes'} maxLength={{ name: 100, phone: 40, email: 254, notes: 2000 }[key]} style={[styles.input, key === 'notes' && { minHeight: 140, textAlignVertical: 'top' }]} placeholder={key === 'notes' ? 'Accès au logement, emplacement du matériel, précautions…' : ''} placeholderTextColor={palette.muted} /></View>;
    })}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!!message && <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text>}
    <Pressable accessibilityRole="button" disabled={disabled} style={[styles.button, disabled && { opacity: .5 }]} onPress={() => void submit()}><Text style={styles.buttonText}>Enregistrer la personne de confiance</Text></Pressable>
    {contact && <Pressable accessibilityRole="button" disabled={disabled} onPress={async () => { if (await onSave(undefined)) { setForm(empty); setError(''); setMessage('Personne de confiance supprimée.'); } else setError('Suppression impossible. Réessayez.'); }}><Text style={styles.link}>Supprimer les coordonnées</Text></Pressable>}
    <DelegationPanel session={session} plants={plants} email={form.email} notes={form.notes} disabled={disabled} initialInvitation={initialInvitation} onAccepted={onAccepted} />
  </View>;
}
const baseStyles = StyleSheet.create({
  content: { alignSelf: 'center', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderLeftWidth: 4, borderLeftColor: palette.terracotta, borderRadius: 16, padding: 24, width: '100%', maxWidth: 760, gap: 24 }, title: { fontFamily: fonts.editorial, fontSize: 44, color: palette.ink },
  body: { color: palette.muted, fontSize: 15, lineHeight: 23 }, field: { gap: 8 }, label: { color: palette.olive, fontWeight: '600', fontSize: 13 },
  input: { backgroundColor: palette.surface, color: palette.ink, padding: 14, borderWidth: 1, borderColor: palette.line, fontSize: 16 },
  button: { alignSelf: 'flex-start', maxWidth: '100%', borderRadius: 10, backgroundColor: palette.forest, padding: 18, alignItems: 'center' }, buttonText: { color: palette.surface, fontSize: 14 },
  link: { color: palette.olive, paddingVertical: 12, fontSize: 14 }, error: { color: '#A33827', fontSize: 14 },
});
