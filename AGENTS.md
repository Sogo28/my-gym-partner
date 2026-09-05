# my-gym-partner

> Expo a beaucoup changé : consulter la doc versionnée
> https://docs.expo.dev/versions/v57.0.0/ avant d'écrire du code Expo.

App Expo (React Native, TypeScript) de planification et de suivi sportif, **local-first** :
domaine et base SQLite embarqués dans le téléphone, pas de backend. Mono-utilisateur.

## Structure

- `app/` — écrans. **Réservé à expo-router** : l'arborescence des fichiers définit la navigation.
- `src/domain/` — règles métier pures. N'importe RIEN de React, Expo ou SQLite, donc testable en Node.
- `src/use-cases/` — orchestration : génération des identifiants, lecture de l'horloge, règles qui traversent plusieurs agrégats.
- `src/infra/` — SQLite : schéma, migrations, repositories.

⚠️ Ne jamais créer de dossier `src/app/` : expo-router le prendrait pour sa racine de routes
et tenterait de rendre son contenu comme des écrans.

## Commandes

- `npm test` — tests du domaine (Vitest, sans émulateur)
- `npx expo start` — lance l'app (`-c` pour vider le cache après un changement de structure)
- `npx tsc --noEmit` — vérification des types

## Conventions

- Le cahier des charges métier est la source de vérité ; ses décisions gelées ne se modifient pas sans discussion.
- Les agrégats se référencent par identifiant, jamais en se tenant l'un l'autre.
- Le domaine ne génère pas d'identifiants et ne lit pas l'horloge : les use cases les lui passent.
- Identifiants : UUID générés côté client (contrainte d'une future synchronisation).
- Migrations : incrémenter `SCHEMA_VERSION` dans `src/infra/db.ts` et ajouter un bloc `if (version < N)`.
