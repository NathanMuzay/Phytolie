import { useState } from 'react';
import { isRunningInExpoGo } from 'expo';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts, palette, useReadableStyles } from '../shared/ui/theme';
import { useAccessibility } from '../shared/accessibility/AccessibilityProvider';
import { mainPages, type Page } from './navigation';

function activePage(page: Page): Page { return page === 'new' || page.startsWith('plant/') || page.startsWith('edit/') ? 'garden' : page; }
function MorePages({ page, navigate, large = false }: { page: Page; navigate: (page: Page) => void; large?: boolean }) {
  const styles = useReadableStyles(baseStyles);
  const { settings } = useAccessibility();
  const [open, setOpen] = useState(false);
  const secondary = ['settings', 'preferences', 'caretaker', 'privacy'].includes(page);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Plus de pages" accessibilityState={{ expanded: open, selected: secondary }} onPress={() => setOpen(true)} style={[styles.navItem, large && styles.navItemLarge, secondary && styles.active]}><Text style={[styles.navText, secondary && styles.selectedText]}>Plus ···</Text></Pressable>
    <Modal visible={open} transparent animationType={settings.reduceMotion ? 'none' : 'fade'} onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={styles.overlay}><View accessibilityViewIsModal style={styles.menuPanel}><View style={styles.menuHeading}><Text accessibilityRole="header" style={styles.menuTitle}>Votre espace</Text><Pressable accessibilityRole="button" accessibilityLabel="Fermer le menu" onPress={() => setOpen(false)} style={styles.close}><Text style={styles.navText}>Fermer ×</Text></Pressable></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.menuContent}>{mainPages.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: page === item.id }} onPress={() => { setOpen(false); navigate(item.id); }} style={[styles.menuItem, page === item.id && styles.active]}><View style={{ flex: 1, gap: 5 }}><Text style={styles.menuLabel}>{item.label}</Text><Text style={styles.description}>{item.description}</Text></View><Text style={styles.navText}>→</Text></Pressable>)}</ScrollView>
      </View></SafeAreaView>
    </Modal>
  </>;
}
function PrimaryLinks({ page, navigate, dueCount, large = false }: { page: Page; navigate: (page: Page) => void; dueCount: number; large?: boolean }) {
  const styles = useReadableStyles(baseStyles);
  return <>{mainPages.slice(0, 3).map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.label}${item.id === 'tasks' && dueCount ? `, ${dueCount} plantes à vérifier` : ''}`} accessibilityState={{ selected: activePage(page) === item.id }} onPress={() => navigate(item.id)} style={[styles.navItem, large && styles.navItemLarge, activePage(page) === item.id && styles.active]}><Text style={[styles.navText, activePage(page) === item.id && styles.selectedText]}>{item.label}</Text>{item.id === 'tasks' && dueCount > 0 && <Text style={styles.badge}>{dueCount}</Text>}</Pressable>)}</>;
}
export function AppHeader({ page, navigate, dueCount, wide }: { page: Page; navigate: (page: Page) => void; dueCount: number; wide: boolean }) {
  const styles = useReadableStyles(baseStyles);
  const { settings } = useAccessibility();
  return <View style={[styles.header, wide && styles.headerWide, !wide && Platform.OS !== 'web' && isRunningInExpoGo() && { paddingRight: 72 }]}>
    <Pressable accessibilityRole="link" accessibilityLabel="Phytolie — Retour à mes plantes" onPress={() => navigate('garden')} style={styles.brandLink}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.65} style={styles.brand}>Phytolie<Text style={styles.brandDot}>.</Text></Text>{wide && <Text style={styles.subtitle}>CULTIVEZ VOTRE QUOTIDIEN</Text>}</Pressable>
    {wide ? <View style={styles.navigation}><PrimaryLinks page={page} navigate={navigate} dueCount={dueCount} /><MorePages page={page} navigate={navigate} /></View> : settings.textScale < 1.5 && <Text style={styles.mobileSubtitle}>LE CARNET DU VIVANT</Text>}
  </View>;
}
export function AppBottomNav({ page, navigate, dueCount }: { page: Page; navigate: (page: Page) => void; dueCount: number }) {
  const styles = useReadableStyles(baseStyles);
  const { settings } = useAccessibility();
  const { width } = useWindowDimensions();
  const large = width < 600 && settings.textScale >= 1.5;
  return <View accessibilityLabel="Navigation principale" style={[styles.bottom, large && { flexWrap: 'wrap' }]}><PrimaryLinks page={page} navigate={navigate} dueCount={dueCount} large={large} /><MorePages page={page} navigate={navigate} large={large} /></View>;
}
const baseStyles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, backgroundColor: palette.paper, borderBottomWidth: 1, borderColor: palette.line, flexShrink: 0 }, headerWide: { paddingHorizontal: 40, paddingVertical: 18, flexWrap: 'wrap' }, brandLink: { flexShrink: 1, gap: 3 }, brand: { fontFamily: fonts.editorial, fontSize: 32, color: palette.olive, letterSpacing: -1.5 }, brandDot: { color: palette.terracotta }, subtitle: { fontFamily: fonts.annotation, fontSize: 9, letterSpacing: 1.2, color: palette.muted }, mobileSubtitle: { fontFamily: fonts.annotation, fontSize: 9, letterSpacing: .8, color: palette.muted, flexShrink: 1, textAlign: 'right' },
  navigation: { flex: 1, maxWidth: 680, minWidth: 440, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, navItem: { minHeight: 48, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, gap: 6, flexGrow: 1, flexBasis: 0, minWidth: 68 }, active: { backgroundColor: palette.sage }, navText: { color: palette.muted, fontSize: 13, textAlign: 'center', flexShrink: 1 }, selectedText: { color: palette.ink, fontWeight: '600' }, badge: { fontSize: 10, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: palette.forest, color: palette.surface, borderRadius: 10 },
  navItemLarge: { flexBasis: '40%', minWidth: 0 },
  bottom: { flexDirection: 'row', borderTopWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, padding: 8, gap: 4, flexShrink: 0 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12, 30, 20, .4)' }, menuPanel: { maxHeight: '85%', width: '100%', maxWidth: 560, alignSelf: 'center', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: palette.surface, padding: 20 }, menuHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, menuTitle: { fontFamily: fonts.editorial, fontSize: 28, color: palette.ink, flexShrink: 1 }, close: { minHeight: 48, justifyContent: 'center', padding: 8 }, menuContent: { paddingVertical: 16, gap: 8 }, menuItem: { minHeight: 64, padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }, menuLabel: { color: palette.ink, fontSize: 16, fontWeight: '600' }, description: { color: palette.muted, fontSize: 12, lineHeight: 19 },
});
