import { useEffect, useState } from 'react';
import { isRunningInExpoGo } from 'expo';
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { fonts, palette, useReadableStyles, useThemePalette } from '../shared/ui/theme';
import { mainPages, type Page } from './navigation';

export function AppHeader({ page, navigate, dueCount, wide }: {
  page: Page; navigate: (page: Page) => void; dueCount: number; wide: boolean;
}) {
  const styles = useReadableStyles(baseStyles);
  const colors = useThemePalette();
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [page, wide]);
  useEffect(() => {
    if (!open) return;
    if (Platform.OS === 'android') {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setOpen(false); return true; });
      return () => subscription.remove();
    }
    if (Platform.OS === 'web') {
      const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
      window.addEventListener('keydown', escape);
      return () => window.removeEventListener('keydown', escape);
    }
  }, [open]);
  function go(next: Page) { setOpen(false); navigate(next); }
  const links = mainPages.map(item => <Pressable key={item.id}
    accessibilityRole={wide ? 'tab' : 'button'} accessibilityLabel={item.label}
    accessibilityState={{ selected: page === item.id }}
    onPress={() => go(item.id)} style={[styles.item, wide && styles.desktopItem, page === item.id && styles.active]}>
    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
      <Text style={[styles.label, page === item.id && { color: colors.ink }]}>{item.label}</Text>
      {!wide && <Text style={styles.description}>{item.description}</Text>}
    </View>
    {item.id === 'tasks' && dueCount > 0 ? <Text style={styles.badge}>{dueCount}</Text> : !wide && <Text style={styles.arrow}>{page === item.id ? '✓' : '›'}</Text>}
  </Pressable>);
  return <View style={styles.container}>
    <View style={[styles.header, wide && styles.desktopHeader, !wide && Platform.OS !== 'web' && isRunningInExpoGo() && { paddingRight: 72 }]}>
      <Pressable accessibilityRole="link" accessibilityLabel="Phytolie — Retour à l’accueil" onPress={() => go('garden')} style={styles.brandLink}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.5} style={[styles.brand, wide && styles.desktopBrand]}>Phytolie<Text style={{ color: colors.terracotta }}>.</Text></Text>
        {wide && <Text style={styles.subtitle}>LE CARNET DU VIVANT</Text>}
      </Pressable>
      {wide ? <View style={styles.desktopNav}>{links}</View> : <Pressable accessibilityRole="button"
        accessibilityLabel={open ? 'Fermer le menu des pages' : 'Ouvrir le menu des pages'}
        accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={[styles.menuButton, open && styles.active]}>
        <Text style={styles.menuText}>{open ? '✕  Fermer' : '☰  Menu'}</Text>
      </Pressable>}
    </View>
    {!wide && open && <ScrollView style={{ maxHeight: height * .5, flexGrow: 0 }} contentContainerStyle={styles.menu}
      keyboardShouldPersistTaps="handled" accessibilityLabel="Pages de l’application">{links}</ScrollView>}
  </View>;
}

const baseStyles = StyleSheet.create({
  container: { backgroundColor: palette.paper, borderBottomWidth: 1, borderColor: palette.line, flexShrink: 0 },
  header: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  desktopHeader: { paddingHorizontal: 40, paddingVertical: 20, flexWrap: 'wrap', gap: 24 },
  brandLink: { flexShrink: 1, minWidth: 0, maxWidth: '55%' },
  brand: { fontFamily: fonts.editorial, fontSize: 36, color: palette.olive, letterSpacing: -1.5 },
  desktopBrand: { fontSize: 52, letterSpacing: -3 },
  subtitle: { fontFamily: fonts.annotation, fontSize: 9, letterSpacing: 1.6, color: palette.muted, marginTop: 2 },
  menuButton: { minHeight: 48, maxWidth: '50%', paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: palette.line, flexShrink: 0 },
  menuText: { color: palette.olive, fontSize: 14, fontWeight: '600' },
  menu: { paddingHorizontal: 16, paddingBottom: 12, gap: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  active: { backgroundColor: palette.sage },
  label: { color: palette.olive, fontSize: 15, fontWeight: '600' },
  description: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  arrow: { color: palette.olive, fontSize: 22 },
  badge: { color: palette.surface, backgroundColor: palette.forest, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, fontSize: 12 },
  desktopNav: { flexDirection: 'row', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end', gap: 8, minWidth: 280 },
  desktopItem: { minHeight: 48, minWidth: 120, maxWidth: 240 },
});
