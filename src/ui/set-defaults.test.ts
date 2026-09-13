import { describe, expect, it } from 'vitest';
import { ladder } from './set-defaults';

/**
 * Les crans d'une roulette.
 *
 * Le piège est l'addition répétée d'un pas décimal : additionner 2,5 cent
 * fois donne 250.00000000000003 en virgule flottante, et la valeur affichée
 * comme celle enregistrée en porteraient la trace.
 */
describe('Les crans d une colonne', () => {
  it('va de zéro au plafond, de pas en pas', () => {
    expect(ladder(1, 5)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('ne dépasse jamais le plafond', () => {
    expect(ladder(10, 25).at(-1)).toBe(20);
  });

  it('ne laisse pas dériver un pas décimal', () => {
    const rungs = ladder(2.5, 400);

    expect(rungs.slice(0, 4)).toEqual([0, 2.5, 5, 7.5]);
    expect(rungs.at(-1)).toBe(400);
    expect(rungs.every((rung) => Number.isInteger(rung * 10))).toBe(true);
  });
});
