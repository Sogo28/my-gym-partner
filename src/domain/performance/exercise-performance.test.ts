import { describe, expect, it } from 'vitest';
import { ExercisePerformance } from './exercise-performance';

const t = (minutes: number) => new Date(2026, 8, 5, 18, minutes);
const pullUp = () =>
  ExercisePerformance.start({
    id: 'perf-1',
    exerciseId: 'pull-up',
    measurementIds: ['reps', 'weight'],
    at: t(0),
  });

describe('ExercisePerformance', () => {
  it('enregistre une série complétée avec ses valeurs réelles', () => {
    const performance = pullUp();
    performance.startSet(t(1));

    performance.completeCurrentSet({ reps: 8, weight: 10 }, t(2));

    expect(performance.completedSets).toHaveLength(1);
    expect(performance.completedSets[0].values).toEqual({ reps: 8, weight: 10 });
  });

  it('ne compte pas une série en cours comme une performance', () => {
    const performance = pullUp();
    performance.startSet(t(1));

    expect(performance.sets).toHaveLength(1);
    expect(performance.completedSets).toHaveLength(0);
  });

  it('ne compte pas une série abandonnée comme une performance', () => {
    const performance = pullUp();
    performance.startSet(t(1));

    performance.abandonCurrentSet(t(2), { reps: 3 });

    expect(performance.sets[0].status).toBe('ABANDONED');
    expect(performance.completedSets).toHaveLength(0);
    // Les valeurs saisies restent lisibles, elles ne comptent simplement pas.
    expect(performance.sets[0].values).toEqual({ reps: 3 });
  });

  it('interdit deux séries en cours en même temps', () => {
    const performance = pullUp();
    performance.startSet(t(1));

    expect(() => performance.startSet(t(2))).toThrow(/déjà en cours/);
  });

  it('refuse de compléter quand aucune série n est en cours', () => {
    const performance = pullUp();

    expect(() => performance.completeCurrentSet({ reps: 8 }, t(2))).toThrow(/Aucune série/);
  });

  it('interdit de recompléter une série déjà terminée', () => {
    const performance = pullUp();
    performance.startSet(t(1));
    performance.completeCurrentSet({ reps: 8 }, t(2));

    expect(() => performance.completeCurrentSet({ reps: 9 }, t(3))).toThrow(/Aucune série/);
  });

  it('refuse une valeur qui ne correspond pas aux mesures de l exercice', () => {
    const performance = pullUp();
    performance.startSet(t(1));

    expect(() => performance.completeCurrentSet({ duration: 30 }, t(2))).toThrow(/ne se mesure pas/);
  });

  it('refuse une série complétée sans aucune valeur', () => {
    const performance = pullUp();
    performance.startSet(t(1));

    expect(() => performance.completeCurrentSet({}, t(2))).toThrow(/au moins une valeur/);
  });

  it('garde les mesures figées au moment de la performance', () => {
    const measurementIds = ['reps'];
    const performance = ExercisePerformance.start({
      id: 'perf-2',
      exerciseId: 'pull-up',
      measurementIds,
      at: t(0),
    });

    // L'exercice évolue plus tard : la performance déjà enregistrée ne bouge pas.
    measurementIds.push('weight');
    performance.startSet(t(1));

    expect(() => performance.completeCurrentSet({ weight: 10 }, t(2))).toThrow(/ne se mesure pas/);
  });

  it('enchaîne plusieurs séries avec des valeurs différentes', () => {
    const performance = pullUp();
    performance.startSet(t(1));
    performance.completeCurrentSet({ reps: 8, weight: 10 }, t(2));
    performance.startSet(t(4));
    performance.completeCurrentSet({ reps: 6, weight: 10 }, t(5));

    expect(performance.completedSets.map((s) => s.values)).toEqual([
      { reps: 8, weight: 10 },
      { reps: 6, weight: 10 },
    ]);
  });
});
