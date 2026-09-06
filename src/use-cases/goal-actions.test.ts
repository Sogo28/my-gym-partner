import { describe, expect, it } from 'vitest';
import { anExercise, useCleanDatabase } from '../../test/support';
import type { Condition } from '../domain/goal/goal';
import { createGoal, evaluateGoal } from './goal-actions';
import {
  completePerformanceSet,
  finishActivity,
  finishWorkoutSession,
  startActivity,
  startPerformanceSet,
  startWorkoutSession,
} from './workout-session-actions';

/**
 * La résolution des fenêtres d'évaluation : quelles séries sont réellement
 * servies à chaque condition. C'est un aller-retour complet -- séances,
 * activités, performances -- qu'aucun test de domaine ne peut couvrir.
 */
useCleanDatabase();

const hold = (over: Partial<Condition> = {}): Condition => ({
  measurementId: 'duration',
  window: 'LAST_SESSION',
  aggregation: 'average',
  operator: '>=',
  target: 10,
  ...over,
});

/** Une séance où l'exercice est travaillé une fois, avec ces tenues. */
async function aSessionOf(exerciseId: string, durations: number[]) {
  await startWorkoutSession();
  await startActivity(exerciseId);
  for (const duration of durations) {
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration } });
  }
  await finishWorkoutSession();
}

async function goalOn(exerciseId: string, conditions: Condition[]) {
  return createGoal({
    name: 'Front Lever',
    target: { kind: 'simple', exerciseId, requirements: [{ conditions }] },
  });
}

describe('LAST_SESSION', () => {
  it('évalue la dernière séance, pas les précédentes', async () => {
    const exercise = await anExercise();
    await aSessionOf(exercise.id, [7, 9, 8]);
    await aSessionOf(exercise.id, [10, 11, 9]);

    const evaluation = await evaluateGoal(await goalOn(exercise.id, [hold()]));

    // Sur tout l'historique, la moyenne vaudrait 9 et échouerait.
    expect(evaluation!.results[0].actual).toBe(10);
    expect(evaluation!.satisfied).toBe(true);
  });

  it('additionne les deux passages d un même exercice dans une séance', async () => {
    const exercise = await anExercise();

    // Le vrai travail au début, un finisher fatigué à la fin.
    await startWorkoutSession();
    await startActivity(exercise.id);
    for (const duration of [10, 11, 9]) {
      await startPerformanceSet();
      await completePerformanceSet({ BOTH: { duration } });
    }
    await finishActivity();
    await startActivity(exercise.id);
    for (const duration of [6, 5]) {
      await startPerformanceSet();
      await completePerformanceSet({ BOTH: { duration } });
    }
    await finishWorkoutSession();

    const evaluation = await evaluateGoal(await goalOn(exercise.id, [hold()]));

    // (10+11+9+6+5)/5 = 8,2 -- et non 5,5, qui ne lirait que le finisher.
    expect(evaluation!.results[0].actual).toBeCloseTo(8.2);
  });

  it('ignore une séance où rien n a été validé', async () => {
    const exercise = await anExercise();
    await aSessionOf(exercise.id, [10, 11, 9]);

    // Une séance plus récente, mais sans aucune série complétée.
    await startWorkoutSession();
    await startActivity(exercise.id);
    await startPerformanceSet();
    await finishWorkoutSession();

    const evaluation = await evaluateGoal(await goalOn(exercise.id, [hold()]));

    // La séance vide ne masque pas la précédente.
    expect(evaluation!.results[0].actual).toBe(10);
  });

  it('ne trouve rien quand l exercice n a jamais été travaillé', async () => {
    const exercise = await anExercise();

    const evaluation = await evaluateGoal(await goalOn(exercise.id, [hold()]));

    expect(evaluation!.results[0].actual).toBeNull();
    expect(evaluation!.results[0].hasData).toBe(false);
  });
});

describe('ALL_TIME', () => {
  it('compte toutes les séances', async () => {
    const exercise = await anExercise();
    await aSessionOf(exercise.id, [7, 9, 8]);
    await aSessionOf(exercise.id, [10, 11, 9]);

    const evaluation = await evaluateGoal(
      await goalOn(exercise.id, [
        hold({ window: 'ALL_TIME', aggregation: 'setCount', measurementId: null, target: 6 }),
      ]),
    );

    expect(evaluation!.results[0].actual).toBe(6);
    expect(evaluation!.satisfied).toBe(true);
  });
});

describe('Deux fenêtres dans la même exigence', () => {
  it('sert à chaque condition la période qu elle déclare', async () => {
    const exercise = await anExercise();
    await aSessionOf(exercise.id, [4, 5, 4]);
    await aSessionOf(exercise.id, [10, 11, 9]);

    const evaluation = await evaluateGoal(
      await goalOn(exercise.id, [
        hold({ window: 'LAST_SESSION', target: 10 }),
        hold({ window: 'ALL_TIME', aggregation: 'setCount', measurementId: null, target: 6 }),
      ]),
    );

    // La forme du jour ne voit que la dernière séance…
    expect(evaluation!.results[0].actual).toBe(10);
    // …le volume accumulé voit les deux.
    expect(evaluation!.results[1].actual).toBe(6);
    expect(evaluation!.satisfied).toBe(true);
  });
});

describe('Exercice unilatéral', () => {
  it('évalue le côté le plus faible', async () => {
    const exercise = await anExercise('One Leg Front Lever', ['duration']);

    await startWorkoutSession();
    await startActivity(exercise.id);
    for (const [left, right] of [
      [12, 8],
      [11, 7],
    ]) {
      await startPerformanceSet();
      await completePerformanceSet({ LEFT: { duration: left }, RIGHT: { duration: right } });
    }
    await finishWorkoutSession();

    const evaluation = await evaluateGoal(await goalOn(exercise.id, [hold()]));

    // (8+7)/2 = 7,5 : le côté fort ne compense pas. Compter les quatre
    // valeurs donnerait 9,5, et l'étape passerait à moitié acquise.
    expect(evaluation!.results[0].actual).toBe(7.5);
    expect(evaluation!.satisfied).toBe(false);
  });

  it('se contente du côté enregistré quand l autre manque', async () => {
    const exercise = await anExercise('One Leg Front Lever', ['duration']);

    await startWorkoutSession();
    await startActivity(exercise.id);
    await startPerformanceSet();
    await completePerformanceSet({ LEFT: { duration: 12 } });
    await finishWorkoutSession();

    const evaluation = await evaluateGoal(await goalOn(exercise.id, [hold()]));

    expect(evaluation!.results[0].actual).toBe(12);
  });
});

describe('Séries abandonnées', () => {
  it('ne les compte dans aucune fenêtre', async () => {
    const exercise = await anExercise();

    await startWorkoutSession();
    await startActivity(exercise.id);
    await startPerformanceSet();
    await completePerformanceSet({ BOTH: { duration: 12 } });
    await startPerformanceSet(); // laissée en cours, donc abandonnée à la fin
    await finishWorkoutSession();

    const evaluation = await evaluateGoal(
      await goalOn(exercise.id, [
        hold({ aggregation: 'setCount', measurementId: null, target: 1 }),
      ]),
    );

    expect(evaluation!.results[0].actual).toBe(1);
  });
});
