import { describe, expect, it } from 'vitest';
import { normalizeMedia, sourceOf } from './media';

describe('Médias d un exercice', () => {
  it('refuse un lien sans schéma', () => {
    // Le téléphone ne saurait pas quelle application ouvrir : l'échec
    // arriverait au moment de le lire, pas au moment de le saisir.
    expect(() => normalizeMedia([{ kind: 'link', uri: 'youtube.com/x', label: null }])).toThrow();
  });

  it('refuse deux fois la même adresse', () => {
    expect(() =>
      normalizeMedia([
        { kind: 'link', uri: 'https://a.tld/v', label: 'un' },
        { kind: 'link', uri: 'https://a.tld/v', label: 'deux' },
      ]),
    ).toThrow();
  });

  it('garde l ordre et ramène un intitulé vide à rien', () => {
    const media = normalizeMedia([
      { kind: 'link', uri: ' https://b.tld/2 ', label: '  ' },
      { kind: 'link', uri: 'https://a.tld/1', label: ' Démo ' },
    ]);

    expect(media).toEqual([
      { kind: 'link', uri: 'https://b.tld/2', label: null },
      { kind: 'link', uri: 'https://a.tld/1', label: 'Démo' },
    ]);
  });

  it('nomme un lien par son domaine quand il n a pas d intitulé', () => {
    expect(sourceOf({ kind: 'link', uri: 'https://www.youtube.com/watch?v=1', label: null })).toBe(
      'youtube.com',
    );
  });
});
