import { describe, expect, it } from 'vitest';
import { normalizeMedia, sourceOf } from './media';

describe('Médias d un exercice', () => {
  it('refuse un lien sans schéma', () => {
    // Le téléphone ne saurait pas quelle application ouvrir : l'échec
    // arriverait au moment de le lire, pas au moment de le saisir.
    expect(() =>
      normalizeMedia([{ kind: 'link', uri: 'youtube.com/x', label: null, trim: null }]),
    ).toThrow();
  });

  it('refuse deux fois la même adresse', () => {
    expect(() =>
      normalizeMedia([
        { kind: 'link', uri: 'https://a.tld/v', label: 'un', trim: null },
        { kind: 'link', uri: 'https://a.tld/v', label: 'deux', trim: null },
      ]),
    ).toThrow();
  });

  it('garde l ordre et ramène un intitulé vide à rien', () => {
    const media = normalizeMedia([
      { kind: 'link', uri: ' https://b.tld/2 ', label: '  ', trim: null },
      { kind: 'link', uri: 'https://a.tld/1', label: ' Démo ', trim: null },
    ]);

    expect(media).toEqual([
      { kind: 'link', uri: 'https://b.tld/2', label: null, trim: null },
      { kind: 'link', uri: 'https://a.tld/1', label: 'Démo', trim: null },
    ]);
  });

  it('nomme un lien par son domaine quand il n a pas d intitulé', () => {
    expect(
      sourceOf({ kind: 'link', uri: 'https://www.youtube.com/watch?v=1', label: null, trim: null }),
    ).toBe('youtube.com');
  });

  it('retient les bornes d un extrait', () => {
    const [media] = normalizeMedia([
      { kind: 'file', uri: 'a.mp4', label: null, trim: { from: 3.2, to: 7.8 } },
    ]);

    expect(media.trim).toEqual({ from: 3.2, to: 7.8 });
  });

  it('refuse un extrait qui finit avant de commencer', () => {
    expect(() =>
      normalizeMedia([{ kind: 'file', uri: 'a.mp4', label: null, trim: { from: 8, to: 3 } }]),
    ).toThrow();
  });

  it('refuse de borner un lien : sa lecture se passe ailleurs', () => {
    // Elle a lieu dans une autre application, où nous n'avons pas la main.
    expect(() =>
      normalizeMedia([
        { kind: 'link', uri: 'https://a.tld/v', label: null, trim: { from: 0, to: 3 } },
      ]),
    ).toThrow();
  });
});
