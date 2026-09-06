import { describe, expect, it } from 'vitest';
import { ExercisePerformance, weakestValues } from './exercise-performance';

const t = (minutes: number) => new Date(2026, 8, 5, 18, minutes);
const pullUp = () =>
  ExercisePerformance.start({
    id: 'perf-1',
    exerciseId: 'pull-up',
    measurementIds: ['reps', 'weight'],
    at: t(0),
  });

describe('Exercice unilatéral', () => {
  const unilateral = () =>
    ExercisePerformance.start({
      id: 'perf-u',
      exerciseId: 'one-leg-front-lever',
      measurementIds: ['duration'],
      at: t(0),
    });

  it('porte les deux côtés dans UNE seule série', () => {
    const performance = unilateral();
    performance.startSet(t(1));

    performance.completeCurrentSet({ LEFT: { duration: 12 }, RIGHT: { duration: 8 } }, t(2));

    // Une série, pas deux : c'est le même effort, exécuté des deux côtés.
    expect(performance.completedSets).toHaveLength(1);
    expect(performance.completedSets[0].values).toEqual({
      LEFT: { duration: 12 },
      RIGHT: { duration: 8 },
    });
  });

  it('accepte une série faite d un seul côté', () => {
    const performance = unilateral();
    performance.startSet(t(1));

    // Rattrapage du côté faible, ou côté blessé qu'on épargne.
    expect(() => performance.completeCurrentSet({ LEFT: { duration: 9 } }, t(2))).not.toThrow();
  });

  it('refuse une série dont aucun côté ne porte de valeur', () => {
    const performance = unilateral();
    performance.startSet(t(1));

    expect(() => performance.completeCurrentSet({ LEFT: {}, RIGHT: {} }, t(2))).toThrow(
      /au moins une valeur/,
    );
  });
});

describe('weakestValues', () => {
  it('retient le côté le plus faible, mesure par mesure', () => {
    // Le côté gauche tient plus longtemps, le droit porte plus lourd :
    // chaque mesure est jugée séparément.
    expect(
      weakestValues({
        LEFT: { duration: 12, weight: 5 },
        RIGHT: { duration: 8, weight: 10 },
      }),
    ).toEqual({ duration: 8, weight: 5 });
  });

  it('rend la seule valeur disponible quand un côté manque', () => {
    // Une absence n'est pas un zéro : il n'y a rien à comparer.
    expect(weakestValues({ LEFT: { duration: 9 } })).toEqual({ duration: 9 });
  });

  it('laisse passer une série bilatérale telle quelle', () => {
    expect(weakestValues({ BOTH: { reps: 8, weight: 20 } })).toEqual({ reps: 8, weight: 20 });
  });

  it('ne rend rien quand aucune valeur n existe', () => {
    expect(weakestValues({})).toEqual({});
  });
});

describe('ExercisePerformance', () => {
  it('enregistre une série complétée avec ses valeurs réelles', () => {
    const performance = pullUp();
    performance.startSet(t(1));

    performance.completeCurrentSet({ BOTH: { reps: 8, weight: 10 } }, t(2));

    expect(performance.completedSets).toHaveLength(1);
    expect(performance.completedSets[0].values).toEqual({ BOTH: { reps: 8, weight: 10 } });
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

    performance.abandonCurrentSet(t(2), { BOTH: { reps: 3 } });

    expect(performance.sets[0].status).toBe('ABANDONED');
    expect(performance.completedSets).toHaveLength(0);
    // Les valeurs saisies restent lisibles, elles ne comptent simplement pas.
    expect(performance.sets[0].values).toEqual({ BOTH: { reps: 3 } });
  });

  it('interdit deux séries en cours en même temps', () => {
    const performance = pullUp();
    performance.startSet(t(1));

    expect(() => performance.startSet(t(2))).toThrow(/déjà en cours/);
  });

  it('refuse de compléter quand aucune série n est en cours', () => {
    const performance = pullUp();

    expect(() => performance.completeCurrentSet({ BOTH: { reps: 8 } }, t(2))).toThrow(/Aucune série/);
  });

  it('interdit de recompléter une série déjà terminée', () => {
    const performance = pullUp();
    performance.startSet(t(1));
    performance.completeCurrentSet({ BOTH: { reps: 8 } }, t(2));

    expect(() => performance.completeCurrentSet({ BOTH: { reps: 9 } }, t(3))).toThrow(/Aucune série/);
  });

  it('refuse une valeur qui ne correspond pas aux mesures de l exercice', () => {
    const performance = pullUp();
    performance.startSet(t(1));

    expect(() => performance.completeCurrentSet({ BOTH: { duration: 30 } }, t(2))).toThrow(/ne se mesure pas/);
  });

  it('refuse une série complétée sans aucune valeur', () => {
    const performance = pullUp();
    performance.startSet(t(1));

    expect(() => performance.completeCurrentSet({ BOTH: {} }, t(2))).toThrow(/au moins une valeur/);
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

    expect(() => performance.completeCurrentSet({ BOTH: { weight: 10 } }, t(2))).toThrow(/ne se mesure pas/);
  });

  it('abandonne les séries prévues qui n ont pas été faites', () => {
    const performance = pullUp();
    performance.startSet(t(1));
    performance.completeCurrentSet({ BOTH: { reps: 8 } }, t(2));

    // Le plan en prévoyait 3, on passe à l'exercice suivant après la première.
    performance.abandonRemainingPlannedSets(3, t(3));

    expect(performance.sets.map((s) => s.status)).toEqual([
      'COMPLETED',
      'ABANDONED',
      'ABANDONED',
    ]);
    expect(performance.completedSets).toHaveLength(1);
  });

  it('abandonne aussi la série en cours quand on passe à la suite', () => {
    const performance = pullUp();
    performance.startSet(t(1));

    performance.abandonRemainingPlannedSets(2, t(2));

    expect(performance.sets.map((s) => s.status)).toEqual(['ABANDONED', 'ABANDONED']);
  });

  it('n ajoute rien quand toutes les séries prévues ont été faites', () => {
    const performance = pullUp();
    performance.startSet(t(1));
    performance.completeCurrentSet({ BOTH: { reps: 8 } }, t(2));

    performance.abandonRemainingPlannedSets(1, t(3));

    expect(performance.sets).toHaveLength(1);
  });

  it('corrige la saisie d une série déjà validée', () => {
    const performance = pullUp();
    performance.startSet(t(1));
    performance.completeCurrentSet({ BOTH: { reps: 8, weight: 10 } }, t(2));

    // Cas réel : la série est validée avec les valeurs prévues, puis corrigée
    // pendant le repos parce qu'on n'a fait que 6 répétitions.
    performance.correctSetValues(0, { BOTH: { reps: 6, weight: 10 } });

    expect(performance.completedSets[0].values).toEqual({ BOTH: { reps: 6, weight: 10 } });
    expect(performance.completedSets[0].status).toBe('COMPLETED');
  });

  it('ne change pas l état d une série abandonnée qu on corrige', () => {
    const performance = pullUp();
    performance.startSet(t(1));
    performance.abandonCurrentSet(t(2));

    performance.correctSetValues(0, { BOTH: { reps: 3 } });

    expect(performance.sets[0].status).toBe('ABANDONED');
    expect(performance.completedSets).toHaveLength(0);
  });

  it('refuse de corriger une série encore en cours ou inexistante', () => {
    const performance = pullUp();
    performance.startSet(t(1));

    expect(() => performance.correctSetValues(0, { BOTH: { reps: 8 } })).toThrow(/encore en cours/);
    expect(() => performance.correctSetValues(9, { BOTH: { reps: 8 } })).toThrow(/n'existe pas/);
  });

  it('refuse une correction avec une valeur hors mesures de l exercice', () => {
    const performance = pullUp();
    performance.startSet(t(1));
    performance.completeCurrentSet({ BOTH: { reps: 8 } }, t(2));

    expect(() => performance.correctSetValues(0, { BOTH: { duration: 30 } })).toThrow(/ne se mesure pas/);
  });

  it('enchaîne plusieurs séries avec des valeurs différentes', () => {
    const performance = pullUp();
    performance.startSet(t(1));
    performance.completeCurrentSet({ BOTH: { reps: 8, weight: 10 } }, t(2));
    performance.startSet(t(4));
    performance.completeCurrentSet({ BOTH: { reps: 6, weight: 10 } }, t(5));

    expect(performance.completedSets.map((s) => s.values)).toEqual([
      { BOTH: { reps: 8, weight: 10 } },
      { BOTH: { reps: 6, weight: 10 } },
    ]);
  });
});
