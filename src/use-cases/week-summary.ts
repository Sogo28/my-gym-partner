import { findAll as findAllExercises } from '../infra/exercise-repository';
import { findExercisesWorkedSince } from '../infra/exercise-history';

export type WeekSummary = {
  /** Les muscles visés par au moins un exercice travaillé cette semaine. */
  readonly primaryMuscleIds: readonly string[];
  /** Ceux qui n'ont travaillé qu'en soutien. */
  readonly secondaryMuscleIds: readonly string[];
  readonly exerciseCount: number;
};

/** Lundi zéro heure : la semaine d'entraînement commence là. */
export function startOfWeek(now: Date): Date {
  const start = new Date(now);
  // getDay() rend 0 pour dimanche : on le ramène en fin de semaine.
  const weekday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - weekday);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Ce que la semaine a travaillé, muscle par muscle.
 *
 * Les rôles sont ceux des exercices : un muscle visé par l'un d'eux est visé
 * pour la semaine, même s'il n'a soutenu que dans les autres. Compter les
 * séries pour en faire une échelle donnerait une précision que ces quelques
 * séances n'ont pas.
 */
export async function summarizeWeek(now: Date): Promise<WeekSummary> {
  const workedIds = new Set(await findExercisesWorkedSince(startOfWeek(now)));
  const worked = (await findAllExercises()).filter((exercise) => workedIds.has(exercise.id));

  return {
    primaryMuscleIds: worked
      .map((exercise) => exercise.primaryMuscleId)
      .filter((id): id is string => id !== null),
    secondaryMuscleIds: worked.flatMap((exercise) => exercise.secondaryMuscleIds),
    exerciseCount: worked.length,
  };
}
