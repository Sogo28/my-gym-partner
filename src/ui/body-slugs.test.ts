import { describe, expect, it } from 'vitest';
import { highlight } from './body-slugs';

describe('Schéma des muscles travaillés', () => {
  it('éclaire toutes les régions que notre groupe recouvre', () => {
    // Notre « Dos » est plus large que les régions du dessin.
    expect(highlight(['dos'], [])).toEqual([
      { slug: 'upper-back', intensity: 2 },
      { slug: 'trapezius', intensity: 2 },
    ]);
  });

  it('distingue ce qui est visé de ce qui soutient', () => {
    const parts = highlight(['pectoraux'], ['triceps']);

    expect(parts).toContainEqual({ slug: 'chest', intensity: 2 });
    expect(parts).toContainEqual({ slug: 'triceps', intensity: 1 });
  });

  it('retient le rôle le plus fort quand un muscle tient les deux', () => {
    // Visé par un exercice, en soutien dans un autre : c'est visé.
    expect(highlight(['biceps'], ['biceps'])).toEqual([{ slug: 'biceps', intensity: 2 }]);
  });

  it('ignore un groupe que le dessin ne connaît pas', () => {
    expect(highlight(['inconnu'], [])).toEqual([]);
  });
});
