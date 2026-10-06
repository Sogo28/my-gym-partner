import { useEffect, useState } from 'react';
import { isRemote, type ExerciseMedia } from '../domain/exercise/media';
import { cachedImage, mediaUri } from '../use-cases/media-actions';

/**
 * L'adresse à afficher pour une image d'exercice, d'ici ou d'ailleurs.
 *
 * Une image venue d'ailleurs est copiée au passage dans le stockage du
 * téléphone, et ne s'affiche qu'une fois là : la suivante s'affichera sans
 * réseau. En attendant, null -- et sans réseau, null aussi : ce n'est pas une
 * erreur à annoncer, c'est une image qui arrivera la prochaine fois.
 */
export function useMediaImage(media: ExerciseMedia | undefined): string | null {
  const local = media && !isRemote(media) ? mediaUri(media) : null;
  const [cached, setCached] = useState<string | null>(null);

  useEffect(() => {
    setCached(null);
    if (!media || !isRemote(media)) return;
    let current = true;
    cachedImage(media.uri)
      .then((path) => {
        if (current) setCached(path);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [media?.uri]); // eslint-disable-line react-hooks/exhaustive-deps

  return local ?? cached;
}
