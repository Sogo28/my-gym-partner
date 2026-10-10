import type { ComponentType } from 'react';
import type { LottieProps } from './lottie';

export type { LottieProps } from './lottie';

/**
 * Sur le web, pas de lecteur : le web ne sert qu'à regarder les écrans, et
 * la version web de lottie-react-native réclame un paquet qu'on n'installe
 * pas -- Metro refusait alors de construire l'app entière. Chaque animation
 * prévoit déjà de quoi s'en passer.
 */
export const LottieView: ComponentType<LottieProps> | null = null;
