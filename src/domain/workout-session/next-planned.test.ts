import { describe, expect, it } from 'vitest';
import { nextPlannedPosition } from './next-planned';

const at = (...positions: (number | null)[]) =>
  positions.map((plannedPosition) => ({ plannedPosition }));

describe('La prochaine position du programme', () => {
  it('suit le programme dans l ordre', () => {
    expect(nextPlannedPosition(at(0), 3)).toBe(1);
    expect(nextPlannedPosition(at(0, 1), 3)).toBe(2);
  });

  it('reprend le programme après un exercice ajouté', () => {
    expect(nextPlannedPosition(at(0, null), 3)).toBe(1);
    expect(nextPlannedPosition(at(0, null, null), 3)).toBe(1);
  });

  it('dit qu il ne reste rien quand tout est passé', () => {
    expect(nextPlannedPosition(at(0, 1, null), 2)).toBeNull();
    expect(nextPlannedPosition(at(null), 0)).toBeNull();
  });
});
