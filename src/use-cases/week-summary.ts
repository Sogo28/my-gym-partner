import { findAll as findAllExercises } from '../infra/exercise-repository';
import { findExercisesWorkedBetween } from '../infra/exercise-history';
import { findWorkedDaysSince } from '../infra/session-history';

export type MuscleSummary = {
  /** Les muscles visés par au moins un exercice travaillé cette semaine. */
  readonly primaryMuscleIds: readonly string[];
  /** Ceux qui n'ont travaillé qu'en soutien. */
  readonly secondaryMuscleIds: readonly string[];
  readonly exerciseCount: number;
};

/** Le jour, à zéro heure, dans le fuseau du téléphone. */
export function startOfDay(moment: Date): Date {
  const start = new Date(moment);
  start.setHours(0, 0, 0, 0);
  return start;
}

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
 * Ce qu'un intervalle a travaillé, muscle par muscle.
 *
 * Les rôles sont ceux des exercices : un muscle visé par l'un d'eux est visé
 * pour la période, même s'il n'a soutenu que dans les autres. Compter les
 * séries pour en faire une échelle donnerait une précision que ces quelques
 * séances n'ont pas.
 */
export async function summarizeRange(from: Date, to: Date): Promise<MuscleSummary> {
  const workedIds = new Set(await findExercisesWorkedBetween(from, to));
  const worked = (await findAllExercises()).filter((exercise) => workedIds.has(exercise.id));

  return {
    primaryMuscleIds: worked
      .map((exercise) => exercise.primaryMuscleId)
      .filter((id): id is string => id !== null),
    secondaryMuscleIds: worked.flatMap((exercise) => exercise.secondaryMuscleIds),
    exerciseCount: worked.length,
  };
}

/** La semaine en cours, du lundi au dimanche suivant. */
export function summarizeWeek(now: Date): Promise<MuscleSummary> {
  const monday = startOfWeek(now);
  const next = new Date(monday);
  next.setDate(next.getDate() + 7);
  return summarizeRange(monday, next);
}

/** Le jour donné, de zéro heure à zéro heure. */
export function summarizeDay(day: Date): Promise<MuscleSummary> {
  const from = startOfDay(day);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return summarizeRange(from, to);
}

/** Les sept jours de la semaine en cours, du lundi au dimanche. */
export function weekDays(now: Date): Date[] {
  const monday = startOfWeek(now);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(day.getDate() + index);
    return day;
  });
}

/**
 * Les jours de la semaine où quelque chose a été validé.
 *
 * Ramenés à zéro heure et dédoublonnés : deux séances le même jour font un
 * seul carré, et la comparaison avec le calendrier se fait sur des dates
 * plutôt que sur des chaînes.
 */
export async function workedDays(now: Date): Promise<Date[]> {
  const starts = await findWorkedDaysSince(startOfWeek(now));
  const days = new Map<number, Date>();
  for (const start of starts) {
    const day = startOfDay(start);
    days.set(day.getTime(), day);
  }
  return [...days.values()];
}
