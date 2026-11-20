import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ActionButton } from '../../shared/ui/ActionButton';
import { palette, useReadableStyles } from '../../shared/ui/theme';
import { searchBotanicalSpecies } from './botanicalNames';

export function SpeciesField({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const styles = useReadableStyles(baseStyles);
  const [searching, setSearching] = useState(false);
  const suggestions = searching && !disabled ? searchBotanicalSpecies(value) : [];
  const label = 'Espèce (obligatoire)';

  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      accessibilityLabel={label}
      editable={!disabled}
      value={value}
      placeholder="Ex. Monstera ou langue de belle-mère"
      placeholderTextColor={palette.muted}
      onChangeText={text => { setSearching(true); onChange(text); }}
      style={styles.input}
    />
    {searching && !disabled && value.trim().length >= 2 && <Text accessibilityLiveRegion="polite" style={styles.hint}>
      {suggestions.length ? 'Espèces du catalogue' : 'Vous pouvez saisir directement le nom de votre espèce.'}
    </Text>}
    {suggestions.map(item => <ActionButton key={item.scientific} secondary title={item.scientific} onPress={() => {
      setSearching(false);
      onChange(item.scientific);
    }} />)}
  </View>;
}

const baseStyles = StyleSheet.create({
  field: { gap: 8 },
  label: { color: palette.ink, fontSize: 14, fontWeight: '600' },
  input: { backgroundColor: palette.surface, color: palette.ink, borderColor: palette.line, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48, fontSize: 16 },
  hint: { color: palette.muted, fontSize: 13 },
});
