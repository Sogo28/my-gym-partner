import { describe, expect, it } from 'vitest';
import { cn } from './cn';

/**
 * La fusion des classes, et le piège qu'elle a tendu pendant des semaines.
 *
 * `text-` désigne en Tailwind aussi bien une taille qu'une couleur.
 * tailwind-merge range les classes par NOM, sans lire notre thème : il tenait
 * donc `text-micro` pour une couleur, et le supprimait en voyant la couleur
 * suivante. Les composants perdaient leur taille sans que rien ne le dise --
 * ni le typage, ni les tests, ni le rendu, qui retombait simplement sur la
 * taille par défaut de React Native.
 */
describe('cn', () => {
  it('garde la taille ET la couleur, qui portent le même préfixe', () => {
    const result = cn('font-medium text-micro', 'text-muted dark:text-muted-dark');

    expect(result).toContain('text-micro');
    expect(result).toContain('text-muted');
  });

  it('garde chaque rôle de l échelle', () => {
    for (const role of [
      'micro',
      'caption',
      'label',
      'small',
      'body',
      'lead',
      'strong',
      'heading',
      'value',
      'title',
      'display',
      'timer',
    ]) {
      expect(cn(`text-${role}`, 'text-ink')).toContain(`text-${role}`);
    }
  });

  it('laisse toujours la dernière taille gagner', () => {
    // Ce que cn sert à faire : un composant accepte un className qui écrase
    // le sien.
    expect(cn('text-small', 'text-body')).toBe('text-body');
  });

  it('laisse toujours la dernière couleur gagner', () => {
    expect(cn('text-muted', 'text-ink')).toBe('text-ink');
  });
});
