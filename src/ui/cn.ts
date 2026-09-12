import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Les rôles de notre échelle typographique (voir `tailwind.config.js`).
 *
 * Ils doivent être répétés ICI parce que tailwind-merge ne lit pas la
 * configuration de Tailwind : il range les classes par nom. `text-` désigne
 * aussi bien une taille qu'une couleur, et sans cette liste il classait
 * `text-micro` parmi les COULEURS -- puis, voyant `text-muted` juste après,
 * il supprimait la taille comme un doublon.
 *
 * Conséquence, longtemps invisible : tout composant passant une taille ET une
 * couleur par `cn()` perdait sa taille et retombait sur celle par défaut de
 * React Native. Une pastille de 10 pixels s'affichait ainsi plus grosse que
 * le titre de 13 qu'elle annotait.
 */
const FONT_SIZES = [
  'micro',
  'caption',
  'label',
  'small',
  'body',
  'lead',
  'strong',
  'heading',
  'value',
  'title',
  'display',
  'timer',
];

const merge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: FONT_SIZES }] } },
});

/**
 * Fusionne des classes Tailwind en laissant la dernière gagner.
 *
 * cn('py-4', 'py-6') donne 'py-6' : sans ça, les deux classes coexisteraient
 * et le résultat dépendrait de l'ordre de génération. C'est ce qui permet à un
 * composant d'accepter un className qui écrase ses propres styles.
 */
export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
