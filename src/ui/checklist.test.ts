import { describe, expect, it } from 'vitest';
import type { ConditionResult } from '../domain/goal/evaluation';
import type { Condition } from '../domain/goal/goal';
import { conditionProgress, visibleSteps } from './checklist';

describe('Les étapes montrées sur une carte d objectif', () => {
  it('montre la franchie, la courante et la suivante', () => {
    expect(visibleSteps(5, 2)).toEqual([1, 2, 3]);
  });

  it('montre les deux suivantes sur la première étape', () => {
    expect(visibleSteps(5, 0)).toEqual([0, 1, 2]);
  });

  it('montre les deux précédentes sur la dernière', () => {
    expect(visibleSteps(5, 4)).toEqual([2, 3, 4]);
  });

  it('montre tout ce qu une courte progression contient', () => {
    expect(visibleSteps(2, 1)).toEqual([0, 1]);
  });
});

const condition = (operator: Condition['operator'], target: number): Condition => ({
  measurementId: 'duration',
  window: 'LAST_SESSION',
  aggregation: 'average',
  operator,
  target,
});

const result = (
  operator: Condition['operator'],
  target: number,
  actual: number | null,
  satisfied = false,
): ConditionResult => ({ condition: condition(operator, target), actual, satisfied, hasData: true });

describe('La part faite d une condition', () => {
  it('se remplit vers une valeur à atteindre', () => {
    expect(conditionProgress(result('>=', 10, 5))).toBe(0.5);
  });

  it('est pleine dès que la condition tient', () => {
    expect(conditionProgress(result('>=', 10, 12, true))).toBe(1);
  });

  it('est vide sans valeur', () => {
    expect(conditionProgress(result('>=', 10, null))).toBe(0);
    expect(conditionProgress(undefined)).toBe(0);
  });

  it('n a pas de moitié pour une valeur à ne pas dépasser', () => {
    expect(conditionProgress(result('<=', 80, 85))).toBe(0);
  });
});
