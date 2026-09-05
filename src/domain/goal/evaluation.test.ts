import { describe, expect, it } from 'vitest';
import type { PerformanceSet } from '../performance/exercise-performance';
import { evaluateRequirement } from './evaluation';
import type { Condition, Requirement } from './goal';

const at = new Date(2026, 8, 5, 18, 0);

const set = (duration: number, status: PerformanceSet['status'] = 'COMPLETED'): PerformanceSet => ({
  status,
  values: { duration },
  startedAt: at,
  endedAt: at,
});

const condition = (over: Partial<Condition> = {}): Condition => ({
  measurementId: 'duration',
  window: 'LAST_SESSION',
  aggregation: 'average',
  operator: '>=',
  target: 10,
  ...over,
});

const holdAtLeast10: Requirement = { conditions: [condition()] };

describe('evaluateRequirement', () => {
  // L'exemple exact du modèle métier (§6).
  it('refuse une moyenne de 8 secondes pour une cible de 10', () => {
    const result = evaluateRequirement(holdAtLeast10, [set(7), set(9), set(8)]);

    expect(result.satisfied).toBe(false);
    expect(result.results[0].actual).toBe(8);
  });

  it('valide une moyenne de 10 secondes', () => {
    const result = evaluateRequirement(holdAtLeast10, [set(10), set(11), set(9)]);

    expect(result.satisfied).toBe(true);
    expect(result.results[0].actual).toBe(10);
  });

  it('ignore les séries abandonnées et en cours', () => {
    // Sans le filtre, la moyenne tomberait à 7 et la condition échouerait.
    const result = evaluateRequirement(holdAtLeast10, [
      set(10),
      set(1, 'ABANDONED'),
      set(0, 'IN_PROGRESS'),
      set(10),
    ]);

    expect(result.satisfied).toBe(true);
    expect(result.results[0].actual).toBe(10);
  });

  it('n est pas satisfaite quand aucune série ne renseigne la mesure', () => {
    const result = evaluateRequirement(holdAtLeast10, []);

    expect(result.satisfied).toBe(false);
    expect(result.results[0].actual).toBeNull();
  });

  it('exige que TOUTES les conditions du requirement tiennent', () => {
    const requirement: Requirement = {
      conditions: [
        condition(),
        condition({ aggregation: 'setCount', measurementId: null, target: 3 }),
      ],
    };

    expect(evaluateRequirement(requirement, [set(12), set(12)]).satisfied).toBe(false);
    expect(evaluateRequirement(requirement, [set(12), set(12), set(12)]).satisfied).toBe(true);
  });

  it('agrège en moyenne, maximum, minimum et total', () => {
    const actual = (aggregation: 'max' | 'min' | 'total') =>
      evaluateRequirement({ conditions: [condition({ aggregation, target: 0 })] }, [
        set(6),
        set(12),
        set(9),
      ]).results[0].actual;

    expect(actual('max')).toBe(12);
    expect(actual('min')).toBe(6);
    expect(actual('total')).toBe(27);
  });

  it('compte les séries complétées, sans regarder les mesures', () => {
    const requirement: Requirement = {
      conditions: [condition({ aggregation: 'setCount', measurementId: null, target: 2 })],
    };

    expect(evaluateRequirement(requirement, [set(3), set(3), set(1, 'ABANDONED')]).results[0].actual).toBe(2);
  });
});
