import { describe, expect, it } from 'vitest';
import { chartScale, curveOffsets } from './scale';

/**
 * L'échelle d'une courbe : le seul calcul du graphe, donc le seul endroit où
 * il peut se tromper.
 */
describe('L échelle verticale', () => {
  it('place la meilleure valeur tout en haut', () => {
    // Depuis le haut : zéro pour cent, c'est le sommet.
    expect(curveOffsets([10, 20])[1]).toBe(0);
  });

  it('creuse l écart plutôt que de partir de zéro', () => {
    // 40 et 45 partis de zéro se liraient à 89 % et 100 % : indistinguables.
    const [low, high] = curveOffsets([40, 45]);

    expect(high).toBe(0);
    expect(low).toBeGreaterThan(70);
  });

  it('garde sous la plus basse valeur de quoi la voir', () => {
    expect(chartScale([40, 45])).toEqual({ floor: 38.75, max: 45 });
  });

  it('dessine un plateau au milieu quand rien ne varie', () => {
    // Un volume identique d'une séance à l'autre : l'écart est nul, et
    // diviser par lui donnerait NaN -- donc une courbe absente. Au milieu, le
    // plateau ne prétend être ni un sommet ni un creux.
    expect(curveOffsets([144, 144])).toEqual([50, 50]);
    expect(curveOffsets([0, 0])).toEqual([50, 50]);
  });

  it('ne calcule rien sans valeur', () => {
    expect(curveOffsets([])).toEqual([]);
  });
});

describe('Le plancher de l échelle', () => {
  it('ne descend pas sous zéro pour des grandeurs qui n y descendent pas', () => {
    // Un quart de l'écart sous 32 tomberait à -2, et la graduation
    // annoncerait un volume négatif : une grandeur qui n'existe pas.
    expect(chartScale([32, 168]).floor).toBe(0);
  });

  it('garde sa marge quand elle reste positive', () => {
    expect(chartScale([100, 180]).floor).toBe(80);
  });
});
