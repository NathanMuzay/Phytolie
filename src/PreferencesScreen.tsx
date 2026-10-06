import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { TEXT_SCALES } from './accessibility';
import { useAccessibility } from './AccessibilityProvider';
import { fonts, palette, useReadableStyles, useThemePalette } from './theme';

export function PreferencesScreen() {
  const { settings, ready, error, update, reset } = useAccessibility();
  const styles = useReadableStyles(baseStyles);
  const colors = useThemePalette();
  return <View style={styles.page}>
    <Text accessibilityRole="header" style={styles.title}>Paramètres</Text>
    <Text style={styles.body}>Vos préférences s’appliquent à toutes les pages et sont conservées sur cet appareil.</Text>
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>Taille du texte</Text>
      <View style={styles.options}>{TEXT_SCALES.map(textScale => <Pressable key={textScale} accessibilityRole="button" accessibilityLabel={`Taille du texte ${Math.round(textScale * 100)} pour cent`} aria-pressed={settings.textScale === textScale} accessibilityState={{ selected: settings.textScale === textScale, disabled: !ready }} disabled={!ready} onPress={() => update({ textScale })} style={[styles.button, settings.textScale === textScale && styles.selected]}><Text style={[styles.buttonText, settings.textScale === textScale && { color: colors.surface }]}>{settings.textScale === textScale ? '✓ ' : ''}{Math.round(textScale * 100)} %</Text></Pressable>)}</View>
    </View>
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>Lecture et confort</Text>
      {([
        ['highContrast', 'Contraste renforcé'],
        ['simpleFont', 'Police simple, sans empattement'],
        ['spaciousText', 'Interlignes plus espacés'],
        ['reduceMotion', 'Réduire les animations'],
      ] as const).map(([key, label]) => <View key={key} style={styles.setting}><Text style={[styles.body, { flex: 1 }]}>{label}</Text><Switch accessibilityLabel={label} disabled={!ready} value={settings[key]} onValueChange={value => update({ [key]: value })} trackColor={{ false: colors.line, true: colors.olive }} /></View>)}
    </View>
    <View style={styles.card}><Text accessibilityRole="header" style={styles.heading}>Aperçu</Text><Text style={styles.body}>Votre plante aime une lumière douce. Vérifiez le terreau avant de l’arroser.</Text><Text style={styles.hint}>Au clavier, la touche Tab sélectionne les boutons et les champs.</Text></View>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <Pressable accessibilityRole="button" disabled={!ready} onPress={reset} style={styles.button}><Text style={styles.buttonText}>Rétablir les réglages par défaut</Text></Pressable>
  </View>;
}
const baseStyles = StyleSheet.create({
  page: { gap: 24, width: '100%', maxWidth: 850 },
  title: { fontFamily: fonts.editorial, fontSize: 44, color: palette.ink },
  heading: { fontSize: 23, fontWeight: '600', color: palette.ink },
  body: { fontSize: 16, lineHeight: 24, color: palette.ink }, hint: { fontSize: 14, lineHeight: 22, color: palette.muted },
  card: { backgroundColor: palette.surface, borderWidth: 1, borderLeftWidth: 4, borderLeftColor: palette.terracotta, borderColor: palette.line, borderRadius: 16, padding: 22, gap: 20 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  setting: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 48 },
  button: { alignSelf: 'flex-start', padding: 16, minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: palette.olive, backgroundColor: palette.surface },
  selected: { backgroundColor: palette.forest, borderColor: palette.forest }, buttonText: { color: palette.olive, fontSize: 16, fontWeight: '600' }, error: { color: '#A33827', fontSize: 16 },
});
