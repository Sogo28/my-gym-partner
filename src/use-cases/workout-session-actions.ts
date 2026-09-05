import { randomUUID } from 'expo-crypto';
import type { ExerciseId } from '../domain/exercise/exercise';
import type { PlannedWorkoutId } from '../domain/planned-workout/planned-workout';
import { WorkoutSession } from '../domain/workout-session/workout-session';
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

export const startActivity = (exerciseId: ExerciseId) =>
  onActiveSession((session, now) => session.startActivity(exerciseId, now));

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
