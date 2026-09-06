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
