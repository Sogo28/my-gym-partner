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
import { eraseHistory } from './erase-history';
import { listSessionSummaries } from './session-summary';

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
