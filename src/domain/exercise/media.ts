import { DomainError } from '../domain-error';

/**
 * Un média rattaché à un exercice : une démonstration à revoir avant de s'y
 * mettre.
 *
 * Deux natures dès maintenant, même si une seule est offerte : un LIEN vit
 * ailleurs -- YouTube, un réel Instagram -- et suit l'exercice partout, y
 * compris dans une sauvegarde ; un FICHIER vit sur ce téléphone-ci, et n'en
 * sortira pas. Les distinguer dès le premier jour évite d'avoir à deviner
 * plus tard ce qu'une adresse désigne.
 */
export type MediaKind = 'link' | 'file';

export type ExerciseMedia = {
  readonly kind: MediaKind;
  /** L'adresse du lien, ou le nom du fichier dans le stockage de l'app. */
  readonly uri: string;
  /** Ce qu'on en dit ; à défaut, l'affichage se rabat sur la source. */
  readonly label: string | null;
};

export function normalizeMedia(media: readonly ExerciseMedia[]): readonly ExerciseMedia[] {
  const seen = new Set<string>();

  return media.map((item) => {
    const uri = item.uri.trim();

    if (item.kind === 'link' && !/^https?:\/\/\S+$/i.test(uri)) {
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
    return { kind: item.kind, uri, label: label ? label : null };
  });
}

/**
 * De quoi nommer un lien qu'on n'a pas pris la peine d'intituler : son
 * domaine. « youtube.com » en dit assez pour reconnaître ce qu'on va ouvrir.
 */
export function sourceOf(media: ExerciseMedia): string {
  if (media.kind === 'file') return 'vidéo enregistrée';
  return /^https?:\/\/(?:www\.)?([^/:]+)/i.exec(media.uri)?.[1] ?? media.uri;
}
