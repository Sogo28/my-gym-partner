import type { ComponentType } from 'react';
import { Platform, UIManager } from 'react-native';

export type LottieProps = {
  source: object;
  autoPlay?: boolean;
  loop?: boolean;
  resizeMode?: 'cover' | 'contain' | 'center';
  style?: object;
  onAnimationFinish?: (isCancelled: boolean) => void;
};

/**
 * Le lecteur d'animations Lottie, chargé SANS le supposer présent : il est
 * natif, et une application construite avant lui ne le porte pas. `null`
 * quand il manque -- ou sur le web, qui ne sert qu'à regarder les écrans --,
 * et chaque animation prévoit alors de quoi s'en passer.
 */
export const LottieView: ComponentType<LottieProps> | null = (() => {
  if (Platform.OS === 'web') return null;
  // La vue native doit être DANS l'application : l'absence d'un composant
  // natif ne se révèle qu'au premier affichage, par un plantage.
  if (!UIManager.hasViewManagerConfig?.('LottieAnimationView')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('lottie-react-native').default as ComponentType<LottieProps>;
  } catch {
    return null;
  }
})();
