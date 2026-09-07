import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { cachedImage } from '../use-cases/media-actions';

/**
 * Une image distante, gardée sur le téléphone après la première consultation.
 *
 * Elle n'est pas téléchargée à l'import : la plupart des exercices adoptés ne
 * seront jamais ouverts, et six cents illustrations pèsent trente mégas. Elle
 * arrive quand on la regarde, et reste ensuite -- y compris hors réseau.
 */
export function RemoteImage({ uri, height = 160 }: { uri: string; height?: number }) {
  const [local, setLocal] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    cachedImage(uri)
      .then((path) => {
        if (current) setLocal(path);
      })
      // Sans réseau, l'illustration manque : ce n'est pas une erreur à
      // annoncer, c'est une image qui arrivera la prochaine fois.
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [uri]);

  return (
    <View
      className="flex-1 overflow-hidden rounded-2xl bg-surface-alt dark:bg-surface-alt-dark"
      style={{ height }}
    >
      {local && (
        <Image source={{ uri: local }} style={{ width: '100%', height }} resizeMode="contain" />
      )}
    </View>
  );
}
