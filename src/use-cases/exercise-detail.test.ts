import { describe, expect, it } from 'vitest';
import { anExercise, useCleanDatabase } from '../../test/support';
import { getExerciseDetail } from './exercise-detail';
import {
  abandonPerformanceSet,
  completePerformanceSet,
  finishWorkoutSession,
  startActivity,
  startPerformanceSet,
  startWorkoutSession,
} from './workout-session-actions';

/**
 * Le détail d'un exercice est une LECTURE : il ne stocke rien, il dérive
 * tout des séries déjà enregistrées. Il faut donc de vraies séances pour
 * l'éprouver.
 */
useCleanDatabase();

/** Une séance qui travaille l'exercice, une série par valeur donnée. */
async function aSessionOf(exerciseId: string, values: number[]): Promise<void> {
  await startWorkoutSession();
  await startActivity(exerciseId);
  for (const duration of values) {
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration } });
  }
  await finishWorkoutSession();
}

describe('Détail d un exercice', () => {
  it('retient la meilleure valeur de chaque mesure, toutes séances confondues', async () => {
    const exercise = await anExercise();
    await aSessionOf(exercise.id, [10, 14]);
    await aSessionOf(exercise.id, [12]);

    const detail = await getExerciseDetail(exercise.id);

    expect(detail?.records).toEqual([
      expect.objectContaining({ measurementId: 'duration', value: 14 }),
    ]);
  });

  it('ignore les séries abandonnées : ce ne sont pas des performances', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 8 } });
    await startPerformanceSet();
    await abandonPerformanceSet();
    await finishWorkoutSession();

    const detail = await getExerciseDetail(exercise.id);

    expect(detail?.records[0].value).toBe(8);
    expect(detail?.sessions[0].sets).toHaveLength(1);
  });

  it('ne compte pas de volume quand l exercice ne porte pas les deux mesures', async () => {
    const exercise = await anExercise();
    await aSessionOf(exercise.id, [10]);

    // Une tenue en secondes n'a pas un volume de zéro : elle n'en a pas.
    expect((await getExerciseDetail(exercise.id))?.volume).toBeNull();
  });

  it('ne retient que les séances où cet exercice a été travaillé', async () => {
    const exercise = await anExercise();
    const other = await anExercise('Dips');
    await aSessionOf(exercise.id, [10]);
    await aSessionOf(other.id, [20]);

    const detail = await getExerciseDetail(exercise.id);

    expect(detail?.sessions).toHaveLength(1);
  });
});
