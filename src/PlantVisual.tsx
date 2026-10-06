import React, { useState } from 'react';
import { Image, View, Text, Linking, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { botanicalFor, botanicalLabel, validBotanicalImage, preferredPhotoMode, type BotanicalImage, type PhotoMode, type PhotoFit } from './botanical';
import { palette, useReadableStyles } from './theme';

const images = {
  monstera: require('../assets/botanical/monstera.jpg'),
  aloe: require('../assets/botanical/aloe.jpg'),
  ficus: require('../assets/botanical/ficus.jpg'),
  fern: require('../assets/botanical/fern.jpg'),
};

export function PlantVisual({ plant, style }: {
  plant: { species: string; photo?: string; photoMode?: PhotoMode; photoFit?: PhotoFit; botanicalImage?: BotanicalImage };
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useReadableStyles(baseStyles);
  const personal = preferredPhotoMode(plant) === 'personal';
  const botanical = botanicalFor(plant.species);
  const [failedUrl, setFailedUrl] = useState('');
  const reference = !personal && botanical.decorative && validBotanicalImage(plant.botanicalImage) ? plant.botanicalImage : undefined;
  const remote = reference && reference.url !== failedUrl;
  const usePhoto = personal || (!remote && botanical.decorative && !!plant.photo);
  return <View><View style={[styles.frame, style]}><Image
      source={remote ? { uri: reference.url } : usePhoto ? { uri: plant.photo } : images[botanical.key]}
      resizeMode={usePhoto ? plant.photoFit ?? 'contain' : 'contain'}
      accessibilityLabel={usePhoto ? `Photo personnelle : ${plant.species}` : botanicalLabel(plant)}
      onError={() => { if (remote) setFailedUrl(reference.url); }}
      style={StyleSheet.absoluteFill}
    /></View>
    {remote && <Text style={styles.credit}>Photo : {reference.author || 'source plant.id'} · {reference.license}
      {reference.licenseUrl && <Text accessibilityRole="link" style={styles.link} onPress={() => void Linking.openURL(reference.licenseUrl!)}> · Licence ↗</Text>}
    </Text>}
    {!!reference && !remote && <Text style={styles.credit}>Image de référence indisponible. {plant.photo ? 'Votre photo est affichée.' : 'Composition décorative affichée.'}</Text>}
  </View>;
}

const baseStyles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 4 / 3, backgroundColor: palette.paper, overflow: 'hidden' },
  credit: { padding: 8, fontSize: 10, lineHeight: 16, color: palette.muted }, link: { textDecorationLine: 'underline' },
});
