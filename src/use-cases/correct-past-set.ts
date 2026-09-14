import { findById, save } from '../infra/performance-repository';
import type { ValuesBySide } from '../domain/performance/exercise-performance';
import { DomainError } from '../domain/domain-error';

/**
 * Corriger une série d'une séance passée.
 *
 * La performance reste ce que l'utilisateur déclare avoir fait : une faute de
 * saisie doit pouvoir se réparer, même des semaines plus tard. L'agrégat
 * refuse en revanche de toucher à une série encore en cours, et vérifie que
 * les valeurs correspondent bien aux mesures de l'exercice.
 */
export async function correctPastSet(input: {
  performanceId: string;
  setIndex: number;
  values: ValuesBySide;
}): Promise<void> {
  const performance = await findById(input.performanceId);
  if (!performance) {
    throw new DomainError('Performance introuvable.');
  }

  performance.correctSetValues(input.setIndex, input.values);
  await save(performance);
}

/**
 * Retirer une série d'une séance passée -- un doublon, un exercice tapé par
 * erreur, que corriger les valeurs ne rattrape pas.
 */
export async function removePastSet(input: {
  performanceId: string;
  setIndex: number;
}): Promise<void> {
  const performance = await findById(input.performanceId);
  if (!performance) {
    throw new DomainError('Performance introuvable.');
  }

  performance.removeSet(input.setIndex);
  await save(performance);
}
