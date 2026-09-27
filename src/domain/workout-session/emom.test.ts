import { describe, expect, it } from 'vitest';
import { emomStatus, setupCountdown } from './emom';

const t = (seconds: number) => new Date(2026, 8, 5, 18, 0, seconds);

describe('emomStatus', () => {
  it('donne le temps restant dans le round en cours', () => {
    const status = emomStatus({
      intervalSeconds: 60,
      totalRounds: 10,
      round: 1,
      roundStartedAt: t(0),
      now: t(15),
    });

    expect(status.remainingSeconds).toBe(45);
    expect(status.roundElapsed).toBe(false);
    expect(status.done).toBe(false);
  });

  it('dit que le round est écoulé pile à la limite', () => {
    const status = emomStatus({
      intervalSeconds: 60,
      totalRounds: 10,
      round: 1,
      roundStartedAt: t(0),
      now: t(60),
    });

    expect(status.remainingSeconds).toBe(0);
    expect(status.roundElapsed).toBe(true);
  });

  it('ne descend jamais sous zéro même après la limite', () => {
    const status = emomStatus({
      intervalSeconds: 60,
      totalRounds: 10,
      round: 1,
      roundStartedAt: t(0),
      now: t(90),
    });

    expect(status.remainingSeconds).toBe(0);
  });

  it('n est fini que sur le DERNIER round écoulé', () => {
    const avantDernier = emomStatus({
      intervalSeconds: 60,
      totalRounds: 3,
      round: 2,
      roundStartedAt: t(0),
      now: t(60),
    });
    expect(avantDernier.done).toBe(false);

    const dernier = emomStatus({
      intervalSeconds: 60,
      totalRounds: 3,
      round: 3,
      roundStartedAt: t(0),
      now: t(60),
    });
    expect(dernier.done).toBe(true);
  });
});

/**
 * Le temps de ranger le téléphone et de se mettre en position, avant que la
 * première minute ne commence à courir.
 */
describe('Le décompte de mise en place', () => {
  const armedAt = new Date(2026, 8, 27, 18, 0, 0);
  const at = (seconds: number) => new Date(armedAt.getTime() + seconds * 1000);

  it('décompte jusqu au départ', () => {
    expect(setupCountdown({ seconds: 10, armedAt, now: at(0) })).toEqual({
      remainingSeconds: 10,
      ready: false,
    });
    expect(setupCountdown({ seconds: 10, armedAt, now: at(7) })).toEqual({
      remainingSeconds: 3,
      ready: false,
    });
  });

  it('est prêt une fois le temps écoulé, et ne descend pas sous zéro', () => {
    expect(setupCountdown({ seconds: 10, armedAt, now: at(10) })).toEqual({
      remainingSeconds: 0,
      ready: true,
    });
    // Revenir sur l'app longtemps après ne doit pas rendre un temps négatif.
    expect(setupCountdown({ seconds: 10, armedAt, now: at(600) })).toEqual({
      remainingSeconds: 0,
      ready: true,
    });
  });

  it('part tout de suite quand on ne demande aucun délai', () => {
    expect(setupCountdown({ seconds: 0, armedAt, now: at(0) })).toEqual({
      remainingSeconds: 0,
      ready: true,
    });
  });
});
