import { randomUUID } from 'expo-crypto';
import type { ExerciseId } from '../domain/exercise/exercise';
import type { PlannedWorkoutId } from '../domain/planned-workout/planned-workout';
import {
  ExercisePerformance,
  type SetValues,
} from '../domain/performance/exercise-performance';
import { WorkoutSession } from '../domain/workout-session/workout-session';
import { findAll as findAllExercises } from '../infra/exercise-repository';
import {
  findById as findPerformanceById,
  save as savePerformance,
} from '../infra/performance-repository';
import { findActive, save } from '../infra/workout-session-repository';

/**
 * Use cases de la séance (§29). Chacun fait le même geste : charger la séance
 * en cours, laisser le DOMAINE décider si l'action est permise, sauvegarder.
 *
 * L'heure est lue ici, pas dans le domaine : `new Date()` est une dépendance
 * au monde extérieur, au même titre que la base de données.
 */

/**
 * StartWorkoutSession (§30). La séance peut naître d'un entraînement planifié
 * ou de rien du tout.
 *
 * Règle DÉDUITE, absente du cahier des charges : une seule séance active à la
 * fois. On ne s'entraîne pas à deux endroits en même temps, et "reprendre la
 * séance en cours" (§29) n'aurait pas de sens s'il y en avait plusieurs.
 * Elle vit ici et non dans l'agrégat : une séance ne peut pas savoir ce que
 * font les autres séances.
 */
export async function startWorkoutSession(
  plannedWorkoutId?: PlannedWorkoutId | null,
): Promise<WorkoutSession> {
  if (await findActive()) {
    throw new Error('Une séance est déjà en cours. Termine-la ou annule-la d abord.');
  }

  const session = WorkoutSession.start({
    id: randomUUID(),
    plannedWorkoutId: plannedWorkoutId ?? null,
    at: new Date(),
  });

  await save(session);
  return session;
}

/**
 * StartActivity (§30) : démarrer un exercice crée aussi sa performance.
 *
 * Deux agrégats, donc deux écritures qu'aucune transaction ne peut réunir --
 * c'est le prix de la frontière posée en Slice 3. On écrit la performance
 * D'ABORD : au pire on obtient une performance vide que personne ne
 * référence, ce qui est inoffensif. Dans l'autre ordre, la séance pointerait
 * vers une performance inexistante.
 */
export async function startActivity(exerciseId: ExerciseId): Promise<WorkoutSession> {
  const exercise = (await findAllExercises()).find((candidate) => candidate.id === exerciseId);
  if (!exercise) {
    throw new Error("Cet exercice n'existe pas.");
  }

  const now = new Date();
  const performance = ExercisePerformance.start({
    id: randomUUID(),
    exerciseId,
    // Les mesures sont copiées ici, à l'instant de l'exécution.
    measurementIds: exercise.measurementIds,
    at: now,
  });
  await savePerformance(performance);

  return onActiveSession((session) => session.startActivity(exerciseId, performance.id, now));
}

/** StartPerformanceSet / CompletePerformanceSet / AbandonPerformanceSet (§29). */
export const startPerformanceSet = () => onCurrentPerformance((p, now) => p.startSet(now));

export const completePerformanceSet = (values: SetValues) =>
  onCurrentPerformance((p, now) => p.completeCurrentSet(values, now));

export const abandonPerformanceSet = () =>
  onCurrentPerformance((p, now) => p.abandonCurrentSet(now));

async function onCurrentPerformance(
  action: (performance: ExercisePerformance, now: Date) => void,
): Promise<ExercisePerformance> {
  const session = await findActive();
  const current = session?.currentActivity;
  if (!current?.performanceId) {
    throw new Error("Aucun exercice n'est en cours.");
  }

  const performance = await findPerformanceById(current.performanceId);
  if (!performance) {
    throw new Error('Performance introuvable.');
  }

  action(performance, new Date());

  await savePerformance(performance);
  return performance;
}

export const finishActivity = () =>
  onActiveSession((session, now) => session.finishCurrentActivity(now));

export const finishWorkoutSession = () =>
  onActiveSession((session, now) => session.finish(now));

export const cancelWorkoutSession = () =>
  onActiveSession((session, now) => session.cancel(now));

async function onActiveSession(
  action: (session: WorkoutSession, now: Date) => void,
): Promise<WorkoutSession> {
  const session = await findActive();
  if (!session) {
    throw new Error("Aucune séance n'est en cours.");
  }

  action(session, new Date());

  await save(session);
  return session;
}
