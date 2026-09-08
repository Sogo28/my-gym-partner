import { describe, expect, it } from 'vitest';
import { evaluateRequirement, evaluateRequirements, windowsUsedBy } from './evaluation';
import type { Condition, Requirement } from './goal';

/** Un échantillon : ce qu'une série ou un relevé a donné. */
const set = (duration: number) => ({ duration });

const condition = (over: Partial<Condition> = {}): Condition => ({
  measurementId: 'duration',
  window: 'LAST_SESSION',
  aggregation: 'average',
  operator: '>=',
  target: 10,
  ...over,
});

const holdAtLeast10: Requirement = { conditions: [condition()] };

/** Raccourci : des séries pour la seule fenêtre de la dernière séance. */
const lastSession = (samples: { duration: number }[]) => ({ LAST_SESSION: samples });

/** Une série de développé couché : deux mesures qui vont de paire. */
const bench = (reps: number, kg: number) => ({ reps, kg });

const benchSets = (samples: { reps: number; kg: number }[]) => ({ LAST_SESSION: samples });

/** « au moins <count> séries de 10 reps à 60 kg ». */
const qualifyingSets = (count: number): Requirement => ({
  conditions: [
    {
      measurementId: null,
      window: 'LAST_SESSION',
      aggregation: 'setCount',
      operator: '>=',
      target: count,
      qualifying: [
        { measurementId: 'reps', operator: '>=', target: 10 },
        { measurementId: 'kg', operator: '>=', target: 60 },
      ],
    },
  ],
});

describe('les séries qualifiantes', () => {
  // Le piège que des conditions séparées ne voient pas : deux moyennes
  // correctes, aucune série correcte.
  it('refuse deux séries dont seule la MOYENNE atteint la cible', () => {
    const requirement = qualifyingSets(1);

    const result = evaluateRequirement(requirement, benchSets([bench(15, 40), bench(5, 80)]));

    expect(result.satisfied).toBe(false);
    expect(result.results[0].actual).toBe(0);
  });

  it('ne compte pas une série qui n atteint qu une des deux cibles', () => {
    const result = evaluateRequirement(
      qualifyingSets(1),
      benchSets([bench(12, 55), bench(8, 70)]),
    );

    expect(result.results[0].actual).toBe(0);
  });

  it('compte les séries qui atteignent les deux cibles à la fois', () => {
    const result = evaluateRequirement(
      qualifyingSets(2),
      benchSets([bench(10, 60), bench(11, 65), bench(9, 80)]),
    );

    expect(result.satisfied).toBe(true);
    expect(result.results[0].actual).toBe(2);
  });

  it('ne compte pas une série qui n a pas noté l une des mesures', () => {
    // Rien ne permet d'affirmer que cette série valait 60 kg.
    const result = evaluateRequirement(qualifyingSets(1), {
      LAST_SESSION: [{ reps: 12 } as Record<string, number>],
    });

    expect(result.results[0].actual).toBe(0);
  });

  it('compte toutes les séries quand la condition n en décrit aucune', () => {
    const requirement: Requirement = {
      conditions: [condition({ aggregation: 'setCount', measurementId: null, target: 2 })],
    };

    const result = evaluateRequirement(requirement, benchSets([bench(1, 1), bench(2, 2)]));

    expect(result.satisfied).toBe(true);
    expect(result.results[0].actual).toBe(2);
  });
});

describe('evaluateRequirement', () => {
  // L'exemple exact du modèle métier (§6).
  it('refuse une moyenne de 8 secondes pour une cible de 10', () => {
    const result = evaluateRequirement(holdAtLeast10, lastSession([set(7), set(9), set(8)]));

    expect(result.satisfied).toBe(false);
    expect(result.results[0].actual).toBe(8);
  });

  it('valide une moyenne de 10 secondes', () => {
    const result = evaluateRequirement(holdAtLeast10, lastSession([set(10), set(11), set(9)]));

    expect(result.satisfied).toBe(true);
    expect(result.results[0].actual).toBe(10);
  });

  // Le tri des séries abandonnées ne se fait plus ici : l'évaluation reçoit
  // des échantillons déjà retenus. La règle est vérifiée au niveau du use
  // case, là où le filtrage vit désormais.

  it('n est pas satisfaite quand aucune série ne renseigne la mesure', () => {
    const result = evaluateRequirement(holdAtLeast10, lastSession([]));

    expect(result.satisfied).toBe(false);
    expect(result.results[0].actual).toBeNull();
    expect(result.results[0].hasData).toBe(false);
  });

  it('n est pas satisfaite quand sa fenêtre n a pas été résolue', () => {
    // La condition vise ALL_TIME, on ne fournit que la dernière séance.
    const requirement: Requirement = { conditions: [condition({ window: 'ALL_TIME' })] };

    const result = evaluateRequirement(requirement, lastSession([set(12), set(12)]));

    expect(result.satisfied).toBe(false);
    expect(result.results[0].hasData).toBe(false);
  });

  it('exige que TOUTES les conditions du requirement tiennent', () => {
    const requirement: Requirement = {
      conditions: [
        condition(),
        condition({ aggregation: 'setCount', measurementId: null, target: 3 }),
      ],
    };

    expect(evaluateRequirement(requirement, lastSession([set(12), set(12)])).satisfied).toBe(false);
    expect(
      evaluateRequirement(requirement, lastSession([set(12), set(12), set(12)])).satisfied,
    ).toBe(true);
  });

  it('sert à chaque condition la fenêtre qu elle déclare', () => {
    // Forme du jour ET volume accumulé, dans la même exigence.
    const requirement: Requirement = {
      conditions: [
        condition({ window: 'LAST_SESSION', aggregation: 'average', target: 10 }),
        condition({
          window: 'ALL_TIME',
          aggregation: 'setCount',
          measurementId: null,
          target: 12,
        }),
      ],
    };

    const sets = {
      LAST_SESSION: [set(10), set(11), set(9)],
      ALL_TIME: Array.from({ length: 12 }, () => set(6)),
    };

    const result = evaluateRequirement(requirement, sets);

    // La moyenne est celle de la dernière séance (10), pas celle de tout
    // l'historique (qui vaudrait moins de 7).
    expect(result.results[0].actual).toBe(10);
    expect(result.results[1].actual).toBe(12);
    expect(result.satisfied).toBe(true);
  });

  it('agrège en moyenne, maximum, minimum et total', () => {
    const actual = (aggregation: 'max' | 'min' | 'total') =>
      evaluateRequirement(
        { conditions: [condition({ aggregation, target: 0 })] },
        lastSession([set(6), set(12), set(9)]),
      ).results[0].actual;

    expect(actual('max')).toBe(12);
    expect(actual('min')).toBe(6);
    expect(actual('total')).toBe(27);
  });

  it('compte les échantillons, sans regarder les mesures', () => {
    const requirement: Requirement = {
      conditions: [condition({ aggregation: 'setCount', measurementId: null, target: 2 })],
    };

    expect(
      evaluateRequirement(requirement, lastSession([set(3), set(3)])).results[0].actual,
    ).toBe(2);
  });
});

describe('evaluateRequirements', () => {
  it('exige que TOUS les requirements tiennent', () => {
    const hold: Requirement = { conditions: [condition({ target: 10 })] };
    const threeSets: Requirement = {
      conditions: [condition({ aggregation: 'setCount', measurementId: null, target: 3 })],
    };

    expect(evaluateRequirements([hold, threeSets], lastSession([set(12), set(12)])).satisfied).toBe(
      false,
    );
    expect(
      evaluateRequirements([hold, threeSets], lastSession([set(12), set(12), set(12)])).satisfied,
    ).toBe(true);
  });
});

describe('windowsUsedBy', () => {
  it('énumère sans doublon les fenêtres à résoudre', () => {
    const requirements: Requirement[] = [
      { conditions: [condition({ window: 'LAST_SESSION' }), condition({ window: 'ALL_TIME' })] },
      { conditions: [condition({ window: 'LAST_SESSION' })] },
    ];

    expect(windowsUsedBy(requirements).sort()).toEqual(['ALL_TIME', 'LAST_SESSION']);
  });

  it('ne demande rien quand il n y a pas de condition', () => {
    expect(windowsUsedBy([])).toEqual([]);
  });
});
