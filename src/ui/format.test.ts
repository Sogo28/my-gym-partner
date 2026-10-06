import { describe, expect, it } from 'vitest';
import { formatLongDate, formatMinutes, lastDoneLabel } from './format';

// Un mardi.
const now = new Date(2026, 9, 6, 9, 0);

describe('La date du jour en toutes lettres', () => {
  it('donne le jour, son numéro et le mois', () => {
    expect(formatLongDate(now)).toBe('Mardi 6 octobre');
  });
});

/**
 * « Jeudi » : ce qu'on lit sous un entraînement pour choisir lequel
 * refaire.
 */
describe('La dernière fois qu un entraînement a été fait', () => {
  it('dit qu il n a jamais été fait', () => {
    expect(lastDoneLabel(undefined, now)).toBe('Jamais');
  });

  it('nomme aujourd hui et hier', () => {
    expect(lastDoneLabel(new Date(2026, 9, 6, 7, 0), now)).toBe("Aujourd'hui");
    expect(lastDoneLabel(new Date(2026, 9, 5, 22, 0), now)).toBe('Hier');
  });

  it('nomme le jour dans la semaine qui précède, avec sa majuscule', () => {
    expect(lastDoneLabel(new Date(2026, 9, 1, 18, 0), now)).toBe('Jeudi');
  });

  it('date ce qui est plus ancien, sans l année quand c est la nôtre', () => {
    expect(lastDoneLabel(new Date(2026, 8, 12, 18, 0), now)).toBe('12 sept.');
  });

  it('ajoute l année quand ce n est pas la nôtre', () => {
    expect(lastDoneLabel(new Date(2025, 11, 20, 18, 0), now)).toBe('20 déc. 2025');
  });
});

describe('La durée d une séance', () => {
  it('se dit en minutes, arrondies', () => {
    expect(formatMinutes(3127)).toBe('52 min');
  });

  it('passe aux heures à partir de soixante minutes', () => {
    expect(formatMinutes(3900)).toBe('1 h 05');
  });

  it('ne dit jamais zéro minute pour une séance qui a eu lieu', () => {
    expect(formatMinutes(20)).toBe('1 min');
  });
});
