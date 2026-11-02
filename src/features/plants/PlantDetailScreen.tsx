import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useAccessibility } from '../../shared/accessibility/AccessibilityProvider';
import { daysUntil, type Caretaker, type Plant } from '../../shared/model';
import { ActionButton } from '../../shared/ui/ActionButton';
import { fonts, palette, useReadableStyles } from '../../shared/ui/theme';
import { ExposureDetails } from '../home/HomeScreen';
import { estimatePlacement, type HomePlan } from '../home/home';
import { LightSummary } from '../light/LightMeasure';
import { botanicalLabel, preferredPhotoMode } from './botanical';
import { wateringPlan } from './irrigation';
import { PlantVisual } from './PlantVisual';
import { wateringTolerance } from './tolerance';

const dateLabel = (date: Date) => date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
const fullDate = (value: string) => new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
type Props = {
  plant: Plant;
  home?: HomePlan;
  caretaker?: Caretaker;
  disabled: boolean;
  onBack: () => void;
  onEdit: () => void;
  onPlan: () => void;
  onCaretaker: () => void;
  onWatered: () => void;
  onObserve: (moisture: 'dry' | 'moist') => void;
  onDelete: () => void;
};

function DetailSection({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  const styles = useReadableStyles(baseStyles);
  const [expanded, setExpanded] = useState(false);
  return <View style={styles.detailSection}>
    <Pressable accessibilityRole="button" accessibilityLabel={title} aria-expanded={expanded} accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)}
      style={({ pressed }) => [styles.disclosure, pressed && { opacity: .65 }]}>
      <View style={styles.disclosureCopy}><Text style={styles.disclosureTitle}>{title}</Text><Text style={styles.small}>{summary}</Text></View>
      <Text accessible={false} style={styles.disclosureMark}>{expanded ? '−' : '+'}</Text>
    </Pressable>
    {expanded && <View style={styles.disclosureContent}>{children}</View>}
  </View>;
}
function Fact({ label, value }: { label: string; value: string }) {
  const styles = useReadableStyles(baseStyles);
  return <View style={styles.fact}><Text style={styles.small}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>;
}

export function PlantDetailScreen({ plant, home, caretaker, disabled, onBack, onEdit, onPlan, onCaretaker, onWatered, onObserve, onDelete }: Props) {
  const styles = useReadableStyles(baseStyles);
  const { width } = useWindowDimensions();
  const { settings } = useAccessibility();
  const twoColumns = Platform.OS === 'web' && width >= 1000 && settings.textScale < 1.5;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const plan = wateringPlan(plant);
  const tolerance = wateringTolerance(plant);
  const days = daysUntil(plan.nextCheck);
  const wateredToday = !!plant.lastWatered && daysUntil(new Date(plant.lastWatered)) === 0;
  const exposure = home && plant.position ? estimatePlacement(home, plant.position, plant.species) : null;
  const lightSummary = exposure?.score != null ? `Compatibilité estimée : ${exposure.score}/100` : plant.lightReading ? 'Un relevé de lumière enregistré' : 'Estimation à compléter';
  const photoLabel = preferredPhotoMode(plant) === 'personal' ? 'Votre photo personnelle' : botanicalLabel(plant).replace(`${plant.species} · `, '');
  const identity = <View style={styles.identity}>
    <View style={styles.roomChip}><Text style={styles.roomText}>{plant.room}</Text></View>
    <Text accessibilityRole="header" style={styles.title}>{plant.name}</Text>
    {plant.species.trim().toLocaleLowerCase('fr') !== plant.name.trim().toLocaleLowerCase('fr') && <Text style={styles.species}>{plant.species}</Text>}
  </View>;
  return <View style={styles.screen}>
    <View style={styles.toolbar}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}><Text style={styles.backText}>← Mes plantes</Text></Pressable>
      <ActionButton title="Modifier la fiche" secondary disabled={disabled} onPress={onEdit} />
    </View>
    {!twoColumns && identity}
    <View style={[styles.hero, twoColumns && styles.heroWide]}>
      <View style={[styles.photoPanel, twoColumns && styles.photoWide]}><PlantVisual plant={plant} style={{ height: twoColumns ? 330 : 200, aspectRatio: undefined }} /><Text style={styles.photoLabel}>{photoLabel}</Text></View>
      <View style={[styles.heroCopy, twoColumns && styles.heroCopyWide]}>
        {twoColumns && identity}
        <View style={styles.nextCare}>
          <View style={styles.careHeading}><Text style={styles.eyebrow}>PROCHAINE VÉRIFICATION</Text><Text style={[styles.status, days <= 0 && styles.statusDue]}>{days < 0 ? `Retard de ${Math.abs(days)} j` : days === 0 ? 'Aujourd’hui' : days === 1 ? 'Demain' : `Dans ${days} jours`}</Text></View>
          <Text style={styles.careDate}>{dateLabel(plan.nextCheck)}</Text>
          <Text style={styles.body}>{plan.instruction}</Text>
          {plan.amount > 0 && <Text style={styles.dose}>{plan.amount} ml indicatifs · seulement si le terreau a besoin d’eau</Text>}
        </View>
        <View style={[styles.actions, !twoColumns && { flexDirection: 'column', flexWrap: 'nowrap', width: '100%' }]}>
          <ActionButton title={wateredToday ? 'Arrosage enregistré aujourd’hui' : 'J’ai arrosé'} fullWidth={!twoColumns} disabled={disabled || wateredToday} onPress={onWatered} />
          <ActionButton title="Terreau encore humide" secondary fullWidth={!twoColumns} disabled={disabled} onPress={() => onObserve('moist')} />
        </View>
        <Text style={styles.small}>{plant.lastWatered ? `Dernier arrosage : ${fullDate(plant.lastWatered)}` : 'Aucun arrosage enregistré pour le moment.'}</Text>
      </View>
    </View>
    <View style={styles.stats}>
      {[
        ['Hauteur', `${plant.height} cm`], ['Diamètre du pot', `${plant.pot} cm`], ['Température', `${plant.temperature} °C`],
      ].map(([label, value]) => <View key={label} style={[styles.stat, settings.textScale >= 1.5 && { minWidth: 180 }]}><Text style={styles.small}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>)}
    </View>
    <View style={[styles.detailsLayout, twoColumns && styles.detailsWide]}>
      <View style={[styles.essentials, twoColumns && styles.essentialsWide]}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Ses repères</Text>
        <Fact label="Terreau conseillé" value={plant.soil || 'À renseigner'} />
        <Fact label="Rythme de vérification" value={`Tous les ${plan.interval} jours`} />
        <Fact label="Rempotage à vérifier" value={fullDate(plant.repotDate)} />
        <Text style={styles.small}>Ces repères sont indicatifs. L’état du terreau guide toujours l’arrosage.</Text>
      </View>
      <View style={styles.sections}>
        <DetailSection title="Comprendre l’arrosage" summary="Calcul, observations et marge de retard">
          {!!plant.irrigation?.checkedAt && <Text style={styles.body}>Dernière observation : terreau {plant.irrigation.moisture === 'moist' ? 'humide' : 'sec'}, le {fullDate(plant.irrigation.checkedAt)}.</Text>}
          <ActionButton title="Signaler un terreau sec" secondary disabled={disabled} onPress={() => onObserve('dry')} />
          <Text style={styles.detailHeading}>Comment le conseil est calculé</Text>
          {plan.reasons.map(reason => <Text key={reason} style={styles.body}>{reason}</Text>)}
          {!!plant.wateringAdvice && <><Text style={styles.detailHeading}>Conseil de plant.id</Text><Text style={styles.body}>{plant.wateringAdvice}</Text></>}
          <View style={styles.note}><Text style={styles.detailHeading}>Marge de retard indicative</Text><Text style={styles.body}>{tolerance.message}</Text>{tolerance.deadline && <Text style={styles.small}>Limite indicative : {tolerance.deadline.toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}{tolerance.hours != null ? ` · marge de ${tolerance.hours} h` : ''}.</Text>}<Text style={styles.small}>Ne compensez pas un retard par une dose plus forte.</Text></View>
        </DetailSection>
        <DetailSection title="Emplacement et lumière" summary={`${plant.room} · ${lightSummary}`}>
          {home && plant.position ? <ExposureDetails home={home} position={plant.position} species={plant.species} /> : <Text style={styles.body}>Placez votre plante sur le plan pour retrouver ici l’estimation de sa lumière.</Text>}
          {plant.lightReading && <LightSummary reading={plant.lightReading} />}
          <ActionButton title="Ouvrir le plan de ma maison" secondary onPress={onPlan} />
        </DetailSection>
        <DetailSection title="À propos de cette plante" summary={plant.family || plant.species}>
          <Fact label="Espèce" value={plant.species} />
          {!!plant.family && <Fact label="Famille" value={plant.family} />}
          {!!plant.description && <><Text style={styles.body}>{plant.description}</Text><Text style={styles.small}>Description fournie par plant.id.</Text></>}
          {plant.identificationSource === 'plant.id' && plant.identificationConfidence != null && <Text style={styles.small}>Identification plant.id · confiance {Math.round(plant.identificationConfidence * 100)} %</Text>}
          {plant.width != null && <Fact label="Largeur de la plante" value={`${plant.width} cm`} />}
          {plant.measurement && <Text style={styles.small}>Dimensions estimées sur photo le {fullDate(plant.measurement.measuredAt)}, avec un repère de {plant.measurement.referenceCm} cm.</Text>}
        </DetailSection>
        <DetailSection title="Historique des arrosages" summary={plant.history.length ? `${plant.history.length} arrosage${plant.history.length > 1 ? 's' : ''} enregistré${plant.history.length > 1 ? 's' : ''}` : 'Aucun arrosage enregistré'}>
          {plant.history.length ? plant.history.map((entry, index) => <View key={`${entry}-${index}`} style={styles.historyRow}><View style={styles.historyDot} /><View style={styles.historyCopy}><Text style={styles.factValue}>{fullDate(entry)}</Text><Text style={styles.small}>Arrosage confirmé à {new Date(entry).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text></View><Text style={styles.historyCheck}>✓</Text></View>) : <Text style={styles.body}>Vos prochains arrosages confirmés apparaîtront ici.</Text>}
        </DetailSection>
        {!!(caretaker || plant.caretaker) && <DetailSection title="Personne de confiance" summary={caretaker?.name || plant.caretaker}>
          {!!plant.caretaker && <Fact label="Note personnelle" value={plant.caretaker} />}
          {caretaker && <><Fact label="Contact" value={[caretaker.name, caretaker.phone, caretaker.email].filter(Boolean).join(' · ')} /><ActionButton title="Coordonnées et consignes" secondary onPress={onCaretaker} /></>}
        </DetailSection>}
      </View>
    </View>
    <View style={styles.footer}>
      {confirmDelete ? <View style={styles.deletePanel}><Text style={styles.detailHeading}>Supprimer {plant.name} ?</Text><Text style={styles.body}>Sa fiche et son historique seront supprimés définitivement.</Text><View style={styles.actions}><Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={onDelete} style={[styles.deleteButton, disabled && { opacity: .5 }]}><Text style={styles.deleteButtonText}>Confirmer la suppression</Text></Pressable><ActionButton title="Conserver la plante" secondary disabled={disabled} onPress={() => setConfirmDelete(false)} /></View></View> : <Pressable accessibilityRole="button" disabled={disabled} onPress={() => setConfirmDelete(true)} style={styles.deleteLink}><Text style={styles.deleteText}>Supprimer cette plante</Text></Pressable>}
    </View>
  </View>;
}

const baseStyles = StyleSheet.create({
  screen: { gap: 24 }, toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, back: { minHeight: 48, justifyContent: 'center', paddingVertical: 10, paddingRight: 12 }, backText: { fontSize: 14, color: palette.olive },
  identity: { gap: 10 }, roomChip: { alignSelf: 'flex-start', backgroundColor: palette.sage, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 }, roomText: { color: palette.olive, fontSize: 12 }, title: { fontFamily: fonts.editorial, color: palette.ink, fontSize: 40, lineHeight: 46, letterSpacing: -1.2 }, species: { fontSize: 15, fontStyle: 'italic', color: palette.muted, lineHeight: 22 },
  hero: { overflow: 'hidden', backgroundColor: palette.surface, borderRadius: 22, borderWidth: 1, borderColor: palette.line }, heroWide: { flexDirection: 'row', alignItems: 'stretch' }, photoPanel: { backgroundColor: palette.paper, justifyContent: 'center' }, photoWide: { flex: .9, minWidth: 0, padding: 20 }, photoLabel: { fontSize: 10, lineHeight: 16, textAlign: 'center', color: palette.muted, padding: 12 }, heroCopy: { padding: 20, gap: 18 }, heroCopyWide: { flex: 1.2, minWidth: 0, padding: 28, gap: 22 },
  nextCare: { gap: 10 }, careHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, eyebrow: { fontSize: 10, letterSpacing: 1.1, color: palette.olive, fontFamily: fonts.annotation }, status: { backgroundColor: palette.sage, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, color: palette.olive, fontSize: 11 }, statusDue: { backgroundColor: palette.terracotta, color: palette.onTerracotta }, careDate: { fontFamily: fonts.editorial, fontSize: 28, lineHeight: 34, color: palette.ink }, body: { color: palette.muted, fontSize: 14, lineHeight: 22 }, dose: { fontSize: 13, lineHeight: 21, color: palette.olive, fontWeight: '600' }, small: { fontSize: 12, lineHeight: 19, color: palette.muted }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, stat: { flexBasis: '25%', flexGrow: 1, minWidth: 80, padding: 16, gap: 6, borderRadius: 14, backgroundColor: palette.sage }, statValue: { fontFamily: fonts.editorial, fontSize: 24, color: palette.ink },
  detailsLayout: { gap: 24 }, detailsWide: { flexDirection: 'row', alignItems: 'flex-start' }, essentials: { backgroundColor: palette.surface, padding: 24, borderWidth: 1, borderColor: palette.line, borderRadius: 18, gap: 18 }, essentialsWide: { width: 320 }, sectionTitle: { fontFamily: fonts.editorial, fontSize: 26, color: palette.ink }, fact: { gap: 5 }, factValue: { color: palette.ink, fontSize: 14, lineHeight: 22 },
  sections: { flex: 1, minWidth: 0, gap: 12 }, detailSection: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: 16, overflow: 'hidden' }, disclosure: { minHeight: 80, flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 }, disclosureCopy: { flex: 1, minWidth: 0, gap: 6 }, disclosureTitle: { color: palette.ink, fontSize: 16, fontWeight: '600', lineHeight: 23 }, disclosureMark: { fontSize: 23, color: palette.olive }, disclosureContent: { padding: 20, paddingTop: 0, gap: 16 }, detailHeading: { color: palette.ink, fontSize: 14, lineHeight: 22, fontWeight: '600' }, note: { padding: 16, gap: 10, backgroundColor: palette.paper, borderRadius: 12 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderTopWidth: 1, borderColor: palette.line }, historyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.olive }, historyCopy: { flex: 1, minWidth: 0, gap: 3 }, historyCheck: { fontSize: 18, color: palette.olive },
  footer: { borderTopWidth: 1, borderColor: palette.line, paddingTop: 12 }, deleteLink: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', paddingVertical: 12 }, deleteText: { fontSize: 12, color: '#A33827' }, deletePanel: { paddingVertical: 12, gap: 14 }, deleteButton: { minHeight: 48, maxWidth: '100%', padding: 14, borderRadius: 12, backgroundColor: '#A33827', justifyContent: 'center' }, deleteButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
