import { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useAccessibility } from '../../shared/accessibility/AccessibilityProvider';
import { daysUntil, dueDate, sortPlantsByUrgency, type Plant } from '../../shared/model';
import { ActionButton } from '../../shared/ui/ActionButton';
import { botanicalPhoto, fonts, palette, useReadableStyles, useThemePalette } from '../../shared/ui/theme';
import { botanicalLabel, preferredPhotoMode } from './botanical';
import { filterCollection } from './collection';
import { PlantVisual } from './PlantVisual';

export function CollectionScreen({ plants, disabled, onAdd, onOpen, onTasks }: {
  plants: Plant[]; disabled: boolean; onAdd: () => void; onOpen: (plant: Plant) => void; onTasks: () => void;
}) {
  const styles = useReadableStyles(baseStyles);
  const colors = useThemePalette();
  const { width } = useWindowDimensions();
  const { settings } = useAccessibility();
  const wide = Platform.OS === 'web' && width >= 860;
  const [query, setQuery] = useState('');
  const [room, setRoom] = useState<string | null>(null);
  const [onlyDue, setOnlyDue] = useState(false);
  const [sort, setSort] = useState<'urgency' | 'name'>('urgency');
  const [gridWidth, setGridWidth] = useState(0);
  const rooms = [...new Set(plants.map(plant => plant.room))].sort((a, b) => a.localeCompare(b, 'fr'));
  const activeRoom = room && rooms.includes(room) ? room : null;
  const due = plants.filter(plant => daysUntil(dueDate(plant)) <= 0).length;
  const ordered = sort === 'urgency' ? sortPlantsByUrgency(plants) : [...plants].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const visible = filterCollection(ordered, query, activeRoom, onlyDue);
  const columns = Math.min(settings.textScale >= 1.75 ? 1 : settings.textScale >= 1.3 ? 2 : 3, Math.max(1, Math.floor((gridWidth + 20) / 290)));
  function reset() { setQuery(''); setRoom(null); setOnlyDue(false); }
  return <View style={styles.screen}>
    <View style={[styles.heading, wide && settings.textScale < 1.5 && styles.headingWide]}>
      <View style={styles.headingCopy}><Text style={styles.eyebrow}>LE BONHEUR PREND RACINE</Text><Text accessibilityRole="header" style={styles.title}>Mes plantes</Text><Text style={styles.body}>{plants.length ? (wide ? 'Votre petit coin de nature, un soin à la fois.' : `${plants.length} plante${plants.length > 1 ? 's' : ''} · ${rooms.length} pièce${rooms.length > 1 ? 's' : ''} · Un soin à la fois.`) : 'Faites une place à votre première plante.'}</Text></View>
      <ActionButton title="＋ Ajouter une plante" onPress={onAdd} disabled={disabled} fullWidth={!wide} />
    </View>
    {!!plants.length && <View style={[styles.overview, wide && settings.textScale < 1.5 && styles.overviewWide]}>
      {wide && <View style={styles.metrics}><View style={styles.metric}><Text style={styles.metricValue}>{plants.length}</Text><Text style={styles.small}>plante{plants.length > 1 ? 's' : ''}</Text></View><View style={[styles.metric, styles.metricBorder]}><Text style={styles.metricValue}>{rooms.length}</Text><Text style={styles.small}>pièce{rooms.length > 1 ? 's' : ''}</Text></View></View>}
      <Pressable accessibilityRole="button" accessibilityLabel={`${due} plantes à vérifier aujourd’hui. Ouvrir À faire`} onPress={onTasks} style={({ pressed }) => [styles.care, pressed && { opacity: .65 }]}>
        <View style={styles.careMark}><Text style={styles.careNumber}>{due ? due : '✓'}</Text></View><View style={styles.careCopy}><Text style={styles.careTitle}>{due ? 'Les soins du jour vous attendent' : 'Tout est à jour aujourd’hui'}</Text><Text style={styles.small}>{due ? `${due} plante${due > 1 ? 's' : ''} à vérifier · Voir les soins` : 'Consulter les prochaines vérifications'}</Text></View><Text style={styles.arrow}>→</Text>
      </Pressable>
    </View>}
    {!!plants.length && <View style={styles.tools}>
      <View style={styles.sectionHeading}><Text accessibilityRole="header" style={styles.sectionTitle}>Mon herbier</Text><Text accessibilityLiveRegion="polite" style={styles.small}>{visible.length} sur {plants.length} plante{plants.length > 1 ? 's' : ''}</Text></View>
      <View style={styles.search}><Text accessible={false} style={styles.searchIcon}>⌕</Text><TextInput accessibilityLabel="Rechercher une plante, une espèce ou une pièce" placeholder="Rechercher une plante, une espèce…" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search" style={styles.searchInput} />{!!query && <Pressable accessibilityRole="button" accessibilityLabel="Effacer la recherche" onPress={() => setQuery('')} style={styles.clear}><Text style={styles.body}>×</Text></Pressable>}</View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityLabel="Filtrer par pièce">
        {[null, ...rooms].map(value => <Pressable key={value ?? '__all'} accessibilityRole="button" accessibilityState={{ selected: activeRoom === value }} onPress={() => setRoom(value)} style={[styles.chip, activeRoom === value && styles.chipActive]}><Text style={[styles.chipText, activeRoom === value && styles.chipActiveText]}>{value ?? 'Toutes les pièces'}</Text></Pressable>)}
      </ScrollView>
      <View style={styles.sortRow}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: onlyDue }} onPress={() => setOnlyDue(value => !value)} style={styles.sortButton}><Text style={styles.sortText}>{onlyDue ? '☑' : '☐'} À vérifier aujourd’hui</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Tri : ${sort === 'urgency' ? 'priorité aux soins' : 'nom de A à Z'}. Changer le tri`} onPress={() => setSort(value => value === 'urgency' ? 'name' : 'urgency')} style={styles.sortButton}><Text style={styles.sortText}>↕ {sort === 'urgency' ? 'Priorité aux soins' : 'Nom de A à Z'}</Text></Pressable></View>
    </View>}
    {!plants.length && <View style={styles.empty}>
      <Image source={botanicalPhoto} accessibilityLabel="Composition botanique de monstera en pot" resizeMode="contain" style={styles.emptyPhoto} />
      <Text accessibilityRole="header" style={styles.emptyTitle}>Un carnet prêt à grandir.</Text><Text style={[styles.body, styles.emptyText]}>Prenez une photo pour identifier votre plante, ou renseignez sa fiche à la main. Ses prochains soins apparaîtront ici.</Text>
      <ActionButton title="Ajouter ma première plante" onPress={onAdd} disabled={disabled} />
      <Text style={styles.small}>Photo ou saisie manuelle · Fiche modifiable à tout moment</Text>
    </View>}
    {!!plants.length && !visible.length && <View style={styles.noResults}><Text accessibilityRole="header" style={styles.sectionTitle}>Aucune plante trouvée</Text><Text style={styles.body}>Essayez un autre nom ou élargissez vos filtres.</Text><ActionButton title="Réinitialiser la recherche et les filtres" secondary onPress={reset} /></View>}
    <View style={styles.grid} onLayout={event => setGridWidth(event.nativeEvent.layout.width)}>{visible.map(plant => {
      const days = daysUntil(dueDate(plant));
      return <Pressable key={plant.id} accessibilityRole="button" accessibilityLabel={`Ouvrir ${plant.name}, ${plant.room}, ${days <= 0 ? 'à vérifier' : `vérification dans ${days} jours`}`} onPress={() => onOpen(plant)} style={({ pressed }) => [styles.card, { width: columns === 1 ? '100%' : (gridWidth - 20 * (columns - 1)) / columns }, pressed && { opacity: .7 }]}>
        <PlantVisual plant={plant} style={styles.cardPhoto} />
        <View style={styles.cardCopy}><View style={styles.cardHeading}><Text style={styles.room}>{plant.room}</Text><Text accessible={false} style={styles.arrow}>↗</Text></View><Text style={styles.plantName}>{plant.name}</Text><Text style={styles.small}>{plant.species}</Text><View style={[styles.status, days <= 0 && styles.statusDue]}><Text style={[styles.statusText, days <= 0 && styles.statusDueText]}>{days < 0 ? `À vérifier · ${Math.abs(days)} j de retard` : days === 0 ? 'À vérifier aujourd’hui' : days === 1 ? 'Prochaine vérification demain' : `À vérifier dans ${days} jours`}</Text></View><Text style={styles.caption}>{preferredPhotoMode(plant) === 'personal' ? 'Votre photo personnelle' : botanicalLabel(plant)}</Text></View>
      </Pressable>;
    })}</View>
  </View>;
}
const baseStyles = StyleSheet.create({
  screen: { gap: 28 }, heading: { gap: 22 }, headingWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headingCopy: { gap: 10, flexShrink: 1 },
  eyebrow: { fontFamily: fonts.annotation, fontSize: 10, letterSpacing: 1.5, color: palette.olive }, title: { fontFamily: fonts.editorial, fontSize: 48, lineHeight: 54, letterSpacing: -1.8, color: palette.ink }, body: { fontSize: 15, lineHeight: 23, color: palette.muted }, small: { fontSize: 12, lineHeight: 19, color: palette.muted },
  overview: { gap: 20 }, overviewWide: { flexDirection: 'row', alignItems: 'stretch' }, metrics: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }, metric: { paddingHorizontal: 24, gap: 3 }, metricBorder: { borderLeftWidth: 1, borderColor: palette.line }, metricValue: { fontFamily: fonts.editorial, fontSize: 30, color: palette.ink },
  care: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, backgroundColor: palette.sage, borderRadius: 18, minHeight: 96 }, careMark: { minWidth: 44, minHeight: 44, borderRadius: 22, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center', padding: 8 }, careNumber: { fontSize: 20, color: palette.olive }, careCopy: { flex: 1, gap: 5 }, careTitle: { fontSize: 15, fontWeight: '600', color: palette.ink }, arrow: { fontSize: 21, color: palette.olive },
  tools: { gap: 16 }, sectionHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, sectionTitle: { fontFamily: fonts.editorial, fontSize: 28, color: palette.ink },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: 12, paddingLeft: 16 }, searchIcon: { fontSize: 26, color: palette.olive }, searchInput: { flex: 1, minWidth: 0, padding: 14, paddingLeft: 0, minHeight: 50, color: palette.ink, fontSize: 16 }, clear: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', gap: 8, paddingVertical: 2 }, chip: { minHeight: 44, justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface }, chipActive: { backgroundColor: palette.forest, borderColor: palette.forest }, chipText: { color: palette.olive, fontSize: 13 }, chipActiveText: { color: palette.surface },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }, sortButton: { minHeight: 44, justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 2 }, sortText: { fontSize: 13, color: palette.olive },
  empty: { backgroundColor: palette.surface, borderRadius: 24, padding: 28, alignItems: 'center', gap: 20, borderWidth: 1, borderColor: palette.line }, emptyPhoto: { width: '100%', maxWidth: 300, height: 210, borderRadius: 100 }, emptyTitle: { fontFamily: fonts.editorial, fontSize: 30, color: palette.ink, textAlign: 'center' }, emptyText: { maxWidth: 460, textAlign: 'center' }, noResults: { gap: 16, paddingVertical: 28, alignItems: 'flex-start' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 }, card: { overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface }, cardPhoto: { aspectRatio: 4 / 3 }, cardCopy: { padding: 20, gap: 7 }, cardHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, room: { fontSize: 12, color: palette.olive }, plantName: { fontFamily: fonts.editorial, fontSize: 26, color: palette.ink }, status: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: palette.sage }, statusDue: { backgroundColor: palette.terracotta }, statusText: { fontSize: 11, color: palette.olive }, statusDueText: { color: palette.onTerracotta }, caption: { fontSize: 10, lineHeight: 16, color: palette.muted, marginTop: 4 },
});
