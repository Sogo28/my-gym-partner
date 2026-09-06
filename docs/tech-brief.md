# my-gym-partner — dossier technique

État au 6 septembre 2026 · 88 tests · 11 migrations · 2 866 lignes de source

Application mobile de planification et de suivi d'entraînement (musculation,
callisthénie). **Mono-utilisateur, local-first, sans backend.**
Dépôt : https://github.com/Sogo28/my-gym-partner

---

## 1. Stack

| Rôle | Choix | Version |
|---|---|---|
| Runtime mobile | Expo / React Native | `expo 57.0.20`, `react-native 0.86.3`, `react 19.2.3` |
| Langage | TypeScript strict | `6.0.3` |
| Navigation | expo-router (routing par fichiers) | `57.0.19` |
| Persistence | expo-sqlite, **SQL écrit à la main** | `57.0.2` |
| Styles | NativeWind (Tailwind pour RN) | `nativewind 4.2.6`, `tailwindcss 3.4.19` |
| Composants | maison, variantes via `class-variance-authority` | `0.7.1` |
| Polices | Archivo + JetBrains Mono (expo-google-fonts) | — |
| Tests | Vitest (domaine pur, exécuté en Node) | `5.0.0` |
| Identifiants | UUID v4 via `expo-crypto` | — |

**Aucun ORM.** Décision assumée : le mapping ligne ↔ objet est explicite, ce qui
empêche la forme des tables d'imposer sa structure au modèle métier.

### Contraintes de versions à connaître

```json
"overrides": {
  "react-native-worklets": "0.12.1",
  "react-native-reanimated": "4.6.0"
}
```

Expo Go embarque un runtime natif de `react-native-worklets` plus récent que
celui que le SDK installe côté JS. Sans ces overrides, l'application plante au
démarrage dès que NativeWind sollicite Reanimated. `react-dom` est également
épinglé sur `19.2.3` : NativeWind tire des paquets Radix qui, sans cela,
résolvent `react-dom` vers une version exigeant un React plus récent que le SDK.

**Conséquence structurelle :** tant que le projet reste sur Expo Go, tout module
à code natif doit correspondre exactement à ce qu'Expo Go embarque. Le passage à
un *development build* lèvera cette contrainte.

---

## 2. Architecture

```
app/                  11 écrans · routing par fichiers (expo-router)
src/ui/               système de composants (Button, SetRow, NumberField, Sheet…)
src/use-cases/        orchestration                              511 lignes
src/domain/           règles métier pures                      1 207 lignes
src/infra/            SQLite : schéma, migrations, repositories 1 135 lignes
```

### Règles de dépendance

- `src/domain` **n'importe rien** : ni React, ni Expo, ni SQLite. C'est ce qui
  permet aux 88 tests de s'exécuter en Node en moins d'une seconde, sans
  émulateur.
- Le domaine **ne génère pas d'identifiants** et **ne lit pas l'horloge**. Les
  deux entrent par paramètre, ce qui rend les transitions d'état déterministes.
- `src/use-cases` porte tout ce qui traverse plusieurs agrégats, lit l'horloge
  ou fabrique un identifiant.
- ⚠️ **Ne jamais créer de dossier `src/app/`** : expo-router le traite comme sa
  racine de routes et tente d'en rendre le contenu comme des écrans.

---

## 3. Modèle du domaine

### Agrégats

| Agrégat | Fichier | Contient | Référence par id |
|---|---|---|---|
| `Exercise` | `domain/exercise/exercise.ts` | — | `MeasurementId[]` |
| `Measurement` | `domain/exercise/measurement.ts` | — | — |
| `PlannedWorkout` | `domain/planned-workout/planned-workout.ts` | `PlannedExercise[]`, `PlannedSet[]` | `ExerciseId` |
| `ScheduledWorkout` | `domain/scheduling/scheduled-workout.ts` | — | `PlannedWorkoutId` |
| `WorkoutSession` | `domain/workout-session/workout-session.ts` | `Activity[]`, `Rest[]` | `PlannedWorkoutId`, `ScheduledWorkoutId`, `ExercisePerformanceId` |
| `ExercisePerformance` | `domain/performance/exercise-performance.ts` | `PerformanceSet[]` | `ExerciseId`, `MeasurementId[]` (copiés) |
| `Goal` | `domain/goal/goal.ts` | `ProgressionStep[]`, `Requirement[]`, `Condition[]` | `ExerciseId` |

Deux agrégats ne se tiennent jamais l'un l'autre : ils se référencent par
identifiant.

### La frontière qui structure tout

Le cahier impose qu'**annuler une séance conserve les séries déjà validées**.
Cette règle interdit de loger la performance dans la séance :

```
WorkoutSession (agrégat)
  └── Activity                    appartient à la séance
        └── performanceId ───────► ExercisePerformance (agrégat autonome)
```

**Prix à payer, assumé :** séance et performance ne peuvent pas être écrites
dans une même transaction. Démarrer un exercice écrit donc la performance
*d'abord*, la séance ensuite : en cas d'échec on obtient une performance vide
que personne ne référence (inoffensif) plutôt qu'une séance pointant vers une
performance inexistante (plantage à la lecture).

### Machines à états

```
ScheduledWorkout   SCHEDULED → EXECUTED | CANCELLED
WorkoutSession     ACTIVE    → COMPLETED | CANCELLED
PerformanceSet     IN_PROGRESS → COMPLETED | ABANDONED
```

- Pas d'état `MISSED` : une date passée reste `SCHEDULED`. « En retard » est un
  **calcul** (`isOverdue(now)`), pas un état stocké — rien à mettre à jour au
  passage de minuit.
- `EXECUTED` est posé à la **fin** de la séance, pas à son démarrage : une
  séance annulée laisse l'intention ouverte.
- Seules les séries `COMPLETED` alimentent statistiques, historique et
  évaluation d'objectifs.

### Invariants notables

- Un `Exercise` référence au moins une `Measurement` *(règle déduite de §4, à
  confirmer)*.
- Une `ExercisePerformance` **copie les mesures de son exercice** à sa création.
  Modifier un exercice ne réécrit donc aucune performance passée, et l'agrégat
  peut valider ses propres valeurs sans consulter un autre agrégat.
- Un `PlannedWorkout` accepte deux fois le même exercice ; les exercices
  planifiés sont donc adressés **par position**, pas par identifiant.
- Une seule série et un seul repos en cours à la fois par agrégat.

### Objectifs

```
Goal (simple)        exerciseId + Requirement[]        ← pas de step artificielle
Goal (progressif)    ProgressionStep[] ordonnées
                       └── exerciseId + Requirement[]  ← peut être vide

Requirement          Condition[]   toutes doivent tenir (ET)
Requirement[]        combinés en ET
Condition            { measurementId | null, window, aggregation, operator, target }
                     window      : LAST_SESSION (seule valeur en V1)
                     aggregation : average | max | min | total | setCount
```

Le modèle métier de référence est versionné : `docs/goal-model.md`. Il **prime
sur le cahier général** pour tout ce qui touche aux objectifs.

**Évaluation** — `domain/goal/evaluation.ts` est une fonction pure prenant des
séries et rendant un verdict condition par condition (`actual`, `satisfied`).
Le use case choisit quelles séries lui donner : la performance la plus récente
de l'exercice **contenant au moins une série validée**, de sorte qu'une séance
sans rien de validé ne masque pas la précédente.

---

## 4. Base de données

SQLite embarqué. Migrations versionnées via le `PRAGMA user_version` de SQLite,
dans `src/infra/db.ts` : incrémenter `SCHEMA_VERSION` et ajouter un bloc
`if (version < N)`.

**16 tables**

```
measurements · exercises · exercise_measurements
planned_workouts · planned_workout_exercises · planned_workout_sets
scheduled_workouts
workout_sessions · session_activities · session_rests
exercise_performances · exercise_performance_measurements
performance_sets · performance_set_values
goals · goal_steps · goal_conditions
```

**Conventions**

- Instants stockés en **ISO 8601 texte** — le tri lexicographique y est le tri
  chronologique, donc `ORDER BY started_at` fonctionne sans conversion.
- Les états du domaine sont doublés par des contraintes `CHECK` : la base refuse
  elle-même une valeur inconnue.
- Une valeur de série = une ligne (`performance_set_values`), ce qui permet une
  clé étrangère vers `measurements`.
- Chargement des agrégats : requêtes **à plat puis regroupement en mémoire**,
  jamais une requête par entité (pas de N+1).

**11 migrations appliquées sur une base en production** (l'app est utilisée
quotidiennement). Aucune donnée perdue, à une exception annoncée : la refonte du
modèle des objectifs a recréé ses tables, le jour même de leur création.

---

## 5. Use cases

```
Exercices     createExercise · updateExercise · discardExercise · unarchiveExercise
              listActiveExercises
Entraînements createPlannedWorkout · renameWorkout · discardWorkout
              unarchiveWorkout · listActiveWorkouts
Planning      scheduleWorkout · rescheduleWorkout · cancelScheduledWorkout
              markScheduleExecuted · listSchedule
Séance        startWorkoutSession · finishWorkoutSession · cancelWorkoutSession
              startActivity · finishActivity · goToNextExercise
              startPerformanceSet · completePerformanceSet · abandonPerformanceSet
              correctSet · correctPastSet · startRest · stopRest
Objectifs     createGoal · evaluateGoal · advanceProgression · archiveGoal · listGoals
```

**Suppression vs archivage** — `discardExercise` interroge la base pour savoir si
l'exercice est référencé (entraînements, activités, performances, étapes
d'objectifs, objectifs). Référencé → archivé. Jamais utilisé → réellement
supprimé. La décision vient de la donnée, pas d'une hypothèse.

---

## 6. Tests

88 tests Vitest, **exclusivement sur le domaine**, exécution < 1 s.

```
ExercisePerformance     17     Goal                     13
WorkoutSession          14     Exercise                 11
PlannedWorkout           9     Évaluation d'objectif     8
Métriques de séance      6     ScheduledWorkout          6
Règles inter-agrégats    4
```

Chaque test formule une règle métier en français. Les exemples chiffrés du
cahier des charges sont repris tels quels (moyennes 7/9/8 → 8 s, non satisfait ;
10/11/9 → 10 s, satisfait).

**Non couvert :** la couche infrastructure. `expo-sqlite` ne s'exécute que sur
l'appareil, donc repositories et migrations sont vérifiés manuellement. Piste si
cela devient risqué : rejouer le SQL contre le module `node:sqlite` intégré à
Node 24.

**Commandes**

```bash
npm test                    # tests du domaine
npx tsc --noEmit            # vérification des types
npx expo start --port 8083  # lancement (le port 8081 est souvent occupé)
npx expo export --platform ios   # vérifie que le bundle se construit
```

---

## 7. Points d'attention

**Risque principal — aucune sauvegarde.** Les données n'existent que sur
l'appareil. Ni synchronisation, ni export. C'est la contrepartie du local-first,
et le premier sujet à traiter si le projet doit durer.

**Pas de tests d'infrastructure.** Un bug de mapping ou de migration ne serait vu
qu'à l'usage.

**Vérification limitée.** Xcode n'est pas installé sur la machine de
développement : pas de simulateur, donc aucun test visuel automatisé. Le bundle
est construit pour valider la compilation, le reste est vérifié sur appareil.

**Expo Go.** Chaque module natif ajouté est un risque de conflit de versions
(déjà rencontré, cf. §1).

**Dette connue**
- L'écran de création d'objectif n'expose qu'un `Requirement` par étape, alors
  que le domaine en accepte plusieurs.
- `WorkoutSession` charge encore ses activités par requêtes séparées dans
  `findActive` (acceptable : une seule séance).
- Le lien repos ↔ série est reconstitué par horodatage, faute de lien direct
  (conséquence assumée de l'indépendance du repos, imposée par le cahier).

---

## 8. Reste à faire

**Extensions cadrées**

1. **Objectifs de mensuration** — nécessite une seconde source de données :
   relevés datés saisis à la main. Une `Condition` devrait déclarer sa source
   (performance vs relevé) ; les exercices associés resteraient indicatifs.
2. **Exercices unilatéraux** — `Exercise.isUnilateral` existe ; `PerformanceSet`
   doit porter des valeurs par côté. Évolution du domaine + migration.
3. **Muscles ciblés** — pour filtrer le catalogue.

**Questions ouvertes**

- Définition exacte de la « dernière session pertinente » quand un exercice est
  travaillé deux fois dans la même séance.
- Rattachement du tempo (§15 du cahier) : hors périmètre V1.
- Représentation d'un objectif sans exercice — dépend du point 1.

---

## 9. Documents de référence, versionnés

| Fichier | Contenu |
|---|---|
| `AGENTS.md` | Structure, conventions, pièges du projet |
| `docs/goal-model.md` | Modèle métier des objectifs — **source de vérité** |
| `docs/design-brief.md` | Brief de design remis au designer |
| `design_handoff_my_gym_partner/` | Handoff haute fidélité : jetons, composants, écrans |

Les messages de commit documentent le **pourquoi** de chaque décision
structurante (frontières d'agrégats, ordre des écritures, choix de
modélisation), pas seulement le quoi.
