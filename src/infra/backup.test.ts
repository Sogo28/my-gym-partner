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

  it('refuse une sauvegarde d une version plus récente', async () => {
    await someHistory();
    const backup = await exportBackup();

    await expect(
      restoreBackup({ ...backup, schemaVersion: backup.schemaVersion + 1 }),
    ).rejects.toThrow(/plus récente/);
    // Rien n'a bougé.
    expect(await listSessionSummaries()).toHaveLength(1);
  });

  it('restaure une sauvegarde plus ancienne en rejouant les migrations', async () => {
    await someHistory();
    const current = await exportBackup();
    // Une copie faite avant la migration 29 : la mensuration y porte encore
    // son nom sans apostrophe, que la 29 corrige.
    const old = {
      ...current,
      schemaVersion: 28,
      tables: {
        ...current.tables,
        session_activities: current.tables.session_activities.map(
          ({ interval_seconds: _dropped, ...row }) => row,
        ),
        body_metrics: current.tables.body_metrics.map((row) =>
          row.id === 'tourdepaules' ? { ...row, name: 'Tour d épaules' } : row,
        ),
      },
    };
    __clearData();

    await restoreBackup(old);

    const summaries = await listSessionSummaries();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].activities[0].completedSets[0].set.values).toEqual({ BOTH: { duration: 12 } });
    const { getDatabase, SCHEMA_VERSION } = await import('./db');
    const db = await getDatabase();
    const metric = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM body_metrics WHERE id = 'tourdepaules';",
    );
    expect(metric?.name).toBe("Tour d'épaules");
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    expect(version?.user_version).toBe(SCHEMA_VERSION);
  });

  it('restaure une sauvegarde d avant le rythme des séances (version 29)', async () => {
    await someHistory();
    const current = await exportBackup();
    // Telle qu'une app en version 29 l'écrivait : sans la colonne du rythme.
    const v29 = {
      ...current,
      schemaVersion: 29,
      tables: {
        ...current.tables,
        session_activities: current.tables.session_activities.map(
          ({ interval_seconds: _dropped, ...row }) => row,
        ),
      },
    };
    __clearData();

    await restoreBackup(v29);

    const [summary] = await listSessionSummaries();
    expect(summary.completedSetCount).toBe(1);
    expect(summary.activities[0].intervalSeconds).toBeNull();
  });

  it('laisse la base intacte si la restauration échoue en route', async () => {
    await someHistory();
    const current = await exportBackup();
    const broken = {
      ...current,
      schemaVersion: 28,
      tables: { ...current.tables, exercises: [{ colonne_inconnue: 1 }] },
    };

    await expect(restoreBackup(broken)).rejects.toThrow();

    expect(await listSessionSummaries()).toHaveLength(1);
    expect(await findAllExercises()).toHaveLength(1);
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
