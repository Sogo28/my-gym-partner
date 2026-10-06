import { describe, expect, it } from 'vitest';
import { formatLongDate, lastDoneLabel } from './format';

// Un mardi.
const now = new Date(2026, 9, 6, 9, 0);

describe('La date du jour en toutes lettres', () => {
  it('donne le jour, son numéro et le mois', () => {
    expect(formatLongDate(now)).toBe('mardi 6 octobre');
  });
});

/**
 * « Fait jeudi » : ce qu'on lit sous un entraînement pour choisir lequel
 * refaire.
 */
describe('La dernière fois qu un entraînement a été fait', () => {
  it('dit qu il n a jamais été fait', () => {
    expect(lastDoneLabel(undefined, now)).toBe('jamais fait');
  });

  it('nomme aujourd hui et hier', () => {
    expect(lastDoneLabel(new Date(2026, 9, 6, 7, 0), now)).toBe("fait aujourd'hui");
    expect(lastDoneLabel(new Date(2026, 9, 5, 22, 0), now)).toBe('fait hier');
  });

  it('nomme le jour dans la semaine qui précède', () => {
    expect(lastDoneLabel(new Date(2026, 9, 1, 18, 0), now)).toBe('fait jeudi');
  });

  it('date ce qui est plus ancien, sans l année quand c est la nôtre', () => {
    expect(lastDoneLabel(new Date(2026, 8, 12, 18, 0), now)).toBe('fait le 12 sept.');
  });

  it('ajoute l année quand ce n est pas la nôtre', () => {
    expect(lastDoneLabel(new Date(2025, 11, 20, 18, 0), now)).toBe('fait le 20 déc. 2025');
  });
});
