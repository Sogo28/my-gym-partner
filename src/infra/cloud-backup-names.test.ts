import { describe, expect, it } from 'vitest';
import { fileNameAt, instantOf } from './cloud-backup-names';

/**
 * Le nom d'une sauvegarde en ligne EST son horodatage.
 *
 * Deux propriétés en dépendent, et aucune n'est visible à la lecture du
 * code : la liste se trie par nom côté serveur, donc l'ordre alphabétique
 * doit être l'ordre chronologique ; et la date affichée se relit du nom,
 * sans télécharger le fichier pour l'apprendre.
 */
describe('le nom d une sauvegarde en ligne', () => {
  it('se relit à l instant près', () => {
    const instant = new Date('2026-09-19T21:30:00.123Z');

    expect(instantOf(fileNameAt(instant))?.getTime()).toBe(instant.getTime());
  });

  it('ne contient ni deux-points ni point, qui n ont rien à faire dans une clé', () => {
    const name = fileNameAt(new Date('2026-09-19T21:30:00.123Z'));

    expect(name).toBe('2026-09-19T21-30-00-123Z.json');
    expect(name.slice(0, -'.json'.length)).not.toMatch(/[:.]/);
  });

  it('range en ordre chronologique quand on le range en ordre alphabétique', () => {
    const instants = [
      new Date('2026-01-02T03:04:05.006Z'),
      new Date('2026-09-19T21:30:00.123Z'),
      new Date('2026-09-19T21:30:00.124Z'),
      new Date('2027-01-01T00:00:00.000Z'),
    ];

    const names = instants.map(fileNameAt);
    const shuffled = [names[3]!, names[0]!, names[2]!, names[1]!];

    expect([...shuffled].sort()).toEqual(names);
  });

  it('ignore ce qui ne vient pas de l application', () => {
    expect(instantOf('sauvegarde.json')).toBeNull();
    expect(instantOf('2026-09-19T21-30-00-123Z.txt')).toBeNull();
    expect(instantOf('')).toBeNull();
    // Un mois 47 se lit bien comme une date par la forme, jamais par le sens.
    expect(instantOf('2026-47-19T21-30-00-123Z.json')).toBeNull();
  });
});
