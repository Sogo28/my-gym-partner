import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('ne compte pas de volume quand l exercice ne porte qu une mesure', async () => {
    const exercise = await anExercise();
    await aSessionOf(exercise.id, [10]);

    // Une tenue en secondes n'a pas un volume de zéro, ni un volume de dix :
    // elle n'en a pas. Le produit d'une seule valeur ne dirait rien que la
    // mesure ne dise déjà, tout en se donnant pour un autre chiffre.
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

/**
 * Le record d'avant : ce que le record actuel a battu.
 *
 * L'horloge est figée d'une séance à l'autre : « avant » se décide à
 * l'instant de la série, et deux séances dans la même milliseconde ne le
 * diraient pas.
 */
describe('Record d avant d un exercice', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  async function onDay(day: number, exerciseId: string, values: number[]) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, day, 18, 0));
    await aSessionOf(exerciseId, values);
  }

  it('dit ce que le record actuel a battu', async () => {
    const exercise = await anExercise();
    await onDay(1, exercise.id, [10]);
    await onDay(3, exercise.id, [12]);
    await onDay(5, exercise.id, [14]);
    await onDay(7, exercise.id, [11]);

    const [record] = (await getExerciseDetail(exercise.id))?.records ?? [];

    expect(record).toEqual(expect.objectContaining({ value: 14, previous: 12 }));
  });

  it('ne se compare pas à un record seulement égalé', async () => {
    const exercise = await anExercise();
    await onDay(1, exercise.id, [10]);
    await onDay(3, exercise.id, [12]);
    await onDay(5, exercise.id, [12]);

    const [record] = (await getExerciseDetail(exercise.id))?.records ?? [];

    expect(record).toEqual(expect.objectContaining({ value: 12, previous: 10 }));
  });

  it('n en a pas quand le record est la première valeur', async () => {
    const exercise = await anExercise();
    await onDay(1, exercise.id, [10]);

    const [record] = (await getExerciseDetail(exercise.id))?.records ?? [];

    expect(record?.previous).toBeNull();
  });
});
