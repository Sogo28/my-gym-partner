import { describe, expect, it } from 'vitest';
import type { PerformanceSet } from './exercise-performance';
import { averageVolume, bestVolume, previousBest, recordsBeaten, volumeOf } from './records';

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

/**
 * Les records d'une séance : ce qu'elle a fait de mieux que toutes celles
 * d'avant, sur le même exercice.
 */
describe('Les records battus', () => {
  it('signale une mesure dépassée, avec ce qui tenait avant', () => {
    const beaten = recordsBeaten([set({ duration: 10 })], [set({ duration: 12 })]);

    expect(beaten).toEqual([{ measurementId: 'duration', value: 12, previous: 10 }]);
  });

  it('ne signale rien la première fois : il n y avait rien à battre', () => {
    expect(recordsBeaten([], [set({ duration: 12 })])).toEqual([]);
  });

  it('ne signale pas un record égalé', () => {
    expect(recordsBeaten([set({ duration: 12 })], [set({ duration: 12 })])).toEqual([]);
  });

  it('juge chaque mesure à part', () => {
    // Plus lourd, mais moins de répétitions : un record de charge, pas de reps.
    const beaten = recordsBeaten([set({ reps: 10, weight: 60 })], [set({ reps: 6, weight: 70 })]);

    expect(beaten.map((record) => record.measurementId)).toEqual(['weight']);
  });

  it('signale le volume dépassé même quand aucune mesure ne l est', () => {
    // 8 x 60 = 480 contre 10 x 40 = 400 et 5 x 70 = 350 : ni la charge ni les
    // répétitions ne bougent, mais le travail fourni, si.
    const beaten = recordsBeaten(
      [set({ reps: 10, weight: 40 }), set({ reps: 5, weight: 70 })],
      [set({ reps: 8, weight: 60 })],
    );

    expect(beaten).toEqual([{ measurementId: null, value: 480, previous: 400 }]);
  });

  it('ignore les séries abandonnées, d un côté comme de l autre', () => {
    const beaten = recordsBeaten(
      [set({ duration: 10 }), set({ duration: 30 }, 'ABANDONED')],
      [set({ duration: 20 }), set({ duration: 40 }, 'ABANDONED')],
    );

    expect(beaten).toEqual([{ measurementId: 'duration', value: 20, previous: 10 }]);
  });
});

/**
 * Le record d'avant : ce que le record actuel a battu, pour dire « 13 reps →
 * 14 reps ».
 */
describe('Le record d avant', () => {
  const on = (day: number, values: Record<string, number>) =>
    ({
      status: 'COMPLETED',
      values: { BOTH: values },
      startedAt: new Date(2026, 8, day, 18, 0),
      endedAt: new Date(2026, 8, day, 18, 1),
      videoUri: null,
    }) as PerformanceSet;

  it('est le meilleur des séries finies avant le record', () => {
    const sets = [on(1, { reps: 12 }), on(3, { reps: 13 }), on(5, { reps: 14 }), on(7, { reps: 11 })];

    expect(previousBest(sets, 'reps', 14)).toBe(13);
  });

  it('se compte depuis la PREMIÈRE fois que le record a été atteint', () => {
    // Égalé le 5, mais établi le 3 : avant le 3, c'était 10 -- pas 12.
    const sets = [on(5, { reps: 12 }), on(3, { reps: 12 }), on(1, { reps: 10 })];

    expect(previousBest(sets, 'reps', 12)).toBe(10);
  });

  it('n existe pas quand le record est la toute première valeur', () => {
    expect(previousBest([on(1, { reps: 12 }), on(2, { reps: 12 })], 'reps', 12)).toBeNull();
  });

  it('se calcule aussi pour le volume', () => {
    const sets = [on(1, { reps: 10, weight: 40 }), on(3, { reps: 8, weight: 60 })];

    expect(previousBest(sets, null, 480)).toBe(400);
  });
});
