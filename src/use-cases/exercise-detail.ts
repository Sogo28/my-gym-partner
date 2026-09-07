import type { Exercise } from '../domain/exercise/exercise';
import type { PerformanceSet } from '../domain/performance/exercise-performance';
import {
  bestByMeasurement,
  bestVolume,
  type PerformanceRecord,
} from '../domain/performance/records';
import type { Goal } from '../domain/goal/goal';
import type { WorkoutSession } from '../domain/workout-session/workout-session';
import { findAll as findAllExercises } from '../infra/exercise-repository';
import { findAll as findAllGoals } from '../infra/goal-repository';
import { listSessionSummaries } from './session-summary';

/** Ce qu'une séance a produit sur CET exercice. */
export type ExerciseSessionEntry = {
  readonly session: WorkoutSession;
  /** Les mesures figées au moment de la performance (§2). */
  readonly measurementIds: readonly string[];
  readonly sets: readonly PerformanceSet[];
};

export type ExerciseDetail = {
  readonly exercise: Exercise;
  /** De la plus récente à la plus ancienne. */
  readonly sessions: readonly ExerciseSessionEntry[];
  readonly records: readonly PerformanceRecord[];
  /** Null quand l'exercice ne porte pas les deux mesures du volume. */
  readonly volume: { value: number; at: Date } | null;
  /** Les objectifs dont une étape vise cet exercice. */
  readonly goals: readonly Goal[];
};

/** Les deux mesures du catalogue de départ dont le produit fait un volume. */
const REPS = 'reps';
const WEIGHT = 'weight';

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

  const summaries = await listSessionSummaries();

  const sessions: ExerciseSessionEntry[] = [];
  for (const summary of summaries) {
    // Un exercice peut avoir été repris dans la même séance -- un finisher en
    // fin de parcours : ses deux passages comptent ensemble.
    const activities = summary.activities.filter(
      (activity) => activity.exerciseId === exerciseId,
    );
    if (activities.length === 0) continue;

    const sets = activities.flatMap((activity) =>
      activity.completedSets.map((completed) => completed.set),
    );
    if (sets.length === 0) continue;

    sessions.push({
      session: summary.session,
      measurementIds: activities[0].measurementIds,
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
    volume:
      measures.includes(REPS) && measures.includes(WEIGHT)
        ? bestVolume(allSets, REPS, WEIGHT)
        : null,
    goals,
  };
}
