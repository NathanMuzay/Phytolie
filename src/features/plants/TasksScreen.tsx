import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useAccessibility } from '../../shared/accessibility/AccessibilityProvider';
import { PlantVisual } from './PlantVisual';
import { daysUntil, dueDate, type Plant } from '../../shared/model';
import { wateringPlan } from './irrigation';
import { wateringTolerance } from './tolerance';
import { ActionButton as Action } from '../../shared/ui/ActionButton';
import { fonts, palette, useReadableStyles } from '../../shared/ui/theme';

const dateLabel = (date: Date) => date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
type Props = {
  plants: Plant[];
  disabled: boolean;
  onWatered: (plant: Plant) => void;
  onObserve: (plant: Plant, moisture: 'dry' | 'moist') => void;
  onOpenPlant: (plant: Plant) => void;
  onAddPlant: () => void;
};

function CareCard({ plant, disabled, onWatered, onObserve, onOpenPlant }: Pick<Props, 'disabled' | 'onWatered' | 'onObserve' | 'onOpenPlant'> & { plant: Plant }) {
  const styles = useReadableStyles(baseStyles);
  const [expanded, setExpanded] = useState(false);
  const { width } = useWindowDimensions();
  const { settings } = useAccessibility();
  const compact = width < 360 || settings.textScale >= 1.5;
  const plan = wateringPlan(plant);
  const tolerance = wateringTolerance(plant);
  const overdue = daysUntil(plan.nextCheck) < 0;
  return <View style={styles.careCard}>
    <View style={[styles.cardHeading, compact && { flexDirection: 'column' }]}>
      <View style={[styles.thumbnail, width < 480 && { width: 64 }]}><PlantVisual plant={plant} style={styles.thumbnailFrame} /></View>
      <View style={styles.plantCopy}>
        <View style={styles.badgeRow}><Text style={[styles.badge, overdue && styles.overdueBadge]}>{overdue ? 'Vérification en retard' : 'À vérifier aujourd’hui'}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir la fiche de ${plant.name}`} onPress={() => onOpenPlant(plant)} style={styles.plantLink}>
          <Text style={styles.plantName}>{plant.name} <Text style={styles.arrow}>↗</Text></Text>
        </Pressable>
        <Text style={styles.small}>{[plant.species, plant.room].filter(Boolean).join(' · ')}</Text>
        <Text style={styles.small}>{plant.lastWatered ? `Dernier arrosage le ${dateLabel(new Date(plant.lastWatered))}` : 'Premier arrosage à renseigner'}</Text>
      </View>
    </View>
    <View style={styles.careHint}>
      <View style={styles.hintCopy}><Text style={styles.hintTitle}>D’abord, vérifiez le terreau.</Text><Text style={styles.small}>Arrosez seulement s’il a besoin d’eau.</Text></View>
      {plan.amount > 0 && <View style={styles.dose}><Text style={styles.doseNumber}>{plan.amount} <Text style={styles.doseUnit}>ml</Text></Text><Text style={styles.doseCaption}>dose indicative</Text></View>}
    </View>
    <View style={styles.actions}>
      <Action title="J’ai arrosé" disabled={disabled || (!!plant.lastWatered && daysUntil(new Date(plant.lastWatered)) === 0)} onPress={() => onWatered(plant)} />
      <Action title="Encore humide · demain" secondary disabled={disabled} onPress={() => onObserve(plant, 'moist')} />
    </View>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${expanded ? 'Masquer' : 'Afficher'} les conseils pour ${plant.name}`} onPress={() => setExpanded(value => !value)} style={styles.disclosure}>
      <Text style={styles.disclosureText}>{expanded ? 'Masquer les conseils' : 'Conseils et détails'}</Text><Text style={styles.disclosureText}>{expanded ? '−' : '+'}</Text>
    </Pressable>
    {expanded && <View style={styles.details}>
      <Text style={styles.small}>{plan.instruction}</Text>
      <Text style={styles.small}>Vérification tous les {plan.interval} jours · échéance le {dateLabel(plan.nextCheck)}.</Text>
      <Text style={styles.hintTitle}>Marge de retard indicative</Text>
      <Text style={styles.small}>{tolerance.message}</Text>
      {tolerance.deadline && <Text style={styles.small}>Limite indicative : {tolerance.deadline.toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}{tolerance.hours ? ` · marge de ${tolerance.hours} h` : ''}.</Text>}
      <Text style={styles.small}>Ne compensez pas un retard par une dose plus forte.</Text>
      {plan.reasons.map(reason => <Text key={reason} style={styles.small}>{reason}</Text>)}
      {plant.irrigation?.checkedAt && <Text style={styles.small}>Terreau déclaré {plant.irrigation.moisture === 'moist' ? 'humide' : 'sec'} le {dateLabel(new Date(plant.irrigation.checkedAt))}.</Text>}
      {!!plant.caretaker && <Text style={styles.small}>Référent : {plant.caretaker}</Text>}
      <Action title="Terreau sec" secondary disabled={disabled} onPress={() => onObserve(plant, 'dry')} />
    </View>}
  </View>;
}

export function TasksScreen({ plants: allPlants, disabled, onWatered, onObserve, onOpenPlant, onAddPlant }: Props) {
  const styles = useReadableStyles(baseStyles);
  const { width } = useWindowDimensions();
  const { settings } = useAccessibility();
  const plants = allPlants.filter(plant => !plant.archivedAt);
  const twoColumns = width >= 1100 && settings.textScale < 1.5;
  const due = plants.filter(plant => daysUntil(dueDate(plant)) <= 0);
  const upcoming = plants.filter(plant => daysUntil(dueDate(plant)) > 0);
  const repotting = [...plants].sort((a, b) => Date.parse(a.repotDate) - Date.parse(b.repotDate));
  const repotDue = repotting.filter(plant => daysUntil(new Date(plant.repotDate)) <= 0).length;
  return <View style={styles.screen}>
    <View style={styles.intro}>
      <Text style={styles.eyebrow}>LE RITUEL DES PLANTES</Text>
      <Text accessibilityRole="header" style={styles.title}>À faire</Text>
      <Text style={styles.introText}>Un peu d’attention, et vos plantes se portent bien.</Text>
    </View>
    <View style={styles.summary}>
      <View style={styles.summaryLead}><Text style={styles.summaryNumber}>{String(due.length).padStart(2, '0')}</Text><View style={styles.summaryCopy}><Text style={styles.summaryTitle}>{due.length ? `plante${due.length > 1 ? 's' : ''} à vérifier` : 'Tout est à jour'}</Text><Text style={styles.small}>Aujourd’hui · {dateLabel(new Date())}</Text></View></View>
      <View style={styles.summaryMeta}><Text style={styles.summaryMetaNumber}>{upcoming.length}</Text><Text style={styles.small}>à venir</Text></View>
      <View style={styles.summaryMeta}><Text style={styles.summaryMetaNumber}>{repotDue}</Text><Text style={styles.small}>rempotage{repotDue > 1 ? 's' : ''} à vérifier</Text></View>
    </View>
    <View style={[styles.layout, twoColumns && styles.layoutWide]}>
      <View style={styles.main}>
        <View style={styles.sectionHeading}><Text accessibilityRole="header" style={styles.sectionTitle}>Aujourd’hui</Text><Text style={styles.count}>{due.length}</Text></View>
        {due.map(plant => <CareCard key={plant.id} plant={plant} disabled={disabled} onWatered={onWatered} onObserve={onObserve} onOpenPlant={onOpenPlant} />)}
        {!due.length && <View style={styles.empty}>
          <View style={styles.emptyMark}><Text style={styles.emptyMarkText}>✓</Text></View>
          <Text style={styles.emptyTitle}>{plants.length ? 'Votre jardin peut souffler.' : 'Votre rituel commence ici.'}</Text>
          <Text style={styles.emptyText}>{plants.length ? 'Aucune vérification prévue aujourd’hui. Retrouvez les prochaines dates dans votre agenda.' : 'Ajoutez une plante pour retrouver ici ses prochains soins.'}</Text>
          <Action title={plants.length ? 'Voir mes plantes ↗' : 'Ajouter une plante ↗'} disabled={disabled} onPress={onAddPlant} secondary />
        </View>}
      </View>
      <View style={[styles.agenda, twoColumns && styles.agendaWide]}>
        <View style={styles.agendaPanel}>
          <Text style={styles.eyebrow}>VOTRE AGENDA</Text>
          <View style={styles.sectionHeading}><Text accessibilityRole="header" style={styles.sectionTitle}>À venir</Text><Text style={styles.count}>{upcoming.length}</Text></View>
          <Text style={styles.small}>Les prochaines vérifications du terreau.</Text>
          {upcoming.map(plant => {
            const date = dueDate(plant);
            return <Pressable key={plant.id} accessibilityRole="button" accessibilityLabel={`Ouvrir ${plant.name}, vérification le ${dateLabel(date)}`} onPress={() => onOpenPlant(plant)} style={({ pressed }) => [styles.agendaRow, pressed && { opacity: .5 }]}>
              <View style={styles.calendarDate}><Text style={styles.calendarDay}>{date.getDate()}</Text><Text style={styles.calendarMonth}>{date.toLocaleDateString('fr-FR', { month: 'short' })}</Text></View>
              <View style={styles.agendaCopy}><Text style={styles.agendaName}>{plant.name}</Text><Text style={styles.small}>{plant.room} · {daysUntil(date) === 1 ? 'demain' : `dans ${daysUntil(date)} jours`}</Text></View><Text style={styles.arrow}>↗</Text>
            </Pressable>;
          })}
          {!upcoming.length && <Text style={styles.agendaEmpty}>Aucune vérification à venir pour le moment.</Text>}
        </View>
        <View style={styles.agendaPanel}>
          <Text style={styles.eyebrow}>PRENDRE RACINE</Text>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Rempotage</Text>
          <Text style={styles.small}>Un repère pour vérifier la place des racines.</Text>
          {repotting.map(plant => <Pressable key={plant.id} accessibilityRole="button" accessibilityLabel={`Ouvrir ${plant.name}, rempotage à vérifier le ${dateLabel(new Date(plant.repotDate))}`} onPress={() => onOpenPlant(plant)} style={({ pressed }) => [styles.agendaRow, pressed && { opacity: .5 }]}>
            <View style={styles.agendaCopy}><Text style={styles.agendaName}>{plant.name}</Text><Text style={styles.small}>{dateLabel(new Date(plant.repotDate))}</Text></View>
            {daysUntil(new Date(plant.repotDate)) <= 0 ? <Text style={styles.repotBadge}>À vérifier</Text> : <Text style={styles.arrow}>↗</Text>}
          </Pressable>)}
          {!repotting.length && <Text style={styles.agendaEmpty}>Les dates apparaîtront après l’ajout d’une plante.</Text>}
        </View>
      </View>
    </View>
  </View>;
}

const baseStyles = StyleSheet.create({
  screen: { gap: 30 }, intro: { gap: 10 },
  eyebrow: { fontFamily: fonts.annotation, fontSize: 10, letterSpacing: 1.6, color: palette.olive },
  title: { fontFamily: fonts.editorial, fontSize: 58, lineHeight: 66, letterSpacing: -2, color: palette.ink },
  introText: { fontSize: 16, lineHeight: 24, color: palette.muted },
  summary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 24, padding: 24, borderRadius: 20, backgroundColor: palette.sage },
  summaryLead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18, flexGrow: 1, flexShrink: 1, maxWidth: '100%', minWidth: 0 },
  summaryCopy: { gap: 5, flexShrink: 1, minWidth: 0, maxWidth: '100%' }, summaryNumber: { fontFamily: fonts.editorial, fontSize: 56, lineHeight: 64, color: palette.forest },
  summaryTitle: { fontFamily: fonts.editorial, fontSize: 24, color: palette.ink },
  summaryMeta: { paddingLeft: 22, borderLeftWidth: 1, borderColor: palette.olive, gap: 4, flexShrink: 1 },
  summaryMetaNumber: { fontFamily: fonts.editorial, fontSize: 28, color: palette.ink },
  layout: { gap: 28 }, layoutWide: { flexDirection: 'row', alignItems: 'flex-start' },
  main: { flex: 1, minWidth: 0, gap: 18 }, agenda: { gap: 20 }, agendaWide: { width: 320 },
  sectionHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionTitle: { fontFamily: fonts.editorial, fontSize: 27, color: palette.ink },
  count: { fontFamily: fonts.annotation, fontSize: 12, color: palette.olive, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: palette.line },
  careCard: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: 20, padding: 22, gap: 18 },
  cardHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 18 },
  thumbnail: { width: 88, flexShrink: 0 }, thumbnailFrame: { aspectRatio: 1, borderRadius: 14 },
  plantCopy: { flex: 1, minWidth: 0, gap: 4, alignSelf: 'stretch' }, badgeRow: { flexDirection: 'row', flexWrap: 'wrap' },
  badge: { color: palette.olive, fontSize: 11, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 5, backgroundColor: palette.paper, borderRadius: 8 },
  overdueBadge: { borderLeftWidth: 3, borderColor: palette.terracotta },
  plantLink: { minHeight: 44, justifyContent: 'center' }, plantName: { fontFamily: fonts.editorial, fontSize: 27, color: palette.ink }, arrow: { fontSize: 18, color: palette.olive },
  small: { fontSize: 12, lineHeight: 19, color: palette.muted },
  careHint: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18, padding: 16, borderRadius: 12, backgroundColor: palette.paper },
  hintCopy: { flexGrow: 1, flexShrink: 1, gap: 4 }, hintTitle: { fontSize: 14, fontWeight: '600', lineHeight: 21, color: palette.ink },
  dose: { gap: 2 }, doseNumber: { fontFamily: fonts.editorial, fontSize: 25, color: palette.olive }, doseUnit: { fontSize: 14 }, doseCaption: { fontSize: 10, color: palette.muted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  disclosure: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 44, paddingTop: 10, borderTopWidth: 1, borderColor: palette.line },
  disclosureText: { fontSize: 12, color: palette.olive, flexShrink: 1 }, details: { gap: 12 },
  agendaPanel: { backgroundColor: palette.surface, borderRadius: 18, borderWidth: 1, borderColor: palette.line, padding: 20, gap: 14 },
  agendaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingVertical: 14, borderTopWidth: 1, borderColor: palette.line, minHeight: 64 },
  calendarDate: { width: 44, paddingVertical: 7, alignItems: 'center', borderRadius: 10, backgroundColor: palette.paper },
  calendarDay: { fontFamily: fonts.editorial, fontSize: 23, color: palette.ink }, calendarMonth: { fontFamily: fonts.annotation, fontSize: 9, color: palette.olive },
  agendaCopy: { flex: 1, minWidth: 90, gap: 4 }, agendaName: { fontFamily: fonts.editorial, fontSize: 20, color: palette.ink },
  repotBadge: { fontSize: 10, color: palette.olive, backgroundColor: palette.paper, borderRadius: 6, padding: 7 },
  agendaEmpty: { color: palette.muted, fontSize: 12, lineHeight: 20, paddingVertical: 14, borderTopWidth: 1, borderColor: palette.line },
  empty: { backgroundColor: palette.surface, borderRadius: 20, borderWidth: 1, borderColor: palette.line, padding: 30, alignItems: 'flex-start', gap: 18 },
  emptyMark: { width: 52, height: 52, borderRadius: 26, backgroundColor: palette.sage, alignItems: 'center', justifyContent: 'center' },
  emptyMarkText: { fontSize: 24, color: palette.forest }, emptyTitle: { fontFamily: fonts.editorial, fontSize: 30, color: palette.ink }, emptyText: { color: palette.muted, fontSize: 14, lineHeight: 23, maxWidth: 380 },
});
