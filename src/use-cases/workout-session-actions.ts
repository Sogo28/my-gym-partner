import { randomUUID } from 'expo-crypto';
import type { ExerciseId } from '../domain/exercise/exercise';
import type { PlannedWorkoutId } from '../domain/planned-workout/planned-workout';
import {
  ExercisePerformance,
  type SetValues,
} from '../domain/performance/exercise-performance';
import { WorkoutSession } from '../domain/workout-session/workout-session';
import { findAll as findAllExercises } from '../infra/exercise-repository';
import { findAll as findAllPlans } from '../infra/planned-workout-repository';
import {
  findById as findPerformanceById,
  save as savePerformance,
} from '../infra/performance-repository';
import { findActive, save } from '../infra/workout-session-repository';
import { markScheduleExecuted } from './scheduling-actions';

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
  scheduledWorkoutId?: string | null,
): Promise<WorkoutSession> {
  if (await findActive()) {
    throw new Error('Une séance est déjà en cours. Termine-la ou annule-la d abord.');
  }

  const session = WorkoutSession.start({
    id: randomUUID(),
    plannedWorkoutId: plannedWorkoutId ?? null,
    scheduledWorkoutId: scheduledWorkoutId ?? null,
    at: new Date(),
  });

  await save(session);

  // Démarrer une séance depuis un plan la place directement sur son premier
  // exercice : l'utilisateur ne devrait pas avoir à le choisir, le plan le dit.
  if (session.plannedWorkoutId) {
    const plan = (await findAllPlans()).find((p) => p.id === session.plannedWorkoutId);
    const first = plan?.exercises[0];
    if (first) {
      return startActivity(first.exerciseId, 0);
    }
  }

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
export async function startActivity(
  exerciseId: ExerciseId,
  plannedPosition: number | null = null,
): Promise<WorkoutSession> {
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

  return onActiveSession((session) =>
    session.startActivity(exerciseId, performance.id, now, plannedPosition),
  );
}

/**
 * FinishActivity (§29). Les séries prévues et non faites sont enregistrées
 * comme ABANDONNÉES : l'historique garde la trace de ce qui était prévu et
 * n'a pas été exécuté, sans jamais les compter comme des performances (n°18).
 */
export async function finishActivity(): Promise<WorkoutSession> {
  const session = await findActive();
  const activity = session?.currentActivity;

  if (session && activity?.performanceId) {
    const performance = await findPerformanceById(activity.performanceId);
    if (performance) {
      const plannedCount = await plannedSetCount(session, activity);
      performance.abandonRemainingPlannedSets(plannedCount, new Date());
      await savePerformance(performance);
    }
  }

  return onActiveSession((current, now) => current.finishCurrentActivity(now));
}

/**
 * "Passer à l'exercice suivant" : le §9 le décrit comme de l'orchestration,
 * pas comme un use case métier -- c'est FinishActivity puis StartActivity.
 */
export async function goToNextExercise(): Promise<WorkoutSession> {
  const session = await findActive();
  const activity = session?.currentActivity;
  const plan = session?.plannedWorkoutId
    ? (await findAllPlans()).find((p) => p.id === session.plannedWorkoutId)
    : undefined;

  const nextPosition = activity?.plannedPosition === null ? null : (activity?.plannedPosition ?? -1) + 1;
  const next = nextPosition !== null ? plan?.exercises[nextPosition] : undefined;

  const updated = await finishActivity();
  if (!next || nextPosition === null) {
    return updated;
  }
  return startActivity(next.exerciseId, nextPosition);
}

/** Corriger une série déjà validée, typiquement pendant le repos. */
export const correctSet = (setIndex: number, values: SetValues) =>
  onCurrentPerformance((performance) => performance.correctSetValues(setIndex, values));

/** Combien de séries le plan prévoyait pour l'exercice en cours. */
async function plannedSetCount(
  session: WorkoutSession,
  activity: { plannedPosition: number | null },
): Promise<number> {
  if (activity.plannedPosition === null || !session.plannedWorkoutId) return 0;
  const plan = (await findAllPlans()).find((p) => p.id === session.plannedWorkoutId);
  return plan?.exercises[activity.plannedPosition]?.sets.length ?? 0;
}


/**
 * StartPerformanceSet (§29). Démarrer une série interrompt le repos en cours :
 * c'est le comportement décrit au §13, "l'utilisateur peut interrompre un
 * repos en démarrant la série suivante".
 *
 * L'enchaînement est ici et non dans le domaine : ni la séance ni la
 * performance ne peuvent le décider seules, elles ne se connaissent pas.
 */
export async function startPerformanceSet(): Promise<ExercisePerformance> {
  await stopRestIfAny();
  return onCurrentPerformance((p, now) => p.startSet(now));
}

/** CompletePerformanceSet (§29), suivi du repos qui s'enchaîne (§13). */
export async function completePerformanceSet(values: SetValues): Promise<ExercisePerformance> {
  const performance = await onCurrentPerformance((p, now) => p.completeCurrentSet(values, now));
  await onActiveSession((session, now) => {
    if (!session.currentRest) session.startRest(now);
  });
  return performance;
}

/** StartRest / StopRest (§29), quand l'utilisateur les commande lui-même. */
export const startRest = () => onActiveSession((session, now) => session.startRest(now));

export const stopRest = () => onActiveSession((session, now) => session.stopRest(now));

async function stopRestIfAny(): Promise<void> {
  const session = await findActive();
  if (session?.currentRest) {
    await onActiveSession((current, now) => current.stopRest(now));
  }
}

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

/**
 * FinishWorkoutSession (§30). C'est ici, et pas au démarrage, que
 * l'entraînement programmé devient EXECUTED.
 */
export async function finishWorkoutSession(): Promise<WorkoutSession> {
  const session = await onActiveSession((current, now) => current.finish(now));
  if (session.scheduledWorkoutId) {
    await markScheduleExecuted(session.scheduledWorkoutId);
  }
  return session;
}

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
