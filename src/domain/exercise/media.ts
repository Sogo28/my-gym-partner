import { DomainError } from '../domain-error';

/**
 * Un média rattaché à un exercice : une démonstration à revoir avant de s'y
 * mettre.
 *
 * Le genre dit CE QUE C'EST, pas où ça vit : une image ou une vidéo. Où elle
 * vit se lit dans son adresse -- `https://` désigne un ailleurs qu'on met en
 * cache, tout le reste est un fichier de ce téléphone. Les deux questions
 * étaient confondues et se gênaient : une illustration importée et une photo
 * prise soi-même sont la même chose pour qui la regarde.
 */
export type MediaKind = 'image' | 'video';

/**
 * Les bornes de lecture d'une vidéo, en secondes.
 *
 * Le fichier n'est PAS recoupé : on retient où commencer et où s'arrêter. La
 * découpe réelle demanderait de ré-encoder la vidéo -- irréversible, et hors
 * de portée sans module natif.
 */
export type MediaTrim = { readonly from: number; readonly to: number };

export type ExerciseMedia = {
  readonly kind: MediaKind;
  /** Une adresse `https://`, ou le nom d'un fichier du stockage de l'app. */
  readonly uri: string;
  /** Ce qu'on en dit ; à défaut, l'affichage se rabat sur sa nature. */
  readonly label: string | null;
  /** Null : la vidéo entière. Sur une image, toujours null. */
  readonly trim: MediaTrim | null;
};

/** Vit-il ailleurs ? Son adresse suffit à le dire, aucune colonne nécessaire. */
export function isRemote(media: ExerciseMedia): boolean {
  return /^https?:\/\//i.test(media.uri);
}

export function normalizeMedia(media: readonly ExerciseMedia[]): readonly ExerciseMedia[] {
  const seen = new Set<string>();

  return media.map((item) => {
    const uri = item.uri.trim();
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

/** De quoi nommer un média qu'on n'a pas pris la peine d'intituler. */
export function sourceOf(media: ExerciseMedia): string {
  if (media.kind === 'video') return 'vidéo';
  return isRemote(media) ? 'illustration' : 'photo';
}

/** Des bornes n'ont de sens que sur une vidéo : une image n'a pas de durée. */
function normalizeTrim(media: ExerciseMedia): MediaTrim | null {
  if (media.trim === null || media.trim === undefined) return null;

  if (media.kind !== 'video') {
    throw new DomainError("Une image n'a pas de durée : elle ne se borne pas.");
  }
  if (media.trim.from < 0 || media.trim.to <= media.trim.from) {
    throw new DomainError('La fin d un extrait doit venir après son début.');
  }

  return { from: media.trim.from, to: media.trim.to };
}

/** « extrait de 4,6 s » : la durée retenue, pas ses bornes. */
export function trimLabel(trim: MediaTrim): string {
  const seconds = Math.round((trim.to - trim.from) * 10) / 10;
  return `extrait de ${seconds} s`;
}
