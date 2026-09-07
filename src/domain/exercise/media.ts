import { DomainError } from '../domain-error';

/**
 * Un média rattaché à un exercice : une démonstration à revoir avant de s'y
 * mettre.
 *
 * Trois natures. Un LIEN vit ailleurs -- YouTube, un réel Instagram -- et
 * s'ouvre dans l'application d'origine. Une IMAGE vit ailleurs aussi, mais
 * s'affiche ici, recopiée au passage : son adresse reste la vérité, la copie
 * n'est qu'un cache, et une sauvegarde restaurée sur un autre téléphone la
 * retrouve donc toute seule. Un FICHIER, lui, vit sur ce téléphone-ci et n'en
 * sortira pas.
 */
export type MediaKind = 'link' | 'file' | 'image';

/**
 * Les bornes de lecture d'un fichier, en secondes.
 *
 * Le fichier n'est PAS recoupé : on retient où commencer et où s'arrêter. La
 * découpe réelle demanderait de ré-encoder la vidéo -- irréversible, et hors
 * de portée sans module natif.
 */
export type MediaTrim = { readonly from: number; readonly to: number };

export type ExerciseMedia = {
  readonly kind: MediaKind;
  /** L'adresse du lien, ou le nom du fichier dans le stockage de l'app. */
  readonly uri: string;
  /** Ce qu'on en dit ; à défaut, l'affichage se rabat sur la source. */
  readonly label: string | null;
  /** Null : la vidéo entière. Sur un lien, toujours null. */
  readonly trim: MediaTrim | null;
};

export function normalizeMedia(media: readonly ExerciseMedia[]): readonly ExerciseMedia[] {
  const seen = new Set<string>();

  return media.map((item) => {
    const uri = item.uri.trim();

    // Un lien comme une image désignent un ailleurs : sans schéma, ni le
    // téléphone ni nous ne saurions où aller le chercher.
    if (item.kind !== 'file' && !/^https?:\/\/\S+$/i.test(uri)) {
      // Sans schéma, le téléphone ne saurait pas quelle application ouvrir :
      // le lien échouerait en silence, longtemps après la saisie.
      throw new DomainError('Un lien doit commencer par http:// ou https://');
    }
    if (uri.length === 0) {
      throw new DomainError('Un média doit avoir une adresse.');
    }
    if (seen.has(uri)) {
      throw new DomainError('Ce média est déjà rattaché à cet exercice.');
    }
    seen.add(uri);

    const label = item.label?.trim();
    return { kind: item.kind, uri, label: label ? label : null, trim: normalizeTrim(item) };
  });
}

/**
 * De quoi nommer un lien qu'on n'a pas pris la peine d'intituler : son
 * domaine. « youtube.com » en dit assez pour reconnaître ce qu'on va ouvrir.
 */
export function sourceOf(media: ExerciseMedia): string {
  if (media.kind === 'file') return 'vidéo enregistrée';
  if (media.kind === 'image') return 'illustration';
  return /^https?:\/\/(?:www\.)?([^/:]+)/i.exec(media.uri)?.[1] ?? media.uri;
}

/**
 * Des bornes n'ont de sens que sur un fichier : la lecture d'un lien se passe
 * dans une autre application, où nous n'avons pas la main.
 */
function normalizeTrim(media: ExerciseMedia): MediaTrim | null {
  if (media.trim === null || media.trim === undefined) return null;

  if (media.kind === 'link') {
    throw new DomainError('Un lien externe se lit en entier : nous ne le pilotons pas.');
  }
  if (media.kind === 'image') {
    throw new DomainError("Une image n'a pas de durée : elle ne se borne pas.");
  }
  if (media.trim.from < 0 || media.trim.to <= media.trim.from) {
    throw new DomainError('La fin d un extrait doit venir après son début.');
  }

  return { from: media.trim.from, to: media.trim.to };
}

/** « 3,2 s → 7,8 s », ou la durée retenue quand on n'a pas la place. */
export function trimLabel(trim: MediaTrim): string {
  const seconds = Math.round((trim.to - trim.from) * 10) / 10;
  return `extrait de ${seconds} s`;
}
