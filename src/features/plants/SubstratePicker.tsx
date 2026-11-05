import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { ActionButton } from '../../shared/ui/ActionButton';
import { palette, useReadableStyles } from '../../shared/ui/theme';
import { catalogueSubstrate, substrateCatalogue, type SubstrateSelection, type SubstrateType } from './substrates';

export function SubstratePicker({ value, fallbackType = 'standard', disabled, onChange }: { value?: SubstrateSelection; fallbackType?: SubstrateType; disabled?: boolean; onChange: (value: SubstrateSelection) => void }) {
  const styles = useReadableStyles(baseStyles);
  const selection = value ?? catalogueSubstrate(fallbackType);
  const profile = substrateCatalogue[selection.type];
  const custom = selection.origin !== 'catalogue';
  const edit = (key: 'name' | 'composition' | 'productCode', text: string) => onChange({ ...selection, [key]: text });
  return <View style={styles.panel}>
    <Text accessibilityRole="header" style={styles.heading}>Substrat réellement utilisé</Text>
    {!value && <Text style={styles.small}>Composition non confirmée. Choisissez un profil ou décrivez votre mélange ; les exemples ne sont pas des recettes commerciales.</Text>}
    <View style={styles.row}>{(['catalogue', 'maison', 'code-inconnu'] as const).map(origin => <ActionButton key={origin} title={origin === 'catalogue' ? 'Profils de substrat' : origin === 'maison' ? 'Mélange maison' : 'Produit / code inconnu'} secondary={selection.origin !== origin} disabled={disabled} onPress={() => { if (value && selection.origin === origin) return; onChange(origin === 'catalogue' ? catalogueSubstrate(selection.type) : { ...selection, origin, source: 'Déclaration utilisateur', name: '', composition: '', productCode: undefined }); }} />)}</View>
    <Text style={styles.heading}>Rétention observée</Text>
    <View style={styles.row}>{(Object.keys(substrateCatalogue) as SubstrateType[]).map(type => <ActionButton key={type} title={`${selection.type === type ? '✓ ' : ''}${substrateCatalogue[type].name}`} secondary={selection.type !== type} disabled={disabled} onPress={() => onChange(custom ? { ...selection, type } : catalogueSubstrate(type))} />)}</View>
    {custom ? <>
      <Text style={styles.heading}>Nom du substrat</Text><TextInput accessibilityLabel="Nom du substrat" editable={!disabled} value={selection.name} onChangeText={text => edit('name', text)} maxLength={100} style={styles.input} />
      <Text style={styles.heading}>Composition ou description du mélange</Text><TextInput accessibilityLabel="Composition du substrat" editable={!disabled} multiline value={selection.composition} onChangeText={text => edit('composition', text)} maxLength={500} style={styles.input} />
      {selection.origin === 'code-inconnu' && <><Text style={styles.heading}>Référence ou code produit (facultatif)</Text><TextInput accessibilityLabel="Code produit du substrat" editable={!disabled} value={selection.productCode ?? ''} onChangeText={text => edit('productCode', text)} maxLength={64} style={styles.input} /><Text style={styles.small}>Ce code est conservé comme référence personnelle. La composition reste à renseigner manuellement.</Text></>}
      <Text style={styles.small}>Provenance : déclaration utilisateur. Choisissez le profil correspondant à votre mélange réel.</Text>
    </> : <Text style={styles.body}>{selection.composition}</Text>}
    <Text style={styles.body}>{profile.properties}</Text>
    <ActionButton title="Lire la source du profil ↗" secondary onPress={() => void Linking.openURL(profile.source)} />
  </View>;
}
const baseStyles = StyleSheet.create({ panel: { gap: 12 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, heading: { color: palette.ink, fontSize: 14, fontWeight: '600', lineHeight: 22 }, body: { color: palette.muted, fontSize: 14, lineHeight: 22 }, small: { color: palette.muted, fontSize: 12, lineHeight: 19 }, input: { borderWidth: 1, borderColor: palette.line, borderRadius: 10, padding: 14, color: palette.ink, backgroundColor: palette.surface, fontSize: 16, minHeight: 48 } });
