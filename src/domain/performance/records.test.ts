import { describe, expect, it } from 'vitest';
import type { PerformanceSet } from './exercise-performance';
import { averageVolume, bestVolume, volumeOf } from './records';

const at = new Date(2026, 8, 13, 18, 0);

const set = (values: Record<string, number>, status: PerformanceSet['status'] = 'COMPLETED') =>
  ({ status, values: { BOTH: values }, startedAt: at, endedAt: at, videoUri: null }) as PerformanceSet;

/**
 * Le volume d'une série : le produit de ce qu'elle a mesuré.
 *
 * Il existe parce qu'une mesure prise seule ne dit qu'une moitié : soixante
 * kilos ne distingue pas cinq répétitions de douze, et c'est pourtant la
 * différence qui intéresse quand on cherche à progresser.
 */
describe('Le volume d une série', () => {
  it('multiplie les mesures entre elles', () => {
    expect(volumeOf(set({ reps: 12, weight: 60 }))).toBe(720);
  });

  it('marche sur des mesures qui ne sont ni des kilos ni des répétitions', () => {
    // Douze tenues de dix secondes : le produit dit le travail demandé, comme
    // pour une charge.
    expect(volumeOf(set({ reps: 12, duration: 10 }))).toBe(120);
  });

  it('n en donne aucun à une série qui ne mesure qu une chose', () => {
    // Répéter la durée sous un autre nom n'apprendrait rien.
    expect(volumeOf(set({ duration: 12 }))).toBeNull();
  });

  it('n en donne aucun à une série non validée', () => {
    expect(volumeOf(set({ reps: 12, weight: 60 }, 'ABANDONED'))).toBeNull();
  });

  it('retient le meilleur, pas le dernier', () => {
    const best = bestVolume([
      set({ reps: 12, weight: 60 }),
      set({ reps: 5, weight: 100 }),
      set({ reps: 8, weight: 60 }),
    ]);

    expect(best?.value).toBe(720);
  });

  it('ne retient rien quand aucune série n a de volume', () => {
    expect(bestVolume([set({ duration: 12 })])).toBeNull();
  });
});

/**
 * Ce qu'une SÉANCE vaut, et non l'une de ses séries.
 */
describe('Le volume moyen d une séance', () => {
  it('fait la moyenne des séries, pas leur somme', () => {
    // La somme monterait pour la seule raison qu'on a fait une série de plus.
    expect(
      averageVolume([set({ reps: 10, weight: 60 }), set({ reps: 10, weight: 40 })]),
    ).toBe(500);
  });

  it('ne laisse pas une série abandonnée tirer la moyenne vers le bas', () => {
    const sets = [set({ reps: 10, weight: 60 }), set({ reps: 1, weight: 10 }, 'ABANDONED')];

    // Une série abandonnée n'est pas une performance (n°18) : elle ne compte
    // ni au numérateur ni au dénominateur.
    expect(averageVolume(sets)).toBe(600);
  });

  it('ne retient rien quand aucune série n a de volume', () => {
    expect(averageVolume([set({ duration: 12 })])).toBeNull();
  });
});
