import { describe, expect, it } from 'vitest';
import { isRemote, normalizeMedia, sourceOf } from './media';

const image = { kind: 'image' as const, uri: 'https://a.tld/x.webp', label: null, trim: null };
const video = { kind: 'video' as const, uri: 'clip.mp4', label: null, trim: null };

describe('Médias d un exercice', () => {
  it('lit dans l adresse où le média vit', () => {
    // Aucune colonne pour ça : une illustration importée et une photo prise
    // soi-même sont la même chose pour qui la regarde.
    expect(isRemote(image)).toBe(true);
    expect(isRemote(video)).toBe(false);
  });

  it('refuse deux fois la même adresse', () => {
    expect(() => normalizeMedia([image, { ...image, label: 'bis' }])).toThrow();
  });

  it('garde l ordre et ramène un intitulé vide à rien', () => {
    const media = normalizeMedia([
      { ...video, label: '  ' },
      { ...image, label: ' Démo ' },
    ]);

    expect(media.map((item) => item.label)).toEqual([null, 'Démo']);
    expect(media[0].uri).toBe('clip.mp4');
  });

  it('borne une vidéo, jamais une image', () => {
    expect(normalizeMedia([{ ...video, trim: { from: 1, to: 4 } }])[0].trim).toEqual({
      from: 1,
      to: 4,
    });
    expect(() => normalizeMedia([{ ...image, trim: { from: 0, to: 2 } }])).toThrow();
  });

  it('refuse un extrait qui finit avant de commencer', () => {
    expect(() => normalizeMedia([{ ...video, trim: { from: 8, to: 3 } }])).toThrow();
  });

  it('nomme un média sans intitulé par sa nature', () => {
    expect(sourceOf(image)).toBe('illustration');
    expect(sourceOf({ ...image, uri: 'photo.jpg' })).toBe('photo');
    expect(sourceOf(video)).toBe('vidéo');
  });
});
