# my-gym-partner

> Expo a beaucoup changé : consulter la doc versionnée
> https://docs.expo.dev/versions/v57.0.0/ avant d'écrire du code Expo.

App Expo (React Native, TypeScript) de planification et de suivi sportif, **local-first** :
domaine et base SQLite embarqués dans le téléphone. Mono-utilisateur.

Un compte Supabase (e-mail + mot de passe) existe désormais, mais il **ne commande rien** :
aucun écran n'exige d'être connecté, aucune lecture ne passe par le réseau, et la base locale
ne porte pas de `user_id` — un téléphone vaut un compte. Tout ce qui s'entraîne fonctionne
hors ligne, et doit le rester. Configuration dans `.env` (voir `.env.example`), absente d'un
dépôt fraîchement cloné : `isSupabaseConfigured` dit si un projet est joignable.

## Structure

- `app/` — écrans. **Réservé à expo-router** : l'arborescence des fichiers définit la navigation.
- `src/domain/` — règles métier pures. N'importe RIEN de React, Expo ou SQLite, donc testable en Node.
- `src/use-cases/` — orchestration : génération des identifiants, lecture de l'horloge, règles qui traversent plusieurs agrégats.
- `src/infra/` — ce qui sort du programme : SQLite (schéma, migrations, repositories) et le client Supabase.

⚠️ Ne jamais créer de dossier `src/app/` : expo-router le prendrait pour sa racine de routes
et tenterait de rendre son contenu comme des écrans.

## Tests

Vitest substitue `expo-sqlite` et `expo-crypto` par des équivalents Node
(`test/fake-*.ts`, alias dans `vitest.config.mts`). Les tests de use cases
s'exécutent donc sur une VRAIE base SQLite en mémoire, avec le vrai schéma et
les vraies migrations — sans qu'une ligne de code de production le sache.

Un test de use case appelle `useCleanDatabase()` (dans `test/support.ts`) :
chaque test repart d'une base migrée et vide.

## Commandes

- `npm test` — domaine + use cases (Vitest, sans émulateur)
- `npx expo start` — lance l'app (`-c` pour vider le cache après un changement de structure)
- `npx tsc --noEmit` — vérification des types

## Conventions

- Le cahier des charges métier est la source de vérité ; ses décisions gelées ne se modifient pas sans discussion.
- Les agrégats se référencent par identifiant, jamais en se tenant l'un l'autre.
- Le domaine ne génère pas d'identifiants et ne lit pas l'horloge : les use cases les lui passent.
- Identifiants : UUID générés côté client (contrainte d'une future synchronisation).
- Migrations : incrémenter `SCHEMA_VERSION` dans `src/infra/db.ts` et ajouter un bloc `if (version < N)`.
