import { describe, expect, it } from 'vitest';
import { groupConsecutive } from './set-groups';

const set = (reps: number, weight = 0) => ({ targets: { reps, weight } });

describe('Regroupement des séries', () => {
  it('compte ensemble les séries identiques qui se suivent', () => {
    expect(groupConsecutive([set(8), set(8), set(8)])).toEqual([
      { targets: { reps: 8, weight: 0 }, count: 3, from: 0 },
    ]);
  });

  it('ne regroupe que ce qui se suit', () => {
    // 10, 10, 8, 10 décrit une progression : le dernier 10 n'appartient pas
    // au groupe des premiers.
    const groups = groupConsecutive([set(10), set(10), set(8), set(10)]);

    expect(groups.map((group) => [group.targets.reps, group.count, group.from])).toEqual([
      [10, 2, 0],
      [8, 1, 2],
      [10, 1, 3],
    ]);
  });

  it('distingue deux séries dont une mesure diffère', () => {
    expect(groupConsecutive([set(8, 20), set(8, 22.5)])).toHaveLength(2);
  });

  it('ne regroupe rien quand il n y a rien', () => {
    expect(groupConsecutive([])).toEqual([]);
  });
});
