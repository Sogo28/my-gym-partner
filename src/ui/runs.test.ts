import { describe, expect, it } from 'vitest';
import { runsBy } from './runs';

const same = (value: string) => value;

describe('Les suites de séries identiques', () => {
  it('regroupe celles qui se suivent', () => {
    expect(runsBy(['a', 'a', 'a', 'b', 'b'], same)).toEqual([
      { start: 0, count: 3, item: 'a' },
      { start: 3, count: 2, item: 'b' },
    ]);
  });

  it('ne regroupe pas par-dessus une série différente', () => {
    expect(runsBy(['a', 'b', 'a'], same).map((run) => run.count)).toEqual([1, 1, 1]);
  });

  it('laisse seul un élément sans clé', () => {
    const keys = ['a', null, 'a', 'a'];
    expect(runsBy(keys, (key) => key).map((run) => [run.start, run.count])).toEqual([
      [0, 1],
      [1, 1],
      [2, 2],
    ]);
  });
});
