import { describe, expect, it } from 'vitest';
import { formatSetValues, formatTargets } from './set-values';

const unitOf = (id: string) => ({ reps: 'reps', weight: 'kg' })[id] ?? id;

describe('mise en forme des valeurs', () => {
  it('lit une série faite, côté par côté', () => {
    expect(formatSetValues({ LEFT: { reps: 12 }, RIGHT: { reps: 9 } }, unitOf)).toBe(
      '12 reps g · 9 reps d',
    );
  });

  it('lit une série prévue, dont les cibles ne portent pas de côté', () => {
    // Passées au formateur des séries faites, ces cibles ressortaient vides :
    // leurs clés sont des mesures, pas des côtés.
    expect(formatTargets({ reps: 10, weight: 20 }, unitOf)).toBe('10 reps · 20 kg');
  });
});
