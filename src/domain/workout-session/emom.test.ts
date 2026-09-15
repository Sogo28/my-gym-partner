import { describe, expect, it } from 'vitest';
import { emomStatus } from './emom';

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
