import { describe, expect, it } from 'vitest';
import { __failNextOpen } from '../../test/fake-expo-sqlite';
import { getDatabase } from './db';

/**
 * La connexion est mémorisée une fois pour toutes : c'est ce qui évite de
 * rejouer les migrations à chaque requête. Mais mémoriser un ÉCHEC condamnait
 * la session entière -- toute requête suivante rejouait la même erreur, même
 * quand sa cause était passée.
 */
describe('getDatabase', () => {
  it('rouvre après une ouverture qui a échoué', async () => {
    __failNextOpen();

    await expect(getDatabase()).rejects.toThrow(/already released/);
    // La demande suivante doit repartir d'une ouverture neuve.
    await expect(getDatabase()).resolves.toBeDefined();
  });

  it('sert ensuite la même connexion', async () => {
    expect(await getDatabase()).toBe(await getDatabase());
  });
});
