import { getDatabase, inTransaction, SCHEMA_VERSION } from './db';

/**
 * Copie et restauration de toute la base.
 *
 * Les données ne vivent qu'ici, sur un appareil qu'on emmène à la salle :
 * c'est le seul point du projet dont la perte serait irréversible.
 *
 * Le format est un JSON lisible plutôt qu'une copie binaire du fichier
 * SQLite : on peut l'ouvrir, l'inspecter, et constater ce qu'il contient
 * avant de le restaurer. Il porte la version du schéma qui l'a produit, car
 * une sauvegarde d'un schéma inconnu ne doit pas être écrasée sur un autre.
 */
export type Backup = {
  readonly app: 'my-gym-partner';
  readonly schemaVersion: number;
  readonly exportedAt: string;
  readonly tables: Record<string, Record<string, unknown>[]>;
  /**
   * Les fichiers locaux qui accompagnaient cette génération en ligne.
   *
   * Facultatif pour continuer à lire les sauvegardes historiques et les
   * exports JSON partagés avant que les médias ne voyagent avec le cloud.
   */
  readonly media?: BackupMediaManifest;
};

/** Un objet immuable du dossier `media`, déposé une seule fois en ligne. */
export type BackupMedia = {
  readonly name: string;
  readonly size: number;
  readonly md5: string | null;
  readonly contentType: string;
};

/**
 * Le manifeste d'une génération.
 *
 * `missing` ne cache pas une perte déjà présente sur le téléphone : la base
 * reste sauvegardée, mais la restauration pourra annoncer honnêtement quels
 * fichiers ne faisaient plus partie de l'appareil au moment de la copie.
 */
export type BackupMediaManifest = {
  readonly files: readonly BackupMedia[];
  readonly missing: readonly string[];
  /**
   * Laissés de côté VOLONTAIREMENT : les vidéos des séries, quand on a choisi
   * de ne pas les sauvegarder en ligne (décidé le 2026-10-08). Absent dans les
   * copies d'avant ce choix.
   */
  readonly excluded?: readonly string[];
};

/** Les tables de l'application, dans l'ordre où SQLite les a créées. */
export async function tableNames(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
     ORDER BY rootpage;`,
  );
  return rows.map((row) => row.name);
}

export async function exportBackup(): Promise<Backup> {
  const db = await getDatabase();
  const tables: Record<string, Record<string, unknown>[]> = {};

  for (const name of await tableNames()) {
    tables[name] = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${name};`);
  }

  return {
    app: 'my-gym-partner',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

/**
 * Remplace TOUT le contenu de la base par celui de la sauvegarde.
 *
 * Opération destructrice, et volontairement sans fusion : mélanger deux
 * historiques produirait des séances en double sans qu'on sache lesquelles
 * sont vraies.
 */
export async function restoreBackup(backup: Backup): Promise<void> {
  if (backup.app !== 'my-gym-partner') {
    throw new Error("Ce fichier n'est pas une sauvegarde de l'application.");
  }
  if (backup.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Cette sauvegarde vient d'une version différente de l'application ` +
        `(${backup.schemaVersion} au lieu de ${SCHEMA_VERSION}).`,
    );
  }

  const db = await getDatabase();
  const names = await tableNames();

  // Les contraintes sont relâchées le temps du remplacement : les tables se
  // vident et se remplissent dans un ordre qui violerait forcément une clé
  // étrangère à un moment. Le PRAGMA ne peut pas être posé dans une
  // transaction, d'où sa place ici.
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await inTransaction(db, async () => {
      for (const name of [...names].reverse()) {
        await db.runAsync(`DELETE FROM ${name};`);
      }

      for (const name of names) {
        for (const row of backup.tables[name] ?? []) {
          const columns = Object.keys(row);
          if (columns.length === 0) continue;

          const holes = columns.map(() => '?').join(', ');
          await db.runAsync(
            `INSERT INTO ${name} (${columns.join(', ')}) VALUES (${holes});`,
            ...(columns.map((column) => row[column]) as never[]),
          );
        }
      }
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
}
