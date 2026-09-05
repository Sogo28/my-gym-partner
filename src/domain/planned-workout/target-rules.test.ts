import { describe, expect, it } from 'vitest';
import { assertTargetsAreMeasurable } from './target-rules';

const catalogue = new Map([
  ['pull-up', ['reps', 'weight']],
  ['front-lever', ['duration']],
]);

describe('assertTargetsAreMeasurable', () => {
  it('accepte des cibles qui correspondent aux mesures de l exercice', () => {
    expect(() =>
      assertTargetsAreMeasurable(
        [{ exerciseId: 'pull-up', sets: [{ targets: { reps: 8, weight: 10 } }] }],
        catalogue,
      ),
    ).not.toThrow();
  });

  it('accepte une série qui ne cible qu une partie des mesures', () => {
    expect(() =>
      assertTargetsAreMeasurable(
        [{ exerciseId: 'pull-up', sets: [{ targets: { reps: 8 } }] }],
        catalogue,
      ),
    ).not.toThrow();
  });

  it('refuse une cible qui ne fait pas partie des mesures de l exercice', () => {
    expect(() =>
      assertTargetsAreMeasurable(
        [{ exerciseId: 'pull-up', sets: [{ targets: { duration: 30 } }] }],
        catalogue,
      ),
    ).toThrow(/ne se mesure pas/);
  });

  it('refuse un exercice inconnu', () => {
    expect(() =>
      assertTargetsAreMeasurable([{ exerciseId: 'inventé', sets: [] }], catalogue),
    ).toThrow(/n'existe pas/);
  });
});
