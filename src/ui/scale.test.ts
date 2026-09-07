import { describe, expect, it } from 'vitest';
import { barHeights } from './scale';

describe('Hauteur des barres', () => {
  it('donne toute la hauteur à la meilleure valeur', () => {
    expect(barHeights([10, 20])[1]).toBe(100);
  });

  it('creuse l écart plutôt que de partir de zéro', () => {
    // 40 et 45 partis de zéro donneraient 89 % et 100 % : indistinguables.
    const [low, high] = barHeights([40, 45]);
    expect(high).toBe(100);
    expect(low).toBeLessThan(30);
  });

  it('dessine un plateau quand rien ne varie', () => {
    // Un poids jamais changé, ou un zéro partout : l'écart est nul, et le
    // calcul d'échelle donnait NaN -- donc un graphe vide à l'écran.
    expect(barHeights([20, 20, 20])).toEqual([100, 100, 100]);
    expect(barHeights([0, 0])).toEqual([100, 100]);
  });

  it('ne rend jamais une barre invisible', () => {
    expect(Math.min(...barHeights([1, 1000]))).toBeGreaterThanOrEqual(6);
  });
});
