import { useColorScheme } from 'react-native';

/**
 * Les couleurs par rôle, pour ce que la feuille de styles n'atteint pas.
 *
 * Une icône, une barre d'onglets, un contour posé en style direct reçoivent
 * leur couleur en propriété : la variante `dark:` de NativeWind ne les
 * concerne pas. Écrire le gris en dur dans chacun d'eux donnait celui du mode
 * sombre en mode clair aussi -- trop pâle sur fond clair.
 *
 * Les valeurs sont celles de `tailwind.config.js`, rôle pour rôle : changer
 * l'une, c'est changer l'autre.
 */
export const PALETTE = {
  light: {
    primary: '#BFF04A',
    primaryInk: '#46600F',
    primarySoft: '#E7F3C8',
    background: '#F6F7F3',
    surface: '#FFFFFF',
    surfaceAlt: '#EDEFE8',
    border: '#DDE0D6',
    borderStrong: '#C3C8B8',
    ink: '#14160F',
    muted: '#5F6459',
    planned: '#A8AD9E',
    success: '#1B7A45',
    danger: '#B3261E',
  },
  dark: {
    primary: '#BFF04A',
    primaryInk: '#BFF04A',
    primarySoft: '#232A16',
    background: '#0E0F0D',
    surface: '#191B17',
    surfaceAlt: '#141613',
    border: '#2A2D28',
    borderStrong: '#3A3F37',
    ink: '#F2F4EF',
    muted: '#8B9086',
    planned: '#8B9086',
    success: '#4FD68A',
    danger: '#FF7A66',
  },
} as const;

export type Palette = (typeof PALETTE)['light' | 'dark'];

/** Les couleurs du thème en cours, qui suit le réglage du téléphone. */
export function usePalette(): Palette {
  return PALETTE[useColorScheme() === 'dark' ? 'dark' : 'light'];
}
