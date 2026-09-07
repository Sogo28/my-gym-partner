import * as SQLite from 'expo-sqlite';

/**
 * Ouverture de la base SQLite embarquée + création du schéma.
 *
 * `user_version` est un compteur fourni par SQLite lui-même : on l'utilise
 * comme numéro de version du schéma. Chaque future évolution ajoutera un bloc
 * `if (version < N)`, ce qui nous donne des migrations sans outil externe.
 */
export const SCHEMA_VERSION = 21;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= openAndMigrate();
  return dbPromise;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('my-gym-partner.db');

  // Les clés étrangères sont désactivées par défaut dans SQLite.
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const version = row?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE measurements (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        unit TEXT NOT NULL
      );

      CREATE TABLE exercises (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        is_unilateral INTEGER NOT NULL
      );

      -- Un exercice référence plusieurs mesures, une mesure sert à plusieurs
      -- exercices : la relation a besoin de sa propre table.
      -- 'position' conserve l'ordre dans lequel l'utilisateur les a choisies.
      CREATE TABLE exercise_measurements (
        exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        measurement_id TEXT NOT NULL REFERENCES measurements(id),
        position INTEGER NOT NULL,
        PRIMARY KEY (exercise_id, measurement_id)
      );
    `);
    await seedMeasurements(db);
  }

  // Migration 2 : entraînements planifiés (Slice 2).
  // Ce bloc s'exécute AUSSI sur une base déjà en version 1 -- celle qui
  // contient déjà tes exercices. Le bloc précédent, lui, ne rejouera pas :
  // c'est tout l'intérêt du compteur, faire évoluer le schéma sans effacer
  // les données existantes.
  if (version < 2) {
    await db.execAsync(`
      CREATE TABLE planned_workouts (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL
      );

      -- 'position' fait partie de la clé : c'est elle qui identifie un
      -- exercice planifié, puisqu'un même exercice peut figurer deux fois.
      CREATE TABLE planned_workout_exercises (
        workout_id TEXT NOT NULL REFERENCES planned_workouts(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        exercise_id TEXT NOT NULL REFERENCES exercises(id),
        PRIMARY KEY (workout_id, position)
      );

      -- Une ligne par cible : "set 1 = 8 reps à +10 kg" occupe deux lignes.
      -- La clé étrangère vers measurements garantit qu'on ne peut pas cibler
      -- une mesure qui n'existe pas.
      CREATE TABLE planned_workout_sets (
        workout_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        set_index INTEGER NOT NULL,
        measurement_id TEXT NOT NULL REFERENCES measurements(id),
        target_value REAL NOT NULL,
        PRIMARY KEY (workout_id, position, set_index, measurement_id),
        FOREIGN KEY (workout_id, position)
          REFERENCES planned_workout_exercises(workout_id, position) ON DELETE CASCADE
      );
    `);
  }

  // Migration 3 : séances réelles (Slice 3).
  if (version < 3) {
    await db.execAsync(`
      -- SQLite n'a pas de type date : on stocke les instants en ISO 8601
      -- ('2026-09-05T18:00:00.000Z'), qui a la bonne propriété de se trier
      -- chronologiquement en tant que texte.
      CREATE TABLE workout_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        planned_workout_id TEXT REFERENCES planned_workouts(id),
        started_at TEXT NOT NULL,
        ended_at TEXT,
        -- La base refuse elle-même un état inconnu : l'invariant du domaine
        -- est doublé par une garantie du stockage.
        status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED'))
      );

      CREATE TABLE session_activities (
        session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        exercise_id TEXT NOT NULL REFERENCES exercises(id),
        started_at TEXT NOT NULL,
        finished_at TEXT,
        PRIMARY KEY (session_id, position)
      );
    `);
  }

  // Migration 4 : performances réelles (Slice 4).
  if (version < 4) {
    await db.execAsync(`
      -- ALTER TABLE plutôt que recréation : les séances déjà enregistrées
      -- restent en place, leur performance_id vaut simplement NULL.
      ALTER TABLE session_activities ADD COLUMN performance_id TEXT;

      CREATE TABLE exercise_performances (
        id TEXT PRIMARY KEY NOT NULL,
        exercise_id TEXT NOT NULL REFERENCES exercises(id),
        started_at TEXT NOT NULL
      );

      -- Les mesures sont copiées au moment de la performance : si l'exercice
      -- change plus tard, la performance garde le sens qu'elle avait (§2).
      CREATE TABLE exercise_performance_measurements (
        performance_id TEXT NOT NULL REFERENCES exercise_performances(id) ON DELETE CASCADE,
        measurement_id TEXT NOT NULL REFERENCES measurements(id),
        position INTEGER NOT NULL,
        PRIMARY KEY (performance_id, measurement_id)
      );

      CREATE TABLE performance_sets (
        performance_id TEXT NOT NULL REFERENCES exercise_performances(id) ON DELETE CASCADE,
        set_index INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'ABANDONED')),
        started_at TEXT NOT NULL,
        ended_at TEXT,
        PRIMARY KEY (performance_id, set_index)
      );

      CREATE TABLE performance_set_values (
        performance_id TEXT NOT NULL,
        set_index INTEGER NOT NULL,
        measurement_id TEXT NOT NULL REFERENCES measurements(id),
        value REAL NOT NULL,
        PRIMARY KEY (performance_id, set_index, measurement_id),
        FOREIGN KEY (performance_id, set_index)
          REFERENCES performance_sets(performance_id, set_index) ON DELETE CASCADE
      );
    `);
  }

  // Migration 5 : périodes de repos (§13).
  if (version < 5) {
    await db.execAsync(`
      CREATE TABLE session_rests (
        session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        PRIMARY KEY (session_id, position)
      );
    `);
  }

  // Migration 6 : lien entre une activité et l'exercice planifié dont elle vient.
  if (version < 6) {
    await db.execAsync(`
      ALTER TABLE session_activities ADD COLUMN planned_position INTEGER;
    `);
  }

  // Migration 7 : objectifs et progressions (Slice 6).
  if (version < 7) {
    await db.execAsync(`
      CREATE TABLE goals (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        current_step INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED'))
      );

      CREATE TABLE goal_steps (
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        exercise_id TEXT NOT NULL REFERENCES exercises(id),
        PRIMARY KEY (goal_id, position)
      );

      -- Pas de table pour les requirements : leur seul rôle est de regrouper
      -- des conditions, ce qu'un index suffit à exprimer.
      CREATE TABLE goal_conditions (
        goal_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        requirement_index INTEGER NOT NULL,
        condition_index INTEGER NOT NULL,
        metric_type TEXT NOT NULL
          CHECK (metric_type IN ('average', 'max', 'min', 'total', 'setCount')),
        measurement_id TEXT REFERENCES measurements(id),
        operator TEXT NOT NULL CHECK (operator IN ('>=', '>', '<=', '<', '==')),
        value REAL NOT NULL,
        PRIMARY KEY (goal_id, position, requirement_index, condition_index),
        FOREIGN KEY (goal_id, position)
          REFERENCES goal_steps(goal_id, position) ON DELETE CASCADE
      );
    `);
  }

  // Migration 8 : le modèle des objectifs prend sa forme définitive --
  // un objectif simple porte son requirement directement, sans étape.
  // Les tables de la migration 7 sont recréées ; les objectifs déjà saisis
  // sont perdus, ce qui est assumé (fonctionnalité du jour même).
  if (version < 8) {
    await db.execAsync(`
      DROP TABLE IF EXISTS goal_conditions;
      DROP TABLE IF EXISTS goal_steps;
      DROP TABLE IF EXISTS goals;

      CREATE TABLE goals (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('simple', 'progressive')),
        -- L'exercice visé, pour un objectif simple uniquement.
        exercise_id TEXT REFERENCES exercises(id),
        current_step INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED'))
      );

      CREATE TABLE goal_steps (
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        exercise_id TEXT NOT NULL REFERENCES exercises(id),
        PRIMARY KEY (goal_id, position)
      );

      -- step_position = -1 désigne le requirement de l'objectif lui-même
      -- (cas simple) ; sinon c'est celui de l'étape à cette position.
      CREATE TABLE goal_conditions (
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        step_position INTEGER NOT NULL,
        condition_index INTEGER NOT NULL,
        measurement_id TEXT REFERENCES measurements(id),
        window TEXT NOT NULL CHECK (window IN ('LAST_SESSION')),
        aggregation TEXT NOT NULL
          CHECK (aggregation IN ('average', 'max', 'min', 'total', 'setCount')),
        operator TEXT NOT NULL CHECK (operator IN ('>=', '>', '<=', '<', '==')),
        target REAL NOT NULL,
        PRIMARY KEY (goal_id, step_position, condition_index)
      );
    `);
  }

  // Migration 9 : une étape peut porter plusieurs Requirements, il faut donc
  // savoir de quel requirement chaque condition relève.
  if (version < 9) {
    await db.execAsync(`
      DROP TABLE IF EXISTS goal_conditions;
      CREATE TABLE goal_conditions (
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        step_position INTEGER NOT NULL,
        requirement_index INTEGER NOT NULL,
        condition_index INTEGER NOT NULL,
        measurement_id TEXT REFERENCES measurements(id),
        window TEXT NOT NULL CHECK (window IN ('LAST_SESSION')),
        aggregation TEXT NOT NULL
          CHECK (aggregation IN ('average', 'max', 'min', 'total', 'setCount')),
        operator TEXT NOT NULL CHECK (operator IN ('>=', '>', '<=', '<', '==')),
        target REAL NOT NULL,
        PRIMARY KEY (goal_id, step_position, requirement_index, condition_index)
      );
    `);
  }

  // Migration 10 : archivage. On n'efface pas ce qui a produit de
  // l'historique, on le retire des listes de choix.
  if (version < 10) {
    await db.execAsync(`
      ALTER TABLE exercises ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE planned_workouts ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
    `);
  }

  // Migration 11 : programmation des entraînements (Slice 5).
  if (version < 11) {
    await db.execAsync(`
      CREATE TABLE scheduled_workouts (
        id TEXT PRIMARY KEY NOT NULL,
        planned_workout_id TEXT NOT NULL REFERENCES planned_workouts(id),
        scheduled_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('SCHEDULED', 'EXECUTED', 'CANCELLED'))
      );

      -- D'où vient la séance : d'une intention programmée, ou de rien.
      ALTER TABLE workout_sessions ADD COLUMN scheduled_workout_id TEXT
        REFERENCES scheduled_workouts(id);
    `);
  }

  // Migration 12 : une condition peut désormais porter sur tout l'historique,
  // pas seulement sur la dernière séance.
  //
  // SQLite ne sait pas modifier une contrainte CHECK : il faut recréer la
  // table. On RECOPIE les conditions existantes au lieu de les effacer --
  // contrairement aux migrations 8 et 9, des objectifs sont maintenant en
  // service.
  if (version < 12) {
    await db.execAsync(`
      CREATE TABLE goal_conditions_v12 (
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        step_position INTEGER NOT NULL,
        requirement_index INTEGER NOT NULL,
        condition_index INTEGER NOT NULL,
        measurement_id TEXT REFERENCES measurements(id),
        window TEXT NOT NULL CHECK (window IN ('LAST_SESSION', 'ALL_TIME')),
        aggregation TEXT NOT NULL
          CHECK (aggregation IN ('average', 'max', 'min', 'total', 'setCount')),
        operator TEXT NOT NULL CHECK (operator IN ('>=', '>', '<=', '<', '==')),
        target REAL NOT NULL,
        PRIMARY KEY (goal_id, step_position, requirement_index, condition_index)
      );

      INSERT INTO goal_conditions_v12
        SELECT goal_id, step_position, requirement_index, condition_index,
               measurement_id, window, aggregation, operator, target
        FROM goal_conditions;

      DROP TABLE goal_conditions;
      ALTER TABLE goal_conditions_v12 RENAME TO goal_conditions;
    `);
  }

  // Migration 13 : la contrainte manquante sur le lien vers la performance.
  //
  // Elle avait été ajoutée par ALTER TABLE (migration 4), qui ne peut pas
  // porter de clé étrangère : rien n'empêchait donc une activité de désigner
  // une performance inexistante. Recréer la table est le seul moyen de
  // l'ajouter -- les lignes sont recopiées, pas effacées.
  if (version < 13) {
    // Les contraintes sont relâchées le temps de la manoeuvre, sinon le DROP
    // ferait tomber les lignes qui référencent la table en cours de
    // remplacement.
    await db.execAsync('PRAGMA foreign_keys = OFF;');
    await db.execAsync(`
      CREATE TABLE session_activities_v13 (
        session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        exercise_id TEXT NOT NULL REFERENCES exercises(id),
        performance_id TEXT REFERENCES exercise_performances(id),
        planned_position INTEGER,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        PRIMARY KEY (session_id, position)
      );

      INSERT INTO session_activities_v13
        (session_id, position, exercise_id, performance_id, planned_position,
         started_at, finished_at)
        SELECT session_id, position, exercise_id, performance_id, planned_position,
               started_at, finished_at
        FROM session_activities;

      DROP TABLE session_activities;
      ALTER TABLE session_activities_v13 RENAME TO session_activities;
    `);
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }

  // Migration 14 : groupes musculaires, pour retrouver un exercice.
  if (version < 14) {
    await db.execAsync(`
      CREATE TABLE muscles (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        position INTEGER NOT NULL
      );

      -- Un exercice sollicite plusieurs muscles, un muscle sert à plusieurs
      -- exercices : la relation a sa propre table. Aucune ligne n'est requise,
      -- un exercice peut ne cibler aucun muscle.
      CREATE TABLE exercise_muscles (
        exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        muscle_id TEXT NOT NULL REFERENCES muscles(id),
        PRIMARY KEY (exercise_id, muscle_id)
      );
    `);
    await seedMuscles(db);
  }

  // Migration 15 : le côté du corps auquel une valeur appartient.
  //
  // Le côté n'est pas une mesure (n°22) mais une propriété de l'exécution :
  // il entre donc dans la clé des valeurs, pas dans le catalogue. Les séries
  // déjà enregistrées sont bilatérales, d'où le défaut 'BOTH'.
  if (version < 15) {
    await db.execAsync('PRAGMA foreign_keys = OFF;');
    await db.execAsync(`
      CREATE TABLE performance_set_values_v15 (
        performance_id TEXT NOT NULL,
        set_index INTEGER NOT NULL,
        side TEXT NOT NULL CHECK (side IN ('BOTH', 'LEFT', 'RIGHT')),
        measurement_id TEXT NOT NULL REFERENCES measurements(id),
        value REAL NOT NULL,
        PRIMARY KEY (performance_id, set_index, side, measurement_id),
        FOREIGN KEY (performance_id, set_index)
          REFERENCES performance_sets(performance_id, set_index) ON DELETE CASCADE
      );

      INSERT INTO performance_set_values_v15
        (performance_id, set_index, side, measurement_id, value)
        SELECT performance_id, set_index, 'BOTH', measurement_id, value
        FROM performance_set_values;

      DROP TABLE performance_set_values;
      ALTER TABLE performance_set_values_v15 RENAME TO performance_set_values;
    `);
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }

  // Migration 16 : mensurations et relevés (suivi corporel).
  //
  // Une seconde source de données, à côté des performances : un tour de
  // cuisse ne sort d'aucune série, il se relève à la main.
  if (version < 16) {
    await db.execAsync(`
      CREATE TABLE body_metrics (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        unit TEXT NOT NULL,
        position INTEGER NOT NULL,
        -- Le catalogue de départ ne se supprime pas.
        built_in INTEGER NOT NULL DEFAULT 0
      );

      -- Quels muscles la mensuration concerne : c'est par eux qu'on
      -- retrouvera les exercices qui la soutiennent.
      CREATE TABLE body_metric_muscles (
        metric_id TEXT NOT NULL REFERENCES body_metrics(id) ON DELETE CASCADE,
        muscle_id TEXT NOT NULL REFERENCES muscles(id),
        PRIMARY KEY (metric_id, muscle_id)
      );

      CREATE TABLE body_readings (
        id TEXT PRIMARY KEY NOT NULL,
        metric_id TEXT NOT NULL REFERENCES body_metrics(id) ON DELETE CASCADE,
        value REAL NOT NULL,
        taken_at TEXT NOT NULL
      );
    `);
    await seedBodyMetrics(db);
  }

  // Migration 17 : un objectif peut viser une mensuration, pas seulement un
  // exercice. Le sujet devient explicite plutôt qu'un exercice sous-entendu.
  if (version < 17) {
    await db.execAsync('PRAGMA foreign_keys = OFF;');
    await db.execAsync(`
      ALTER TABLE goals ADD COLUMN subject_kind TEXT NOT NULL DEFAULT 'exercise';
      ALTER TABLE goals ADD COLUMN metric_id TEXT REFERENCES body_metrics(id);

      -- Une étape porte le même choix, et son exercice devient facultatif.
      CREATE TABLE goal_steps_v17 (
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        subject_kind TEXT NOT NULL CHECK (subject_kind IN ('exercise', 'body')),
        exercise_id TEXT REFERENCES exercises(id),
        metric_id TEXT REFERENCES body_metrics(id),
        PRIMARY KEY (goal_id, position)
      );

      INSERT INTO goal_steps_v17 (goal_id, position, subject_kind, exercise_id, metric_id)
        SELECT goal_id, position, 'exercise', exercise_id, NULL FROM goal_steps;

      DROP TABLE goal_steps;
      ALTER TABLE goal_steps_v17 RENAME TO goal_steps;

      -- La fenêtre du dernier relevé rejoint les deux autres.
      CREATE TABLE goal_conditions_v17 (
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        step_position INTEGER NOT NULL,
        requirement_index INTEGER NOT NULL,
        condition_index INTEGER NOT NULL,
        measurement_id TEXT,
        window TEXT NOT NULL
          CHECK (window IN ('LAST_SESSION', 'ALL_TIME', 'LATEST_READING')),
        aggregation TEXT NOT NULL
          CHECK (aggregation IN ('average', 'max', 'min', 'total', 'setCount')),
        operator TEXT NOT NULL CHECK (operator IN ('>=', '>', '<=', '<', '==')),
        target REAL NOT NULL,
        PRIMARY KEY (goal_id, step_position, requirement_index, condition_index)
      );

      INSERT INTO goal_conditions_v17
        SELECT goal_id, step_position, requirement_index, condition_index,
               measurement_id, window, aggregation, operator, target
        FROM goal_conditions;

      DROP TABLE goal_conditions;
      ALTER TABLE goal_conditions_v17 RENAME TO goal_conditions;
    `);
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }

  // Migration 18 : un muscle est visé au premier plan ou en soutien.
  //
  // Les liens existants ne disaient pas lequel. Quand l'exercice n'en avait
  // qu'un, il ne peut être que le principal ; dès qu'il en avait plusieurs,
  // rien ne permet de trancher -- les deviner en inventerait le sens, donc ils
  // passent en secondaires et attendent une décision.
  if (version < 18) {
    await db.execAsync('PRAGMA foreign_keys = OFF;');
    await db.execAsync(`
      CREATE TABLE exercise_muscles_v18 (
        exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        muscle_id TEXT NOT NULL REFERENCES muscles(id),
        role TEXT NOT NULL CHECK (role IN ('PRIMARY', 'SECONDARY')),
        PRIMARY KEY (exercise_id, muscle_id)
      );

      INSERT INTO exercise_muscles_v18 (exercise_id, muscle_id, role)
        SELECT em.exercise_id, em.muscle_id,
               CASE
                 WHEN (SELECT COUNT(*) FROM exercise_muscles other
                       WHERE other.exercise_id = em.exercise_id) = 1
                 THEN 'PRIMARY'
                 ELSE 'SECONDARY'
               END
        FROM exercise_muscles em;

      DROP TABLE exercise_muscles;
      ALTER TABLE exercise_muscles_v18 RENAME TO exercise_muscles;

      -- Un seul muscle principal par exercice : la contrainte tient en base,
      -- pas seulement dans l'agrégat.
      CREATE UNIQUE INDEX exercise_primary_muscle
        ON exercise_muscles (exercise_id) WHERE role = 'PRIMARY';
    `);
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }

  // Migration 19 : les démonstrations rattachées à un exercice.
  //
  // Une table plutôt qu'une colonne : un exercice peut en porter plusieurs, et
  // leur ordre est celui de l'ajout. Le genre est explicite dès maintenant,
  // même si seul le lien est proposé -- un fichier ne se sauvegarde pas comme
  // une adresse, et deviner plus tard ce qu'une chaîne désigne serait pire.
  if (version < 19) {
    await db.execAsync(`
      CREATE TABLE exercise_media (
        exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('link', 'file')),
        uri TEXT NOT NULL,
        label TEXT,
        PRIMARY KEY (exercise_id, position)
      );
    `);
  }

  // Migration 20 : de quel instant à quel instant lire une vidéo.
  //
  // Deux colonnes nullables plutôt qu'un découpage du fichier : on garde la
  // vidéo entière et on choisit ce qu'on en montre. Le rognage réel demande de
  // ré-encoder -- irréversible, et hors de portée sans module natif.
  if (version < 20) {
    await db.execAsync(`
      ALTER TABLE exercise_media ADD COLUMN trim_from REAL;
      ALTER TABLE exercise_media ADD COLUMN trim_to REAL;
    `);
  }

  // Migration 21 : une illustration est un média comme un autre.
  //
  // SQLite ne sait pas modifier une contrainte CHECK : la table se reconstruit
  // pour que `kind` accepte 'image' -- le motif habituel, déjà employé pour les
  // séries et les objectifs.
  if (version < 21) {
    await db.execAsync('PRAGMA foreign_keys = OFF;');
    await db.execAsync(`
      CREATE TABLE exercise_media_v21 (
        exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('link', 'file', 'image')),
        uri TEXT NOT NULL,
        label TEXT,
        trim_from REAL,
        trim_to REAL,
        PRIMARY KEY (exercise_id, position)
      );

      INSERT INTO exercise_media_v21
        SELECT exercise_id, position, kind, uri, label, trim_from, trim_to
        FROM exercise_media;

      DROP TABLE exercise_media;
      ALTER TABLE exercise_media_v21 RENAME TO exercise_media;
    `);
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  return db;
}

/**
 * Catalogue de départ des mensurations, avec les muscles que chacune
 * concerne. Le poids n'en concerne aucun en particulier.
 */
async function seedBodyMetrics(db: SQLite.SQLiteDatabase): Promise<void> {
  const metrics: [string, string, string, string[]][] = [
    ['poids', 'Poids', 'kg', []],
    ['tourdecuisse', 'Tour de cuisse', 'cm', ['quadriceps', 'ischiojambiers', 'fessiers']],
    ['tourdebras', 'Tour de bras', 'cm', ['biceps', 'triceps']],
    ['tourdemollet', 'Tour de mollet', 'cm', ['mollets']],
    ['tourdetaille', 'Tour de taille', 'cm', ['abdominaux']],
    ['tourdepoitrine', 'Tour de poitrine', 'cm', ['pectoraux']],
    ['tourdepaules', 'Tour d épaules', 'cm', ['epaules', 'dos']],
  ];

  for (const [position, [id, name, unit, muscles]] of metrics.entries()) {
    await db.runAsync(
      'INSERT INTO body_metrics (id, name, unit, position, built_in) VALUES (?, ?, ?, ?, 1);',
      id,
      name,
      unit,
      position,
    );
    for (const muscleId of muscles) {
      await db.runAsync(
        'INSERT INTO body_metric_muscles (metric_id, muscle_id) VALUES (?, ?);',
        id,
        muscleId,
      );
    }
  }
}

/**
 * Catalogue des groupes musculaires, dans l'ordre où on les présente : le
 * haut du corps d'abord, puis le tronc, puis le bas.
 */
async function seedMuscles(db: SQLite.SQLiteDatabase): Promise<void> {
  const muscles = [
    'Pectoraux',
    'Dos',
    'Épaules',
    'Biceps',
    'Triceps',
    'Avant-bras',
    'Abdominaux',
    'Lombaires',
    'Fessiers',
    'Quadriceps',
    'Ischio-jambiers',
    'Mollets',
  ];

  for (const [position, name] of muscles.entries()) {
    await db.runAsync(
      'INSERT INTO muscles (id, name, position) VALUES (?, ?, ?);',
      // Un identifiant stable, dérivé du nom : il ne bougera plus, même si
      // le libellé affiché change un jour.
      name.toLowerCase().normalize('NFD').replace(/[^a-z]/g, ''),
      name,
      position,
    );
  }
}

/**
 * Catalogue de départ. Measurement reste un Aggregate Root : il aura ses
 * propres use cases le jour où un besoin réel de les gérer apparaîtra.
 */
async function seedMeasurements(db: SQLite.SQLiteDatabase): Promise<void> {
  const measurements = [
    { id: 'reps', name: 'Répétitions', unit: 'reps' },
    { id: 'weight', name: 'Poids', unit: 'kg' },
    { id: 'duration', name: 'Durée', unit: 's' },
    { id: 'distance', name: 'Distance', unit: 'm' },
  ];

  for (const m of measurements) {
    await db.runAsync('INSERT INTO measurements (id, name, unit) VALUES (?, ?, ?);', m.id, m.name, m.unit);
  }
}
