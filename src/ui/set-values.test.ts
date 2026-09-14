import { describe, expect, it } from 'vitest';
import { compareToPlan, formatSetValues, formatTargets } from './set-values';

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

/**
 * Une durée ne se lit pas comme un décompte.
 *
 * « 150 s » ne dit pas deux minutes et demie tant qu'on n'a pas divisé -- et
 * depuis qu'on peut saisir des minutes, de telles valeurs existent.
 */
describe('Les durées', () => {
  const unitOf = (id: string) => (id === 'duration' ? 's' : 'reps');

  it('se disent en secondes en dessous de la minute', () => {
    expect(formatSetValues({ BOTH: { duration: 45 } }, unitOf)).toBe('45 s');
  });

  it('se disent en minutes au-delà', () => {
    expect(formatSetValues({ BOTH: { duration: 150 } }, unitOf)).toBe('2:30');
    expect(formatSetValues({ BOTH: { duration: 180 } }, unitOf)).toBe('3:00');
  });

  it('gardent le côté d un exercice unilatéral', () => {
    expect(formatSetValues({ LEFT: { duration: 90 }, RIGHT: { duration: 75 } }, unitOf)).toBe(
      '1:30 g · 1:15 d',
    );
  });

  it('ne touchent pas aux mesures qui ne sont pas des durées', () => {
    expect(formatSetValues({ BOTH: { reps: 150 } }, unitOf)).toBe('150 reps');
  });
});

describe('Comparer une série à sa cible', () => {
  it('est atteinte quand les valeurs correspondent', () => {
    expect(compareToPlan({ reps: 8 }, { BOTH: { reps: 8 } })).toBe('on-target');
  });

  it('est dépassée quand une valeur va au delà, sans qu aucune ne manque', () => {
    expect(compareToPlan({ reps: 8 }, { BOTH: { reps: 10 } })).toBe('above');
  });

  it('est en dessous dès qu une seule valeur manque', () => {
    expect(compareToPlan({ reps: 8, weight: 20 }, { BOTH: { reps: 10, weight: 15 } })).toBe(
      'below',
    );
  });

  it('juge un exercice unilatéral sur son côté le plus faible', () => {
    expect(compareToPlan({ reps: 8 }, { LEFT: { reps: 10 }, RIGHT: { reps: 6 } })).toBe('below');
  });

  it('est dépassée quand la série n était pas prévue', () => {
    expect(compareToPlan(undefined, { BOTH: { reps: 8 } })).toBe('above');
  });

  it('est en dessous quand la série prévue n a jamais été faite', () => {
    expect(compareToPlan({ reps: 8 }, undefined)).toBe('below');
  });
});
