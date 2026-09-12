import { describe, expect, it } from 'vitest';
import { anExercise, aWorkoutOf, useCleanDatabase } from '../../test/support';
import { findAll as findAllExercises, findAllMeasurements, findAllMuscles } from '../infra/exercise-repository';
import { findAll as findAllWorkouts } from '../infra/planned-workout-repository';
import { resetData } from '../infra/reset';
import { createMetric, listMetrics, recordReading, listAllReadings } from './body-actions';
import {
  completePerformanceSet,
  finishWorkoutSession,
  startActivity,
  startPerformanceSet,
  startWorkoutSession,
} from './workout-session-actions';
import { eraseHistory, eraseSession } from './erase-history';
import { listSessionSummaries } from './session-summary';
import { findSessionsWorking } from '../infra/exercise-history';

useCleanDatabase();

describe('Réinitialiser', () => {
  it('efface ce que tu as saisi', async () => {
    const exercise = await anExercise();
    await aWorkoutOf(exercise.id, 2);
    await startWorkoutSession();
    await startActivity(exercise.id);

    await resetData();

    expect(await findAllExercises()).toEqual([]);
    expect(await findAllWorkouts()).toEqual([]);
    expect(await listAllReadings()).toEqual([]);
  });

  it('garde le vocabulaire fourni par l application', async () => {
    await resetData();

    // Sans mesure, plus aucun exercice ne pourrait être créé : effacer ces
    // tables ne repartirait pas de zéro, ça casserait l'application.
    expect((await findAllMeasurements()).length).toBeGreaterThan(0);
    expect((await findAllMuscles()).length).toBeGreaterThan(0);
  });

  it('garde les mensurations de départ, pas celles que tu as créées', async () => {
    const mine = await createMetric({ name: 'Tour de fesses', unit: 'cm' });
    await recordReading({ metricId: mine.id, value: 95 });

    await resetData();

    const metrics = await listMetrics();
    expect(metrics.every((metric) => metric.isBuiltIn)).toBe(true);
    expect(metrics.length).toBeGreaterThan(0);
  });
});

describe('Effacer l historique', () => {
  /** Une séance faite, avec une série validée. */
  async function aPastSession(exerciseId: string) {
    await startWorkoutSession();
    await startActivity(exerciseId);
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 10 } });
    await finishWorkoutSession();
  }

  it('efface les séances et ce qu elles ont produit', async () => {
    const exercise = await anExercise();
    await aPastSession(exercise.id);

    await eraseHistory();

    expect(await listSessionSummaries()).toEqual([]);
  });

  it('garde ce avec quoi on s entraîne', async () => {
    const exercise = await anExercise();
    await aWorkoutOf(exercise.id, 2);
    await recordReading({ metricId: 'tourdecuisse', value: 56 });
    await aPastSession(exercise.id);

    await eraseHistory();

    // Exercices, entraînements et relevés ne sont pas de l'historique : ce
    // sont les outils, et ils survivent à l'effacement de ce qu'on en a fait.
    expect(await findAllExercises()).toHaveLength(1);
    expect(await findAllWorkouts()).toHaveLength(1);
    expect(await listAllReadings()).toHaveLength(1);
  });

  it('refuse tant qu une séance est en cours', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);

    await expect(eraseHistory()).rejects.toThrow(/séance en cours/);
  });
});

describe('Effacer une séance', () => {
  async function aSessionOf(exerciseId: string, durations: number[]) {
    await startWorkoutSession();
    await startActivity(exerciseId);
    for (const duration of durations) {
      await startPerformanceSet();
      await completePerformanceSet({ BOTH: { duration } });
    }
    await finishWorkoutSession();
  }

  it('emporte les performances, qui comptaient partout ailleurs', async () => {
    const exercise = await anExercise();
    await aSessionOf(exercise.id, [10, 11]);
    await aSessionOf(exercise.id, [7]);

    const [recent] = await listSessionSummaries();
    await eraseSession(recent.session.id);

    // La séance disparaît de l'historique ET de ce qui nourrit les records et
    // les objectifs : la laisser compter serait l'effacer à moitié.
    const left = await listSessionSummaries();
    expect(left).toHaveLength(1);
    expect(left[0].completedSetCount).toBe(2);
    expect(await findSessionsWorking(exercise.id)).toHaveLength(1);
  });

  it('ne touche pas aux autres séances', async () => {
    const exercise = await anExercise();
    await aSessionOf(exercise.id, [10]);
    await aSessionOf(exercise.id, [11]);

    const [recent, older] = await listSessionSummaries();
    await eraseSession(recent.session.id);

    expect((await listSessionSummaries())[0].session.id).toBe(older.session.id);
  });

  it('refuse une séance en cours', async () => {
    const exercise = await anExercise();
    await startWorkoutSession();
    await startActivity(exercise.id);
    const active = (await listSessionSummaries())[0];

    await expect(eraseSession(active.session.id)).rejects.toThrow(/Termine ou annule/);
  });
});
