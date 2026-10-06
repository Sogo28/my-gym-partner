import type { ConditionResult } from '../domain/goal/evaluation';

/** Combien d'étapes une carte d'objectif montre au plus. */
export const VISIBLE_STEPS = 3;

/**
 * Les étapes qu'une carte d'objectif montre : la dernière franchie, celle en
 * cours, la suivante.
 *
 * Trois au plus, pour que toutes les cartes de la rangée aient la même
 * hauteur quelle que soit la longueur de leur progression -- la liste
 * complète vit sur la fiche de l'objectif. Au bord de la progression, la
 * fenêtre se décale plutôt que de rétrécir : sur la première étape, on voit
 * les deux suivantes ; sur la dernière, les deux d'avant.
 */
export function visibleSteps(count: number, current: number): number[] {
  const shown = Math.min(VISIBLE_STEPS, count);
  const first = Math.min(Math.max(current - 1, 0), count - shown);
  return Array.from({ length: shown }, (_, offset) => first + offset);
}

/**
 * La part déjà faite d'une condition, entre 0 et 1 : ce que la barre montre
 * pour un objectif simple.
 *
 * Seule une condition à ATTEINDRE (« au moins », « exactement ») se remplit
 * proportionnellement. Une condition à ne PAS dépasser -- un tour de taille
 * sous 80 cm -- n'a pas de moitié : elle tient, ou pas.
 */
export function conditionProgress(result: ConditionResult | undefined): number {
  if (!result) return 0;
  if (result.satisfied) return 1;

  const { operator, target } = result.condition;
  if (result.actual === null || target <= 0) return 0;
  if (operator === '>=' || operator === '>' || operator === '==') {
    return Math.min(Math.max(result.actual / target, 0), 1);
  }
  return 0;
}
