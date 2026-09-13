import type { Exercise } from '../domain/exercise/exercise';
import type { PerformanceSet } from '../domain/performance/exercise-performance';
import {
  bestByMeasurement,
  bestVolume,
  type PerformanceRecord,
} from '../domain/performance/records';
import type { Goal } from '../domain/goal/goal';
import { findAll as findAllExercises } from '../infra/exercise-repository';
import { findSessionsWorking } from '../infra/exercise-history';
import { findAll as findAllGoals } from '../infra/goal-repository';
import { findByIds } from '../infra/performance-repository';

/** Ce qu'une séance a produit sur CET exercice. */
export type ExerciseSessionEntry = {
  readonly sessionId: string;
  readonly startedAt: Date;
  /** Les mesures figées au moment de la performance (§2). */
  readonly measurementIds: readonly string[];
  /** Seules les séries validées : les autres ne sont pas des performances. */
  readonly sets: readonly PerformanceSet[];
};

export type ExerciseDetail = {
  readonly exercise: Exercise;
  /** De la plus récente à la plus ancienne. */
  readonly sessions: readonly ExerciseSessionEntry[];
  readonly records: readonly PerformanceRecord[];
  /** Null quand l'exercice ne porte qu'une mesure : il n'a pas de volume. */
  readonly volume: { value: number; at: Date } | null;
  /** Les objectifs dont une étape vise cet exercice. */
  readonly goals: readonly Goal[];
};

/**
 * Tout ce que l'écran de détail affiche d'un exercice, en une lecture.
 *
 * Rien n'est stocké : les records et l'historique se DÉRIVENT des séries
 * validées (§23). Les maintenir en double coûterait plus cher que les
 * recalculer, et ils se désaccorderaient à la première correction de série.
 */
export async function getExerciseDetail(exerciseId: string): Promise<ExerciseDetail | null> {
  const exercise = (await findAllExercises()).find((candidate) => candidate.id === exerciseId);
  if (!exercise) return null;

  const worked = await findSessionsWorking(exerciseId);
  // Toutes les performances en un appel, jamais une par séance.
  const performances = await findByIds(worked.flatMap((entry) => entry.performanceIds));

  const sessions: ExerciseSessionEntry[] = [];
  for (const entry of worked) {
    const own = entry.performanceIds
      .map((performanceId) => performances.get(performanceId))
      .filter((performance) => performance !== undefined);

    const sets = own.flatMap((performance) =>
      performance.sets.filter((set) => set.status === 'COMPLETED'),
    );
    if (sets.length === 0) continue;

    sessions.push({
      sessionId: entry.sessionId,
      startedAt: entry.startedAt,
      measurementIds: own[0]?.measurementIds ?? [],
      sets,
    });
  }

  const allSets = sessions.flatMap((entry) => entry.sets);
  const measures = exercise.measurementIds;
  const best = bestByMeasurement(allSets);

  const goals = (await findAllGoals()).filter((goal) =>
    goal.steps.some(
      (step) => step.subject.kind === 'exercise' && step.subject.exerciseId === exerciseId,
    ),
  );

  return {
    exercise,
    sessions,
    // Dans l'ordre déclaré par l'exercice : c'est celui de la saisie.
    records: measures
      .map((id) => best.find((record) => record.measurementId === id))
      .filter((record): record is PerformanceRecord => record !== undefined),
    volume: bestVolume(allSets),
    goals,
  };
}
