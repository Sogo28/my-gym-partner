# Goal — Modèle métier

> Source de vérité pour tout ce qui touche aux objectifs. Prime sur les
> interprétations faites ailleurs.

## 1. Concept général

`Goal` représente un objectif sportif que l'utilisateur souhaite atteindre.
Il peut être **simple** ou **progressif** (plusieurs étapes). C'est un
Aggregate Root.

Un Goal **peut** être associé à un `Exercise`, mais cette association **n'est
pas obligatoire** : le domaine doit permettre des objectifs définis
indépendamment d'un exercice.

> État du code : l'exercice est aujourd'hui obligatoire. Le cas sans exercice
> (par exemple un objectif de mensuration) demande une seconde source de
> données — des relevés datés saisis à la main — et fait l'objet d'une slice
> à part.

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
étape cible un `Exercise` et possède **un ou plusieurs Requirements**, ou
aucun (elle est alors validée à la main).

**Plusieurs Requirements se combinent en ET** : l'étape est atteinte quand
tous le sont (décidé le 2026-09-05).

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

### 5.1 Séries qualifiantes

Les mesures d'un exercice **vont de paire** : « 10 reps à 60 kg » décrit **une
série**, pas deux exigences (décidé le 2026-09-08).

Deux conditions indépendantes ne savent pas dire cela. Chacune agrège **sa**
mesure sur toutes les séries, puis les verdicts se combinent -- mais ce ET
porte sur des agrégats, plus sur les séries qui les ont produits :

    moyenne(reps) ≥ 10  ET  moyenne(kg) ≥ 60
    séries : 15×40, 5×80
    → moyennes : 10 reps, 60 kg → SATISFAIT
    → et pourtant aucune série n'a valu 10 reps à 60 kg.

Une condition de **décompte** peut donc **décrire les séries qu'elle compte**,
par une ou plusieurs `Clause` -- une mesure, un opérateur, une cible. Une série
qualifie quand elle satisfait **toutes** les clauses, lues sur elle seule :

    au moins 3 séries de (reps ≥ 10 · kg ≥ 60)   sur LAST_SESSION

Une série qui **ne porte pas** l'une des mesures exigées ne qualifie pas : rien
ne permet d'affirmer qu'elle valait 60 kg si aucun poids n'a été noté.

Sans clause, le décompte compte **toutes** les séries -- la forme précédente
reste donc dite.

`moyenne`, `meilleure`, `plus faible` et `cumul` gardent tout leur sens sur un
exercice à **une seule** mesure ; dès qu'il en a plusieurs, elles ne peuvent
plus rien affirmer sur une série et ne sont plus proposées.

## 6. Fenêtre d'évaluation

La fenêtre appartient à **chaque Condition** : deux conditions d'une même
exigence peuvent porter sur des périodes différentes (décidé le 2026-09-06).

    Requirement « passer au One Leg »
      ├── moyenne des tenues ≥ 10 s   sur LAST_SESSION   ← la forme du jour
      └── séries complétées  ≥ 12     sur ALL_TIME       ← le volume accumulé

**`LAST_SESSION`** — la dernière séance où l'exercice a été **réellement
travaillé**, c'est-à-dire contenant au moins une série COMPLETED pour lui. Une
séance où rien n'a été validé ne masque pas la précédente.

Si l'exercice y a été **repris une seconde fois** (un finisher en fin de
séance), **ses deux performances comptent ensemble** (décidé le 2026-09-06) :

    18h05  Advanced Tuck  10s · 11s · 9s
    18h40  Advanced Tuck   6s · 5s        ← finisher
    → moyenne évaluée : (10+11+9+6+5)/5 = 8,2 s

Les séances **annulées** ne comptent pas : leurs séries validées restent
lisibles dans l'historique, mais ne font ni records ni objectifs (décidé avec
Daniel le 2026-10-08, à la place de la décision gelée n°15).

**`ALL_TIME`** — tout l'historique de l'exercice, séances confondues.

### 6.1 L'application tranche globalement

Le modèle laisse chaque Condition porter sa période, et il la garde : c'est
lui qui décrit ce qu'on **peut** exprimer.

Mais l'application, elle, n'en demande qu'une (décidé le 2026-09-09). Le
mélange de périodes dans une même exigence n'a jamais servi à l'usage : la
question qu'on se pose est « est-ce que je le tiens **aujourd'hui** », et elle
se pose de la même façon pour tous les objectifs. Un réglage la fixe donc pour
tous, et **tout de suite** — le basculer réévalue l'existant, faute de quoi il
aurait l'air cassé.

La condition **stockée** n'est pas touchée : c'est l'évaluation du moment
qu'on ramène à la période choisie. Une mensuration garde la sienne, n'ayant
pas de séances à lire.

Pas de moyenne glissante sur N séances en V1.

    Session précédente : 7s, 9s, 8s → moyenne 8s  → NON SATISFAIT
    Dernière session   : 10s, 11s, 9s → moyenne 10s → SATISFAIT

### Exercices unilatéraux

Une série unilatérale porte **les deux côtés** : c'est une seule série, pas
deux. Un côté peut manquer -- rattrapage du côté faible, côté blessé épargné
-- et cette absence n'est pas un zéro.

**C'est le côté le plus faible qui compte** pour toute condition (décidé le
2026-09-06), mesure par mesure :

    Série 1   gauche 12 s   droite 8 s
    Série 2   gauche 11 s   droite 7 s
    → moyenne évaluée : (8+7)/2 = 7,5 s

On progresse au rythme du côté qui suit le moins ; laisser un côté fort
compenser validerait une étape à moitié acquise. Quand un seul côté a été
fait, c'est lui qui parle : il n'y a rien à comparer.

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
13. Les fenêtres d'évaluation sont LAST_SESSION et ALL_TIME. LAST_SESSION
    agrège toutes les performances de l'exercice au sein de cette séance.
    Chaque Condition porte la sienne.
14. Les métriques sont dérivées des performances.
15. Les performances historiques restent immuables quand un Goal ou un
    Requirement est modifié.
16. Une étape atteinte permet au système de suggérer la suivante.
17. La progression suivante n'est jamais appliquée automatiquement.
18. L'utilisateur peut accepter ou refuser la suggestion.
19. La représentation technique des Conditions reste ouverte.
13bis. Le modèle attache une fenêtre à chaque Condition ; l'application la
    fixe globalement et l'applique à toutes les évaluations, y compris celles
    des objectifs déjà créés. Une mensuration conserve LATEST_READING.
19bis. Une Condition de décompte peut décrire les séries qu'elle compte par
    des Clauses. Une série qualifie quand elle satisfait toutes les clauses,
    lues sur elle seule. Une même mesure n'est pas exigée deux fois. Seul un
    décompte porte des clauses, et seul un exercice en produit.
20. La persistence et les choix technologiques ne font pas partie du modèle.
