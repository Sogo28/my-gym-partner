# Brief de design — my-gym-partner

## 1. Le produit

Application mobile personnelle de **planification et de suivi d'entraînement**
(musculation et callisthénie). Mono-utilisateur, sans compte, sans réseau
social. Toutes les données vivent dans le téléphone.

Le produit distingue rigoureusement trois choses, et le design doit rendre
cette distinction visible :

| Concept | Sens | Statut visuel |
|---|---|---|
| **Exercice** | La définition : « Traction lestée », mesurée en répétitions et en kilos | Référentiel, neutre |
| **Entraînement** | Un programme réutilisable, sans date : suite d'exercices et de séries **cibles** | Une intention |
| **Séance** | L'exécution réelle, un jour donné : ce qui a vraiment été fait | Un fait |
| **Série** | Une série réellement exécutée, avec ses valeurs réelles | Validée / abandonnée |
| **Repos** | La récupération entre deux séries, chronométrée | Temps qui passe |

Une valeur **prévue** et une valeur **réalisée** ne doivent jamais se
confondre visuellement. C'est la règle de lecture la plus importante de
l'application.

## 2. L'utilisateur et ses conditions d'usage

Un seul utilisateur, qui s'entraîne seul en salle. L'écran de séance est
utilisé **debout, entre deux séries, une main occupée, parfois les mains
moites, sous un éclairage variable**.

Conséquences non négociables :

- les actions se situent dans la moitié basse de l'écran, atteignables au pouce ;
- les cibles tactiles font au moins 48 pt de haut ;
- l'action principale du moment doit être identifiable en moins d'une seconde ;
- pendant l'effort, l'écran ne doit pas exiger de défilement ;
- fort contraste : l'écran est lu de haut, en mouvement.

Les autres écrans (créer un exercice, consulter l'historique) sont consultés
assis, au calme : ils peuvent être plus denses.

## 3. Les écrans à concevoir

### 3.1 Séance en cours — l'écran central, à soigner en priorité

Un même écran, **trois états successifs**. Chaque état ne montre que ce qui
sert à ce moment précis.

**État A — prêt à démarrer une série**
- en-tête : nom de l'entraînement, position (« exercice 2/4 »), accès au menu de séance
- nom de l'exercice en cours, en très grand
- liste repliable des séries : validées, abandonnées, et celles encore prévues
- deux actions côte à côte : « Série 3 » (principale) et « Exercice suivant » (secondaire)

**État B — série en cours**
- même en-tête et même liste
- une seule action, large : « Terminer la série 3 »
- aucun champ de saisie : l'utilisateur est en train de faire sa série

**État C — repos**
- un chronomètre qui compte depuis la fin de la série (mm:ss), élément le plus visible
- à côté du chronomètre : les valeurs de la série qu'on vient de valider, modifiables
  (pré-remplies avec ce qui était prévu, l'utilisateur corrige s'il a fait autre chose)
- un bouton « Corriger » n'apparaissant que si une valeur a réellement changé
- deux actions : « Série suivante » (principale) et « Exercice suivant » (secondaire)

### 3.2 Aperçu d'un entraînement
Consulté avant de démarrer. Liste des exercices, repliés par défaut, avec le
nombre de séries ; le détail des séries cibles s'ouvre à la demande. Une seule
action, ancrée en bas : « Démarrer la séance ».

### 3.3 Historique
Liste de séances, la plus récente en premier. Pour chacune : nom, date, heure,
statut (terminée / annulée), durée totale et temps de repos cumulé. Le détail
montre, exercice par exercice, les séries validées, avec le temps de repos
intercalé entre deux séries. Les séries abandonnées existent mais ne comptent pas.

### 3.4 Exercices
Liste, et formulaire de création : nom, sélection multiple de mesures
(répétitions, poids, durée, distance), un interrupteur « exercice unilatéral ».

### 3.5 Entraînements
Liste, et construction d'un entraînement : ajouter des exercices, puis pour
chacun ajouter des séries en saisissant les valeurs cibles (chaque série peut
viser des valeurs différentes).

### 3.6 États vides et erreurs
Aucune séance en cours, aucun exercice, aucun entraînement, aucun historique.
Les messages d'erreur sont des refus métier formulés en français
(« Termine l'exercice en cours avant d'en commencer un autre »), à afficher
comme une information, pas comme une panne.

## 4. Contraintes techniques d'implémentation

L'app est en **React Native (Expo SDK 57)**, stylée avec **NativeWind**
(Tailwind CSS pour React Native), avec des composants maison dans le style de
shadcn (variantes déclarées avec `class-variance-authority`).

Le design doit être réalisable avec ce que React Native sait faire :

**Disponible**
- Flexbox uniquement (`flex-row`, `flex-1`, `gap`, `items-*`, `justify-*`)
- couleurs, opacité, rayons de bordure, bordures
- ombres (`shadow-*` / elevation), avec un rendu qui diffère entre iOS et Android
- polices personnalisées via `expo-google-fonts`
- icônes via `@expo/vector-icons` (Ionicons, Feather, Material…)
- dégradés via `expo-linear-gradient`, flou via `expo-blur`
- mode sombre via la variante `dark:` de NativeWind
- animations d'opacité et de translation (API `Animated` de React Native)

**Indisponible — ne pas en dépendre**
- CSS Grid, `position: fixed`, `float`
- pseudo-éléments (`::before`, `::after`), sélecteurs descendants
- `backdrop-filter`, `mix-blend-mode`, masques CSS
- SVG inline sans bibliothèque dédiée
- ombres portées multiples ou colorées de façon fine sur Android
- animation d'une hauteur inconnue à l'avance (préférer opacité et translation)

## 5. Ce que j'attends en retour

1. **Des jetons de design** : palette (nommée par rôle : primaire, surface,
   bordure, texte, texte atténué, succès, danger, valeur prévue), échelle
   typographique, échelle d'espacement, rayons — le tout exprimable dans
   `tailwind.config.js`.
2. **Les composants** : bouton (variantes principale, secondaire, discrète,
   danger ; tailles), carte, bloc repliable, champ numérique, chronomètre,
   ligne de série (validée / abandonnée / prévue), en-tête d'écran, barre
   d'onglets, état vide.
3. **Les maquettes** des écrans de la section 3, avec les trois états de
   l'écran de séance traités séparément.
4. **Une version claire et une version sombre** de l'écran de séance.

## 6. Direction artistique

Deux principes à respecter, quelle que soit la direction retenue :
- **une seule action principale visible à la fois** sur l'écran de séance ;
- **la valeur réalisée domine la valeur prévue** dans la hiérarchie visuelle.

Trois pistes possibles, à trancher :
- **Sobre et dense** — fond clair, gris neutres, une seule couleur d'accent,
  typographie très lisible. Discret, vieillit bien.
- **Sombre et sportif** — fond sombre par défaut, chiffres imposants, accent
  vif. Lisible en salle, moins fatigant sous éclairage artificiel.
- **Éditorial** — beaucoup d'air, grande typographie, peu de bordures, la
  hiérarchie portée par les tailles plutôt que par les cadres.

Ne pas produire un tableau de bord d'analyse : c'est un outil qu'on utilise en
faisant du sport, pas un rapport que l'on contemple.
