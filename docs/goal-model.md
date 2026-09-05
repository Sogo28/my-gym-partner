# Goal — Modèle métier

> Source de vérité pour tout ce qui touche aux objectifs. Prime sur les
> interprétations faites ailleurs.

## 1. Concept général

`Goal` représente un objectif sportif que l'utilisateur souhaite atteindre.
Il peut être **simple** ou **progressif** (plusieurs étapes). C'est un
Aggregate Root. Il peut être lié à un `Exercise`, mais le modèle doit rester
assez générique pour des objectifs purement basés sur une mesure.

## 2. Goal simple

Un objectif qui ne nécessite pas d'étape intermédiaire.

    Goal
     ├── Exercise: Front Lever
     └── Requirement
           └── Condition
                 ├── Measurement: Duration
                 ├── Evaluation: LAST_SESSION
                 ├── Aggregation: AVERAGE
                 ├── Operator: >=
                 └── Target: 10 seconds

**Il ne faut pas créer de `ProgressionStep` artificielle pour le représenter.**

## 3. Goal progressif

    Goal: Full Front Lever → Progression
                              ├── Step 1: Tuck
                              ├── Step 2: Advanced Tuck
                              ├── Step 3: One Leg
                              ├── Step 4: Straddle
                              └── Step 5: Full

Une `Progression` possède au moins une `ProgressionStep`, ordonnée. Chaque
étape cible un `Exercise` et **peut** posséder un `Requirement`.

## 4. Requirement

Ce qui doit être satisfait pour qu'une étape ou un objectif soit atteint.
Au moins une `Condition`, et **toutes** doivent être satisfaites.

    Requirement
     ├── Condition 1: average hold >= 10s
     └── Condition 2: completed sets >= 3

## 5. Condition

Une condition détermine :

- quelle **mesure** observer ;
- sur quelle **fenêtre** l'évaluer ;
- comment **agréger** les données ;
- quel **opérateur** appliquer ;
- quelle **valeur cible** atteindre.

## 6. Fenêtre d'évaluation

En V1 : **la dernière session pertinente**. Pas de moyenne glissante.

    Session précédente : 7s, 9s, 8s → moyenne 8s  → NON SATISFAIT
    Dernière session   : 10s, 11s, 9s → moyenne 10s → SATISFAIT

## 7. Métriques

Dérivées des performances réelles : moyenne des tenues, meilleure tenue,
moyenne des répétitions, charge maximale, volume total, nombre de séries
complétées. Jamais persistées comme entités indépendantes.

## 8. Progression et passage à l'étape suivante

Une étape dont le Requirement est satisfait est atteinte, et le système peut
proposer la suivante. **Le passage n'est jamais automatique** : l'utilisateur
accepte ou refuse, la suggestion ne modifie pas le Goal d'elle-même.

## 9. Modification des Requirements

Un Requirement peut être modifié (`average hold >= 10s` → `>= 12s`). Cette
modification **ne réécrit jamais les performances historiques** :

    Performance historique  ≠  Règle d'évaluation du Goal

## 10. Structure conceptuelle

    Goal simple                 Goal progressif
    Goal                        Goal
     ├── Exercise                ├── Exercise / objectif
     └── Requirement             └── Progression
          └── Condition+              └── ProgressionStep+
                                           ├── Exercise
                                           └── Requirement?
                                                └── Condition+

## 11. Décisions V1 gelées

1. `Goal` est un Aggregate Root.
2. Un Goal peut être simple ou progressif.
3. Un Goal simple peut posséder directement un Requirement.
4. Pas de ProgressionStep artificielle pour un objectif simple.
5. Une Progression possède des étapes ordonnées.
6. Une Progression possède au moins une ProgressionStep.
7. Chaque ProgressionStep cible un Exercise.
8. Une ProgressionStep peut posséder un Requirement.
9. Un Requirement possède au moins une Condition.
10. Toutes les Conditions d'un Requirement doivent être satisfaites.
11. Une Condition évalue une métrique de performance.
12. Une Condition possède une mesure, une fenêtre d'évaluation, une
    agrégation, un opérateur et une valeur cible.
13. En V1, la fenêtre d'évaluation est la dernière session pertinente.
14. Les métriques sont dérivées des performances.
15. Les performances historiques restent immuables quand un Goal ou un
    Requirement est modifié.
16. Une étape atteinte permet au système de suggérer la suivante.
17. La progression suivante n'est jamais appliquée automatiquement.
18. L'utilisateur peut accepter ou refuser la suggestion.
19. La représentation technique des Conditions reste ouverte.
20. La persistence et les choix technologiques ne font pas partie du modèle.
