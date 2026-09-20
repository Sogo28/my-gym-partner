import { randomUUID } from 'expo-crypto';
import { DomainError } from '../domain/domain-error';
import {
  ExercisePerformance,
  type ValuesBySide,
} from '../domain/performance/exercise-performance';
import { WorkoutSession } from '../domain/workout-session/workout-session';
import { findAll as findAllExercises } from '../infra/exercise-repository';
import { save as savePerformance } from '../infra/performance-repository';
import { save } from '../infra/workout-session-repository';

/**
 * Un exercice tel qu'on le déclare le soir : ce qu'on a fait, et rien de
 * l'ordre dans lequel les minutes se sont écoulées.
 */
export type LoggedExercise = {
  readonly exerciseId: string;
  /** Les séries validées, dans l'ordre où elles ont été faites. */
  readonly sets: readonly ValuesBySide[];
};

/**
 * LogPastSession : enregistrer une séance qui a déjà eu lieu.
 *
 * L'autre bout de la séance vécue (§30). On s'entraîne parfois sans sortir
 * le téléphone -- on improvise, on ne veut pas appuyer sur un bouton entre
 * deux séries --, et le soir on veut quand même savoir ce qu'on a fait ce
 * jour-là. La séance naît alors directement TERMINÉE : elle n'a jamais été
 * en cours, puisqu'elle était déjà finie en arrivant ici.
 *
 * Rien de neuf dans le domaine pour autant : la séance et les performances
 * reçoivent leurs instants en paramètre depuis toujours, précisément pour ne
 * pas dépendre de l'horloge. C'est ce qui permet d'écrire aujourd'hui une
 * séance datée de samedi sans qu'aucun agrégat n'ait à le savoir.
 *
 * Ce qu'on déclare, on l'écrit ; ce qu'on n'a pas mesuré, on se tait dessus.
 * Aucun repos n'est inventé -- personne ne se souvient d'avoir soufflé
 * quatre-vingt-quatorze secondes -- et aucune série ne porte de durée
 * d'exécution (voir `logSet`). Seule la durée totale est déclarée, parce
 * qu'elle, on la connaît : « j'y ai passé une heure et quart ».
 */
export async function logPastSession(input: {
  /** Quand la séance a COMMENCÉ. */
  at: Date;
  /** Ce qu'elle a duré en tout, en secondes : une déclaration, pas un relevé. */
  durationSeconds: number;
  exercises: readonly LoggedExercise[];
  /** L'entraînement dont elle est partie, si elle en suivait un. */
  plannedWorkoutId?: string | null;
}): Promise<WorkoutSession> {
  if (input.at.getTime() > Date.now()) {
    throw new DomainError("Une séance ne peut pas avoir eu lieu dans le futur.");
  }
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0) {
    throw new DomainError("Une séance dure plus longtemps que rien du tout.");
  }
  if (input.exercises.length === 0) {
    throw new DomainError("Une séance enregistrée porte au moins un exercice.");
  }
  if (input.exercises.some((exercise) => exercise.sets.length === 0)) {
    throw new DomainError("Chaque exercice porte au moins une série.");
  }

  const measurementsById = new Map(
    (await findAllExercises()).map((exercise) => [exercise.id, exercise.measurementIds]),
  );

  const session = WorkoutSession.start({
    id: randomUUID(),
    plannedWorkoutId: input.plannedWorkoutId ?? null,
    at: input.at,
  });

  const instant = placeWithin(input.at, input.durationSeconds, countSets(input.exercises));
  const performances: ExercisePerformance[] = [];
  let rank = 0;

  for (const logged of input.exercises) {
    const measurementIds = measurementsById.get(logged.exerciseId);
    if (!measurementIds) {
      throw new DomainError("Cet exercice n'existe pas.");
    }

    const startedAt = instant(rank);
    const performance = ExercisePerformance.start({
      id: randomUUID(),
      exerciseId: logged.exerciseId,
      // Copiées à l'instant de l'exécution, comme pour une séance vécue : la
      // performance ne doit pas changer de sens si l'exercice évolue.
      measurementIds,
      at: startedAt,
    });

    for (const values of logged.sets) {
      performance.logSet(values, instant(rank));
      rank += 1;
    }

    performances.push(performance);
    // L'exercice n'a PAS de position dans le plan, même quand la séance en
    // suit un : on déclare ce qu'on a fait, pas la case du programme qu'on
    // prétend avoir cochée. Retirer un exercice en cours de saisie décalerait
    // sinon toutes les positions suivantes.
    session.startActivity(logged.exerciseId, performance.id, startedAt, null);
    session.finishCurrentActivity(instant(rank - 1));
  }

  session.finish(new Date(input.at.getTime() + input.durationSeconds * 1000));

  // Les performances d'abord, la séance ensuite : dans l'autre ordre, une
  // écriture interrompue laisserait la séance pointer vers des performances
  // inexistantes. Le pire ici est une performance que personne ne référence.
  for (const performance of performances) {
    await savePerformance(performance);
  }
  await save(session);

  return session;
}

function countSets(exercises: readonly LoggedExercise[]): number {
  return exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
}

/**
 * Où poser la n-ième série dans la séance.
 *
 * Les séries s'étalent régulièrement entre le début et la fin déclarés. Ces
 * instants ne mesurent rien : ils portent l'ORDRE, que la séance a bien eu,
 * et situent grossièrement chaque série dans le créneau. Rien ne les affiche
 * comme des durées -- une série déclarée n'a pas de fin, donc pas de temps
 * d'exécution, et les repos qu'on en déduirait n'existent pas non plus.
 */
function placeWithin(at: Date, durationSeconds: number, totalSets: number) {
  const step = totalSets > 0 ? (durationSeconds * 1000) / totalSets : 0;
  return (rank: number) => new Date(at.getTime() + Math.round(rank * step));
}
