import { describe, expect, it } from 'vitest';
import { useCleanDatabase } from '../../test/support';
import { getDatabase, SCHEMA_VERSION } from './db';

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

  /**
   * Le module natif garde les bases ouvertes dans un cache, exprès pour
   * survivre aux rechargements à chaud : il rend LA MÊME à qui la redemande.
   * Rouvrir sans fermer d'abord redonne donc la morte, indéfiniment.
   */
  it('ferme la base morte avant d en rouvrir une', async () => {
    const db = await getDatabase();
    const answering = db.getFirstAsync;

    let closed = 0;
    db.closeAsync = async () => {
      closed += 1;
      // Fermer un objet natif déjà détruit échoue : la reprise ne doit pas
      // s'arrêter là-dessus.
      throw new Error('Cannot use shared object that was already released');
    };

    let released = true;
    db.getFirstAsync = ((...args: Parameters<typeof answering>) => {
      if (released) {
        released = false;
        throw new Error('Cannot use shared object that was already released');
      }
      return answering.apply(db, args);
    }) as typeof answering;

    await expect(getDatabase()).resolves.toBeDefined();
    expect(closed).toBe(1);
  });

  /**
   * Rien n'enferme les migrations dans une transaction, et le numéro de
   * version ne se pose qu'à la fin : une migration coupée en plein vol laisse
   * la base à moitié à jour. Le démarrage suivant la rejoue -- et doit
   * survivre à ce qui a déjà été fait, sous peine de ne plus jamais ouvrir.
   */
  it('rejoue une migration interrompue sans échouer sur ce qui est déjà fait', async () => {
    const db = await getDatabase();
    // L'état que laisse une coupure : la colonne posée, la version en arrière.
    await db.execAsync('PRAGMA user_version = 27;');

    const answering = db.getFirstAsync;
    let released = true;
    db.getFirstAsync = ((...args: Parameters<typeof answering>) => {
      if (released) {
        released = false;
        throw new Error('Cannot use shared object that was already released');
      }
      return answering.apply(db, args);
    }) as typeof answering;

    await expect(getDatabase()).resolves.toBeDefined();
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    // La version courante, et non un nombre gelé : ce test parle de la
    // REPRISE d'une migration, pas de celle qui se trouvait être la dernière
    // le jour où il a été écrit.
    expect(version?.user_version).toBe(SCHEMA_VERSION);
  });
});
