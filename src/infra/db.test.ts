import { describe, expect, it } from 'vitest';
import { useCleanDatabase } from '../../test/support';
import { getDatabase } from './db';

useCleanDatabase();

/**
 * La poignée gardée en cache pointe vers un objet NATIF, que le JavaScript ne
 * tient pas en vie : un rechargement à chaud le libère sans prévenir, et la
 * requête suivante échoue sur une base que personne n'a fermée.
 */
describe('L ouverture de la base', () => {
  it('sert la même connexion tant qu elle répond', async () => {
    expect(await getDatabase()).toBe(await getDatabase());
  });

  it('rouvre quand celle en cache ne répond plus', async () => {
    const db = await getDatabase();
    const answering = db.getFirstAsync;

    // Ce que fait un rechargement à chaud : l'objet natif part, la poignée
    // reste. La connexion suivante doit repartir d'une base vivante.
    let released = true;
    db.getFirstAsync = ((...args: Parameters<typeof answering>) => {
      if (released) {
        released = false;
        throw new Error('Cannot use shared object that was already released');
      }
      return answering.apply(db, args);
    }) as typeof answering;

    await expect(getDatabase()).resolves.toBeDefined();
    await expect((await getDatabase()).getFirstAsync('SELECT 1;')).resolves.toBeDefined();
  });

});
