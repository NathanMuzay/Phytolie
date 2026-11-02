import { Pressable, StyleSheet, Text } from 'react-native';
import { palette, useReadableStyles } from './theme';

export function ActionButton({ title, onPress, secondary = false, disabled = false, fullWidth = false }: {
  title: string; onPress: () => void; secondary?: boolean; disabled?: boolean; fullWidth?: boolean;
}) {
  const styles = useReadableStyles(baseStyles);
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, fullWidth && { alignSelf: 'stretch' }, (pressed || disabled) && { opacity: .55 }]}>
    <Text style={[styles.text, secondary && styles.secondaryText]}>{title}</Text>
  </Pressable>;
}
const baseStyles = StyleSheet.create({
  button: { minHeight: 48, maxWidth: '100%', alignSelf: 'flex-start', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: palette.forest, backgroundColor: palette.forest },
  secondary: { backgroundColor: palette.surface, borderColor: palette.line },
  text: { color: palette.surface, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  secondaryText: { color: palette.olive },
});
