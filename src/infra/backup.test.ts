import { describe, expect, it } from 'vitest';
import { anExercise, aWorkoutOf, useCleanDatabase } from '../../test/support';
import { listSessionSummaries } from '../use-cases/session-summary';
import {
  completePerformanceSet,
  finishWorkoutSession,
  startPerformanceSet,
  startWorkoutSession,
} from '../use-cases/workout-session-actions';
import { exportBackup, restoreBackup } from './backup';
import { findAll as findAllExercises } from './exercise-repository';
import { __clearData } from '../../test/fake-expo-sqlite';

/**
 * Une sauvegarde ne vaut que si elle rend exactement ce qu'on avait. Ces
 * tests parcourent tout le chemin : écriture, effacement complet, relecture.
 */
useCleanDatabase();

/** Une séance complète, pour avoir des données dans toutes les tables. */
async function someHistory() {
  const exercise = await anExercise('Advanced Tuck', ['duration']);
  const plan = await aWorkoutOf(exercise.id, 2);

  await startWorkoutSession(plan.id);
  await startPerformanceSet();
  await completePerformanceSet({ BOTH: { duration: 12 } });
  await finishWorkoutSession();

  return exercise;
}

describe('Sauvegarde', () => {
  it('restaure l historique à l identique après un effacement total', async () => {
    await someHistory();
    const before = await listSessionSummaries();
    const backup = await exportBackup();

    // Comme si l'application avait été réinstallée.
    __clearData();
    expect(await listSessionSummaries()).toHaveLength(0);

    await restoreBackup(backup);

    const after = await listSessionSummaries();
    expect(after).toHaveLength(before.length);
    expect(after[0].completedSetCount).toBe(1);
    expect(after[0].activities[0].completedSets[0].set.values).toEqual({ BOTH: { duration: 12 } });
  });

  it('rend aussi le catalogue, muscles compris', async () => {
    const exercise = await anExercise('Front Lever', ['duration']);
    exercise.changeMuscles('dos', ['abdominaux']);
    const { save } = await import('./exercise-repository');
    await save(exercise);

    const backup = await exportBackup();
    __clearData();
    await restoreBackup(backup);

    const [restored] = await findAllExercises();
    expect(restored.name).toBe('Front Lever');
    expect(restored.measurementIds).toEqual(['duration']);
    expect(restored.primaryMuscleId).toBe('dos');
    expect(restored.secondaryMuscleIds).toEqual(['abdominaux']);
  });

  it('refuse une sauvegarde d une autre version du schéma', async () => {
    const backup = await exportBackup();

    await expect(
      restoreBackup({ ...backup, schemaVersion: backup.schemaVersion + 1 }),
    ).rejects.toThrow(/version différente/);
  });

  it('refuse un fichier qui n est pas une sauvegarde', async () => {
    const backup = await exportBackup();

    await expect(
      restoreBackup({ ...backup, app: 'autre-chose' as 'my-gym-partner' }),
    ).rejects.toThrow(/pas une sauvegarde/);
  });

  it('remplace, et ne fusionne pas', async () => {
    await someHistory();
    const backup = await exportBackup();

    // Une seconde séance, absente de la sauvegarde.
    await startWorkoutSession();
    await finishWorkoutSession();
    expect(await listSessionSummaries()).toHaveLength(2);

    await restoreBackup(backup);

    // Mélanger deux historiques produirait des séances en double sans qu'on
    // sache lesquelles sont vraies.
    expect(await listSessionSummaries()).toHaveLength(1);
  });
});
