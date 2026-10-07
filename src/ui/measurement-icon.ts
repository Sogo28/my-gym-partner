import type { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * L'icône d'une mesure, d'après son unité : c'est elle qui dit ce qu'on
 * mesure, quel que soit le nom qu'on lui a donné -- une mesure créée à la
 * main en secondes est une durée comme les autres.
 */
export function measurementIcon(unit: string): IconName {
  switch (unit) {
    case 's':
      return 'time-outline';
    case 'kg':
      return 'barbell-outline';
    case 'reps':
      return 'repeat-outline';
    case 'm':
    case 'km':
      return 'navigate-outline';
    default:
      return 'speedometer-outline';
  }
}
