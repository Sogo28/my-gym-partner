import { describe, expect, it } from 'vitest';
import { anExercise, aWorkoutOf, useCleanDatabase } from '../../test/support';
import { findAll as findAllExercises, findAllMeasurements, findAllMuscles } from '../infra/exercise-repository';
import { findAll as findAllWorkouts } from '../infra/planned-workout-repository';
import { resetData } from '../infra/reset';
import { createMetric, listMetrics, recordReading, listAllReadings } from './body-actions';
import { startActivity, startWorkoutSession } from './workout-session-actions';

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
