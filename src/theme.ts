import { Platform } from 'react-native';

// Botanical palette shared by the collection, account and photo tools.
export const palette = {
  paper: '#F7F3E8', surface: '#FFFCF5', olive: '#666744',
  ink: '#343C2B', muted: '#73745D', line: '#D8D4BF',
  sage: '#E9E9D8', forest: '#344636', terracotta: '#A75E43',
};
export const fonts = {
  editorial: Platform.select({ web: 'Georgia, serif', ios: 'Georgia', default: 'serif' }),
  annotation: Platform.select({ web: 'monospace', ios: 'Menlo', default: 'monospace' }),
};
export const botanicalPhoto = require('../assets/monstera.jpg');
