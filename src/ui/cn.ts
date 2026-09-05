import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Fusionne des classes Tailwind en laissant la dernière gagner.
 *
 * cn('py-4', 'py-6') donne 'py-6' : sans ça, les deux classes coexisteraient
 * et le résultat dépendrait de l'ordre de génération. C'est ce qui permet à un
 * composant d'accepter un className qui écrase ses propres styles.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
