import { getDatabase } from './db';
import { tableNames } from './backup';

/**
 * Les tables que l'application FOURNIT, par opposition à celles qu'elle
 * enregistre : mesures et muscles sont un vocabulaire, pas des données.
 *
 * Les effacer ne repartirait pas de zéro, ça casserait l'app -- sans mesure,
 * aucun exercice ne peut plus être créé.
 */
const CATALOGUES = ['measurements', 'muscles'];

/**
 * Efface tout ce que tu as saisi, et rien d'autre.
 *
 * Les mensurations du catalogue de départ survivent, celles que tu as créées
 * partent avec le reste : `built_in` est précisément là pour distinguer les
 * deux, et une mensuration inventée est une donnée, pas du vocabulaire.
 */
export async function resetData(): Promise<void> {
  const db = await getDatabase();
  const names = await tableNames();

  // Les contraintes sont relâchées le temps du vidage : l'ordre des tables
  // violerait forcément une clé étrangère à un moment. Le PRAGMA ne peut pas
  // être posé dans une transaction, d'où sa place ici.
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await db.withTransactionAsync(async () => {
      for (const name of [...names].reverse()) {
        if (CATALOGUES.includes(name) || name === 'body_metrics') continue;
        await db.runAsync(`DELETE FROM ${name};`);
      }

      await db.runAsync('DELETE FROM body_metrics WHERE built_in = 0;');
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
}

/**
 * Efface l'HISTORIQUE : les séances et ce qu'elles ont produit.
 *
 * Ce qui reste : les exercices, les entraînements, les objectifs, les relevés
 * corporels. Rien de tout cela n'est de l'historique -- ce sont les outils
 * avec lesquels on s'entraîne, et ils survivent à l'effacement de ce qu'on en
 * a fait.
 *
 * Les intentions déjà CONSOMMÉES partent aussi : une séance programmée puis
 * exécutée ne désigne plus rien une fois la séance effacée. Celles qui
 * attendent encore restent -- une intention n'est pas un souvenir.
 *
 * L'étape atteinte d'un objectif ne bouge pas : on l'a franchie, et effacer
 * la trace de la séance ne défait pas ce qui a été fait.
 */
export async function deleteHistory(): Promise<void> {
  const db = await getDatabase();

  // Même raison qu'au-dessus : l'ordre des suppressions violerait forcément
  // une clé étrangère à un moment.
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM performance_set_values;');
      await db.runAsync('DELETE FROM performance_sets;');
      await db.runAsync('DELETE FROM exercise_performances;');
      await db.runAsync('DELETE FROM session_rests;');
      await db.runAsync('DELETE FROM session_activities;');
      await db.runAsync('DELETE FROM workout_sessions;');
      await db.runAsync("DELETE FROM scheduled_workouts WHERE status = 'EXECUTED';");
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
}
