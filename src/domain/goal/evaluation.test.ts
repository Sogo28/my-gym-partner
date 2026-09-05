import { describe, expect, it } from 'vitest';
import type { PerformanceSet } from '../performance/exercise-performance';
import { evaluateStep } from './evaluation';
import type { ProgressionStep } from './goal';

const at = new Date(2026, 8, 5, 18, 0);

const set = (duration: number, status: PerformanceSet['status'] = 'COMPLETED'): PerformanceSet => ({
  status,
  values: { duration },
  startedAt: at,
  endedAt: at,
});

const holdAtLeast10: ProgressionStep = {
  exerciseId: 'advanced-tuck',
  requirements: [
    { conditions: [{ metric: { type: 'average', measurementId: 'duration' }, operator: '>=', value: 10 }] },
  ],
};

describe('evaluateStep', () => {
  // L'exemple exact du cahier des charges (§22).
  it('refuse une moyenne de 8 secondes pour un objectif de 10', () => {
    const result = evaluateStep(holdAtLeast10, [set(7), set(9), set(8)]);

    expect(result.satisfied).toBe(false);
    expect(result.results[0].actual).toBe(8);
  });

  it('valide une moyenne de 10 secondes', () => {
    const result = evaluateStep(holdAtLeast10, [set(10), set(11), set(9)]);

    expect(result.satisfied).toBe(true);
    expect(result.results[0].actual).toBe(10);
  });

  it('ignore les séries abandonnées et en cours', () => {
    // Sans le filtre, la moyenne tomberait à 7 et l'étape échouerait.
    const result = evaluateStep(holdAtLeast10, [
      set(10),
      set(1, 'ABANDONED'),
      set(0, 'IN_PROGRESS'),
      set(10),
    ]);

    expect(result.satisfied).toBe(true);
    expect(result.results[0].actual).toBe(10);
  });

  it('n est pas satisfaite quand aucune série ne renseigne la mesure', () => {
    const result = evaluateStep(holdAtLeast10, []);

    expect(result.satisfied).toBe(false);
    expect(result.results[0].actual).toBeNull();
  });

  it('exige que toutes les conditions d un requirement tiennent', () => {
    const step: ProgressionStep = {
      exerciseId: 'advanced-tuck',
      requirements: [
        {
          conditions: [
            { metric: { type: 'average', measurementId: 'duration' }, operator: '>=', value: 10 },
            { metric: { type: 'setCount' }, operator: '>=', value: 3 },
          ],
        },
      ],
    };

    expect(evaluateStep(step, [set(12), set(12)]).satisfied).toBe(false);
    expect(evaluateStep(step, [set(12), set(12), set(12)]).satisfied).toBe(true);
  });

  it('exige que tous les requirements d une étape tiennent', () => {
    const step: ProgressionStep = {
      exerciseId: 'advanced-tuck',
      requirements: [
        { conditions: [{ metric: { type: 'max', measurementId: 'duration' }, operator: '>=', value: 15 }] },
        { conditions: [{ metric: { type: 'setCount' }, operator: '>=', value: 2 }] },
      ],
    };

    expect(evaluateStep(step, [set(20)]).satisfied).toBe(false);
    expect(evaluateStep(step, [set(20), set(8)]).satisfied).toBe(true);
  });

  it('calcule le maximum, le minimum et le total', () => {
    const metrics = (type: 'max' | 'min' | 'total') =>
      evaluateStep(
        {
          exerciseId: 'e',
          requirements: [
            { conditions: [{ metric: { type, measurementId: 'duration' }, operator: '>=', value: 0 }] },
          ],
        },
        [set(6), set(12), set(9)],
      ).results[0].actual;

    expect(metrics('max')).toBe(12);
    expect(metrics('min')).toBe(6);
    expect(metrics('total')).toBe(27);
  });
});
