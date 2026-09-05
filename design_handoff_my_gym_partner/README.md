# Handoff : my-gym-partner — planification et suivi d'entraînement

## Vue d'ensemble

Application mobile mono-utilisateur (musculation + callisthénie), sans compte, sans réseau, données locales. Le cœur du produit est **l'écran de séance**, utilisé debout en salle entre deux séries : une main occupée, éclairage variable, lecture en moins d'une seconde.

Le modèle distingue quatre objets, et le design rend cette distinction visible :

| Concept | Sens | Traitement visuel |
|---|---|---|
| Exercice | La définition (« Weighted pull-ups », mesuré en reps + kg) | Référentiel, neutre |
| Entraînement | Programme réutilisable, sans date : exercices + séries **cibles** | Une intention → atténué, pointillés, étiquette « cible / prévu » |
| Séance | L'exécution réelle un jour donné | Un fait → surface pleine, chiffres gras |
| Série | Une série réellement exécutée | Validée (✓ + filet vert) / abandonnée (barré) / prévue (pointillés) |
| Repos | Récupération chronométrée entre deux séries | Chrono mono, élément le plus grand de l'écran C |

**Règle de lecture non négociable : une valeur prévue et une valeur réalisée ne se confondent jamais.** Le réalisé est plein, gras, en chiffres tabulaires ; le prévu est atténué, en cadre pointillé, étiqueté « prévu ».

**Deuxième règle : une seule action principale visible à la fois** sur l'écran de séance.

## À propos des fichiers de design

Le fichier fourni (`my-gym-partner.dc.html`) est une **référence de design réalisée en HTML** : une maquette montrant l'apparence et le comportement visés, **pas du code de production à copier**. Le travail consiste à **recréer ces écrans dans l'environnement cible** — ici React Native / Expo SDK 57 avec NativeWind et des composants maison à la shadcn (variantes déclarées avec `class-variance-authority`) — en suivant les patterns déjà établis du dépôt.

Le HTML utilise uniquement des primitives que React Native sait rendre : flexbox, couleurs, opacité, bordures, rayons. **Pas** de CSS Grid dans les écrans (uniquement dans les planches de documentation), pas de pseudo-éléments, pas de `position: fixed`, pas de `backdrop-filter`, pas de SVG inline. Les icônes sont représentées par des glyphes de substitution (`◉ ◷ ≡ ▦ ⋯ ← ✓ ✕ ⓘ ⌄ ⌃`) : **à remplacer par `@expo/vector-icons`** (voir « Assets »).

## Fidélité

**Haute fidélité (hifi).** Couleurs, typographie, tailles, espacements et hauteurs de cibles tactiles sont définitifs. Recréer au pixel avec les jetons ci-dessous. La piste artistique retenue est **« sombre et sportif » (1b)** ; le mode clair est fourni pour l'écran de séance (l'app suit le réglage système).

## Ouvrir la maquette

`my-gym-partner.dc.html` s'ouvre directement dans un navigateur. Le document est organisé en trois passages, le plus récent en haut :

- **Passage 3 (`3a`)** — écran de séance en **mode clair** (états A/B/C), repos avec mesure « durée », repos pour exercice **unilatéral**, planches en-tête / carte / bouton, et le bloc `tailwind.config.js`.
- **Passage 2 (`2a`)** — historique (liste + détail), exercices (liste + création), entraînements (liste + construction), états vides, refus métier.
- **Passage 1 (`1a` / `1b`)** — comparaison des deux pistes artistiques. **`1b` est la piste retenue** ; `1a` (« sobre et dense », clair, accent bleu) est conservée comme archive et **ne doit pas être implémentée**.

Chaque cadre téléphone mesure 390 × 844 pt et porte un attribut `data-screen-label` correspondant aux noms d'écrans ci-dessous.

---

## Jetons de design

### Couleurs (par rôle)

| Rôle | Clair | Sombre | Usage |
|---|---|---|---|
| `primary` | `#BFF04A` | `#BFF04A` | Aplat d'action principale — **toujours avec texte `#14160F`** |
| `primary.ink` | `#46600F` | `#BFF04A` | Accent en **texte et bordure** (l'aplat citron ne passe qu'en texte foncé) |
| `primary.soft` | `#E7F3C8` | `#232A16` | Fond de pastille / bouton « Corriger » |
| `primary.pressed` | `#A6D63F` | `#A6D63F` | État pressé de l'aplat |
| `background` | `#F6F7F3` | `#0E0F0D` | Fond d'écran |
| `surface` | `#FFFFFF` | `#191B17` | Cartes, lignes de série, champs |
| `surface-alt` | `#EDEFE8` | `#141613` | Barre d'onglets, lignes en retrait |
| `border` | `#DDE0D6` | `#2A2D28` | Bordure standard 1 px |
| `border.strong` | `#C3C8B8` | `#3A3F37` | Bordure de bouton secondaire, pointillés |
| `text` | `#14160F` | `#F2F4EF` | Texte principal |
| `muted` | `#5F6459` | `#8B9086` | Métadonnées, labels, onglets inactifs |
| `planned` | `#A8AD9E` | `#8B9086` | Valeurs prévues / cibles |
| `success` | `#1B7A45` | `#4FD68A` | Série validée (pastille ✓ + filet gauche 3 px) |
| `danger` | `#B3261E` | `#FF7A66` | Série abandonnée, séance annulée |

Contraste : tout texte de contenu ≥ 4,5:1 sur son fond. Ne pas assombrir `muted` / `planned` en dessous de ces valeurs — c'est le barré, la pastille et l'étiquette qui portent la mise en retrait, **jamais la luminance seule**. Le seul écart toléré est l'état désactivé (`#A8AD9E` sur `#E4E7DC`).

### Typographie

Familles : **Archivo** (`expo-google-fonts/archivo`, poids 400 / 700 / 800 / 900) et **JetBrains Mono** (`expo-google-fonts/jetbrains-mono`, 400 / 800) pour **toutes les valeurs numériques**, en chiffres tabulaires (`font-variant-numeric: tabular-nums` → `fontVariant: ['tabular-nums']`).

| Nom | Taille / interligne | Poids | Usage |
|---|---|---|---|
| `display` | 44 / 43 | 900, `letter-spacing -0.035em`, capitales | Nom de l'exercice en cours |
| `title` | 26 / 30 | 800, `-0.02em` | Titre d'écran (Historique, Exercices…) |
| `heading` | 20 / 26 | 800 | Nom d'entraînement, titre de carte |
| `body` | 16 / 24 | 400–700 | Corps, libellés de bouton secondaire |
| `label` | 12 / 16 | 700, `letter-spacing 1.2px`, capitales | Sur-titres de section, statuts |
| `value` | 22 / 26 | 800, mono | Valeur réalisée dans une ligne de série |
| `timer` | 52 / 52 | 800, mono, `-0.05em` | Chrono de repos |

Unités (`kg`, `s hold`, `reps`) : 12–13 px, poids 400, couleur `muted`, dans un span imbriqué avec `white-space: nowrap` sur le conteneur.

### Espacement, rayons, cibles

- Espacement base 4 : `4 · 8 · 12 · 16 · 20 · 24 · 32`
- Rayons : `sm 6` · `md 12` · `lg 14` · `xl 18` · `full 999`
- Cibles tactiles : **48 pt minimum**. Action principale : 60 pt (`action`), 68 pt (`action-xl`), 84 pt pour « Terminer la série » (état B, action unique).
- Padding d'écran horizontal : 20 pt. Bloc d'action bas : `padding 16 20 12`, poussé en bas par `marginTop: auto`.

### `tailwind.config.js`

```js
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary:      { DEFAULT: '#BFF04A', ink: '#46600F', soft: '#E7F3C8', pressed: '#A6D63F' },
        background:   { DEFAULT: '#F6F7F3', dark: '#0E0F0D' },
        surface:      { DEFAULT: '#FFFFFF', dark: '#191B17' },
        'surface-alt':{ DEFAULT: '#EDEFE8', dark: '#141613' },
        border:       { DEFAULT: '#DDE0D6', dark: '#2A2D28', strong: '#C3C8B8' },
        text:         { DEFAULT: '#14160F', dark: '#F2F4EF' },
        muted:        { DEFAULT: '#5F6459', dark: '#8B9086' },
        planned:      { DEFAULT: '#A8AD9E', dark: '#8B9086' },
        success:      { DEFAULT: '#1B7A45', dark: '#4FD68A' },
        danger:       { DEFAULT: '#B3261E', dark: '#FF7A66' },
      },
      fontFamily: {
        sans: ['Archivo_400Regular', 'Archivo_700Bold', 'Archivo_800ExtraBold', 'Archivo_900Black'],
        mono: ['JetBrainsMono_400Regular', 'JetBrainsMono_800ExtraBold'],
      },
      fontSize: {
        label:   ['12px', { lineHeight: '16px', letterSpacing: '1.2px' }],
        body:    ['16px', { lineHeight: '24px' }],
        heading: ['20px', { lineHeight: '26px' }],
        title:   ['26px', { lineHeight: '30px' }],
        display: ['44px', { lineHeight: '43px' }],
        timer:   ['52px', { lineHeight: '52px' }],
        value:   ['22px', { lineHeight: '26px' }],
      },
      spacing: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 },
      borderRadius: { sm: 6, md: 12, lg: 14, xl: 18, full: 999 },
      minHeight: { touch: 48, action: 60, 'action-xl': 68 },
    },
  },
  plugins: [],
};
```

Consommation : `bg-surface dark:bg-surface-dark`, `text-muted dark:text-muted-dark`, etc.

---

## Composants

### `Button` (cva)

Variantes × tailles, toutes centrées, `borderRadius` selon la taille.

| Variante | Fond | Texte | Bordure |
|---|---|---|---|
| `primary` | `#BFF04A` | `#14160F`, 900, capitales | — |
| `secondary` | `surface` | `text`, 700 | 1,5 px `border.strong` |
| `ghost` | transparent | `muted`, 600 | — |
| `danger` | `#2A1A16` (sombre) / `#FDF1F0` (clair) | `danger`, 700 | 1,5 px `#5C332B` / `#EAB9B5` |

| Taille | Hauteur | Rayon | Corps |
|---|---|---|---|
| `xl` | 68 (84 pour l'action unique de l'état B) | 18 | 22–24, 900 |
| `lg` | 60 | 18 | 19, 900 |
| `md` | 48–52 | 14 | 16, 700–800 |

États : pressé → fond `primary.pressed` (ou opacité 0,9 via `Animated`) ; désactivé → fond `#E4E7DC` / texte `#A8AD9E`.

### `Card`

Trois densités : titrée (`padding 16`, rayon 16), de liste (`padding 13/14`, rayon 14), accentuée (rayon 16 + `borderLeftWidth: 3`). Fond `surface`, bordure 1 px `border`.

### `Collapsible`

En-tête cliquable ≥ 56 pt : nom à gauche (17, 700), compteur + chevron à droite (mono 13, `muted`). Corps = liste de séries cibles. **Ne pas animer une hauteur inconnue** : animer opacité + translation, ou monter/démonter sans animation.

### `NumberField`

Hauteur 56, rayon 14, fond `surface`, bordure 1,5 px. Trois zones en `space-between` : `−` (20, `muted`), valeur (mono 20, 800, tabulaire, `white-space: nowrap`), `+` (20, `muted`). **Bordure et valeur passent à `primary.ink` dès que la valeur diffère du prévu** — c'est le signal qui déclenche l'apparition du bouton « Corriger ».

### `Timer`

Mono 52, poids 800, `letter-spacing -0.05em`, couleur `primary.ink`, format `mm:ss`, `nowrap`. Sur-titre « REPOS » en `label` au-dessus. Compte **depuis la fin de la série** (croissant, pas de décompte).

### `SetRow` — trois états

| État | Fond | Filet gauche | Pastille | Valeur | Étiquette |
|---|---|---|---|---|---|
| Validée | `surface` | 3 px `success` | ✓ pleine `success`, texte `#0E0F0D` | mono 22, 800, `text` | — |
| Abandonnée | `surface-alt` | — | ✕ contour `danger` | mono 17, `muted`, **barré** | « abandonnée » en `danger` 12 |
| Prévue | transparent | — | cercle pointillé | mono 17, `muted` | « prévu » en `label`, `planned` |
| En cours | `surface` | bordure 1,5 px `primary.ink` tout autour | cercle 2 px `primary.ink` | mono 17, `muted` | « en cours » en `primary.ink` |

Hauteur 56–60. Index de série à gauche : mono 13, `muted`, largeur fixe 16.

### `ScreenHeader` — trois variantes

1. **Titre de section** : titre `title` + sous-titre mono 12 `muted`.
2. **Retour** : bouton 48 × 48 (rayon 14, fond `surface-alt`, glyphe `←`) + titre `heading` + sous-titre.
3. **Séance** : nom d'entraînement en `label` capitales `primary.ink`, position (« exercice 1/3 · série 3 sur 3 ») en mono 12 `muted`, bouton menu 48 × 48 à droite.

### `TabBar`

Quatre onglets : Séance (`◉`), Historique (`◷`), Exercices (`≡`), Entraîn. (`▦`). Fond `surface-alt`, `padding: 8 0 18`. Actif : `primary.ink` + label 700 ; inactif : `muted`. Glyphe 17, label 11.

### `EmptyState`

Cadre pointillé 1 px `border.strong`, rayon 18, centré, `padding 26–34 / 20` : cercle pointillé 40 (optionnel), titre 17–19 / 800, phrase 13–14 `muted` (`maxWidth` ~250), action optionnelle ≥ 48.

### `BusinessNotice` (refus métier)

Fond `#1D1F1A` (sombre), `borderLeftWidth: 3` `primary.ink`, rayon 16, `padding 14`, glyphe `ⓘ` `primary.ink`, message 15 / 700 + précision 13 `muted`. **Ancré juste au-dessus du bloc d'action, jamais en modale, jamais en rouge** : c'est une information, pas une panne. Texte en français, formulé comme un refus métier : « Termine l'exercice en cours avant d'en commencer un autre ».

---

## Écrans

### 1. Séance en cours — trois états successifs

Un seul écran, trois états. Chaque état ne montre que ce qui sert à ce moment. **Aucun défilement pendant l'effort** : tout tient dans 844 pt, les actions occupent la moitié basse.

Structure commune, de haut en bas : `ScreenHeader` variante séance → nom de l'exercice en `display` (capitales, 2 lignes max) → liste de séries (`SetRow`, repliable) → `marginTop: auto` → bloc d'action → `TabBar`.

**État A — prêt à démarrer une série**
- Sous le nom : rappel des mesures en mono 13 `muted` (« reps · poids »).
- Liste : séries validées, abandonnées, et celles encore prévues.
- Deux actions empilées : `Button primary xl` « SÉRIE 3 » (68 pt), puis `Button secondary md` « Exercice suivant » (52 pt).

**État B — série en cours**
- Même en-tête, même liste ; la série courante prend l'état « en cours ».
- Sous le nom : pastille pleine `primary.soft` + point `primary.ink`, « SÉRIE 3 EN COURS ».
- **Une seule action, 84 pt** : « TERMINER LA SÉRIE 3 ». Aucun champ de saisie.

**État C — repos**
- Ligne haute : `Timer` (« 01:24 ») à gauche, colonne de `NumberField` à droite (`flex: 1; minWidth: 0`, `gap: 12`) — pré-remplis avec les valeurs **prévues**, corrigeables. Sur-titre « SÉRIE 3 RÉALISÉE ».
- **Bouton « Corriger » (`primary.soft`, 48 pt) visible uniquement si au moins une valeur a changé**, suivi d'une phrase explicative 12 `muted` (« apparaît car le poids diffère du prévu (20 kg) »).
- Liste des séries validées (la série qu'on vient de valider incluse, avec sa valeur réelle).
- Deux actions : `primary xl` « SÉRIE SUIVANTE », `secondary md` « Exercice suivant ».

**Variantes de mesure de l'état C** (passage 3) :
- **Durée** : un seul `NumberField` « 08 s hold », rappel « prévu 10 s » en mono 12 `planned` en dessous.
- **Unilatéral** : chrono pleine largeur, puis deux `NumberField` côte à côte (`flex: 1` chacun) intitulés « Côté gauche » / « Côté droit » ; rappel « prévu 8 reps par côté ». Dans la liste, les séries s'affichent « 8 g · 6 d ».

Modes clair et sombre fournis pour les trois états — structure identique, seuls les rôles de couleur changent.

### 2. Aperçu d'un entraînement

En-tête retour + « Push A » + « 3 exercices · 9 séries prévues ». Liste d'exercices en `Collapsible`, **repliés par défaut** ; le premier est ouvert dans la maquette pour montrer le détail des séries cibles (mono 15, `planned`, index à gauche). Une seule action ancrée en bas : `primary xl` « DÉMARRER LA SÉANCE ». `TabBar` avec Entraîn. actif.

### 3. Historique — liste

Titre « Historique » + « 12 séances · 4 ce mois-ci ». Cartes triées **plus récente en premier**, chacune : nom (18 / 800), date + heure en mono 12 `muted`, pastille de statut (« terminée » `success` sur `#17281D` / « annulée » `danger` sur `#2A1A16`), puis une rangée de statistiques en mono 12 tabulaire, `gap: 12`, `nowrap` : durée totale, temps de repos cumulé, nombre de séries. La carte annulée se distingue **par sa pastille et sa bordure teintée `#3A2723` uniquement** — pas par une baisse de luminance du texte.

### 4. Historique — détail

En-tête retour + « Push A » + « mer. 3 sept · 18:42 · terminée ». Trois tuiles de synthèse (`flex: 1` chacune) : durée `42:10`, repos `14:20`, séries `8`. Puis, exercice par exercice (sur-titre `label`) : les séries validées en `SetRow`, **avec le temps de repos intercalé entre deux séries** — ligne discrète en retrait de 16 pt, mono 12 `muted`, glyphe `◷` (« repos 01:24 »). Les séries abandonnées apparaissent barrées avec la mention « hors décompte ».

### 5. Exercices — liste et création

**Liste** : titre + « 7 définitions · référentiel ». Cartes de liste : nom (17 / 700) + pastilles de mesures (mono 11, fond `#23261F`) ; la pastille « unilatéral » est en `primary.soft` / `primary.ink`. Action bas : `primary lg` « NOUVEL EXERCICE ».

**Création** : champ « Nom » (hauteur 56, bordure `primary.ink` au focus, curseur 2 × 24). Bloc « Mesures » avec phrase d'aide et **sélection multiple** de quatre pastilles 48 pt (répétitions, poids, durée, distance) — sélectionnée = aplat `primary` + `✓` + texte foncé ; non sélectionnée = `surface` + bordure. Interrupteur « Exercice unilatéral » (piste 56 × 32, pouce 26, `Animated` sur la translation) avec sous-titre « Saisie côté gauche / côté droit ». Actions : `primary lg` « CRÉER L'EXERCICE » + `ghost` « Annuler ».

### 6. Entraînements — liste et construction

**Liste** : titre + « 3 programmes réutilisables ». Cartes titrées : nom (20 / 800), compteur mono « 3 ex · 9 séries », liste des exercices en 13 `muted`. La première carte porte une action `primary.soft` 48 pt « Démarrer ». Action bas : `secondary lg` « Nouvel entraînement ».

**Construction** : en-tête retour + « Push A » + « valeurs cibles · aucune date ». Un `Collapsible` ouvert par exercice, contenant les séries **cibles** en cadres pointillés (étiquette « cible ») ; la série en cours de saisie prend le fond `primary.soft` + bordure `primary.ink` + étiquette « saisie ». `ghost` « + Ajouter une série » dans chaque bloc, exercices suivants repliés, puis `secondary` pointillé « + Ajouter un exercice ». Action bas : `primary lg` « ENREGISTRER ». Chaque série peut viser des valeurs différentes.

### 7. États vides et refus métier

Trois `EmptyState` empilés dans la maquette (à répartir sur leurs écrans respectifs) : « Aucune séance en cours » (+ action « Choisir un entraînement »), « Aucun entraînement » (+ « Nouvel entraînement »), « Aucun historique » (sans action). Écran « refus métier » : `BusinessNotice` inséré entre la liste et le bloc d'action, l'action secondaire refusée passant en texte `muted` sans être masquée.

---

## Interactions et comportement

- **A → B** : appui sur « Série N » → l'état bascule, la série passe « en cours », l'action devient unique.
- **B → C** : appui sur « Terminer la série N » → la série est validée avec **les valeurs prévues comme valeurs réalisées par défaut**, le chrono de repos démarre à `00:00` et compte en croissant.
- **C → A/B** : « Série suivante » repasse en A (ou directement en B selon le réglage), « Exercice suivant » avance l'index d'exercice et repasse en A.
- **Correction** : modifier un `NumberField` en état C marque la valeur comme divergente (bordure + valeur `primary.ink`) et **fait apparaître « Corriger »** ; tant qu'aucune valeur ne diffère du prévu, le bouton n'existe pas.
- **Abandon** : accessible depuis le menu de séance (`⋯`) ; la série passe barrée et **ne compte pas** dans les totaux d'historique.
- **Repli** : les listes de séries et les exercices d'un entraînement se replient. Animation : opacité + translation via `Animated`, jamais une hauteur inconnue.
- **Refus métier** : toute règle violée s'affiche en `BusinessNotice` ancré au-dessus de l'action, message en français, ton informatif.
- Pas de responsive : cible téléphone unique, 390 pt de large de référence, mise en page fluide en flex.

## Gestion d'état

Machine à états de séance : `IDLE → READY (A) → SET_RUNNING (B) → RESTING (C) → …`.

État à porter pendant une séance : `workoutId`, `sessionId`, `startedAt`, `exerciseIndex`, `setIndex`, `phase`, `restStartedAt`, `sets[]` (chaque série : `plannedValues`, `actualValues`, `status: 'validated' | 'aborted' | 'planned'`, `restSeconds`), et un dérivé `hasDivergence` qui pilote l'affichage de « Corriger ».

Persistance locale uniquement (SQLite / AsyncStorage / MMKV selon le dépôt) : aucun réseau, aucun compte. La séance en cours doit **survivre à la fermeture de l'app** — restaurer `phase` et recalculer le chrono depuis `restStartedAt`, jamais depuis un compteur en mémoire.

## Assets

Aucun asset binaire. Les glyphes de la maquette sont des substituts à remplacer par `@expo/vector-icons` :

| Maquette | Rôle | Suggestion |
|---|---|---|
| `◉` | onglet Séance | Ionicons `barbell-outline` / `radio-button-on` |
| `◷` | onglet Historique, temps de repos | Ionicons `time-outline` |
| `≡` | onglet Exercices | Feather `list` |
| `▦` | onglet Entraîn. | Feather `grid` |
| `⋯` / `⋮` | menu de séance / d'élément | Feather `more-horizontal` / `more-vertical` |
| `←` | retour | Ionicons `chevron-back` |
| `✓` / `✕` | série validée / abandonnée | Ionicons `checkmark` / `close` |
| `⌄` / `⌃` | replier / déplier | Ionicons `chevron-down` / `chevron-up` |
| `ⓘ` | refus métier | Ionicons `information-circle-outline` |
| `−` / `+` | pas de `NumberField` | Ionicons `remove` / `add` |

Polices : `@expo-google-fonts/archivo` et `@expo-google-fonts/jetbrains-mono`.

## Fichiers

- `my-gym-partner.dc.html` — la maquette complète (jetons, composants, tous les écrans, passages 1 à 3). S'ouvre dans un navigateur.
- `README.md` — ce document, autosuffisant.

## Non maquetté (à cadrer avant implémentation)

- Le **menu de séance** (`⋯`) : annuler la séance, abandonner la série, sauter un exercice.
- Les écrans secondaires (historique, exercices, entraînements) n'existent qu'en mode sombre ; leur version claire se déduit du tableau de jetons.
- Aucun écran de réglages, d'import/export ou de statistiques — hors périmètre assumé : c'est un outil qu'on utilise en faisant du sport, pas un rapport que l'on contemple.
