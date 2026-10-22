import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { changeAccountPassword, logoutAllAccounts, type AccountSession } from './accountApi';
import { useThemePalette } from '../../shared/ui/theme';

export function AccountSecurity({ session, disabled, onRevoked }: { session: AccountSession; disabled: boolean; onRevoked: () => void }) {
  const colors = useThemePalette();
  const [current, setCurrent] = useState(''), [next, setNext] = useState(''), [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(all = false) {
    if (busy || disabled) return;
    if (!all && (next.length < 12 || next.length > 128 || next !== confirmation)) { setError('Choisissez un mot de passe de 12 à 128 caractères et confirmez-le à l’identique.'); return; }
    setBusy(true); setError('');
    try {
      if (all) await logoutAllAccounts(session);
      else await changeAccountPassword(session, current, next);
      setCurrent(''); setNext(''); setConfirmation(''); onRevoked();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Action impossible. Réessayez.'); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: 16 }}>
    <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '600', color: colors.ink }}>Sécurité du compte</Text>
    {([
      ['Mot de passe actuel', current, setCurrent, 'current-password'],
      ['Nouveau mot de passe', next, setNext, 'new-password'],
      ['Confirmer le nouveau mot de passe', confirmation, setConfirmation, 'new-password'],
    ] as const).map(([label, value, setter, autoComplete]) => <View key={label} style={{ gap: 8 }}>
      <Text style={{ color: colors.ink }}>{label}</Text>
      <TextInput accessibilityLabel={label} value={value} onChangeText={setter} autoComplete={autoComplete} secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={128} editable={!busy && !disabled} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 14, color: colors.ink }} />
    </View>)}
    <Text style={{ color: colors.muted }}>Changer le mot de passe ferme toutes les sessions. Vous devrez vous reconnecter sur chaque appareil.</Text>
    {!!error && <Text accessibilityRole="alert" style={{ color: '#A33827' }}>{error}</Text>}
    {(['Changer le mot de passe', 'Déconnecter tous les appareils'] as const).map((label, index) => <Pressable key={label} accessibilityRole="button" disabled={busy || disabled} accessibilityState={{ disabled: busy || disabled }} onPress={() => void submit(index === 1)} style={{ minHeight: 48, padding: 14, borderWidth: 1, borderColor: colors.olive, borderRadius: 10, opacity: busy || disabled ? .5 : 1 }}><Text style={{ color: colors.olive }}>{busy ? 'Veuillez patienter…' : label}</Text></Pressable>)}
  </View>;
}
