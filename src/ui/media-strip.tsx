import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { isRemote, sourceOf, type ExerciseMedia } from '../domain/exercise/media';
import { cachedImage, mediaUri } from '../use-cases/media-actions';
import { TrimmedVideo } from './trimmed-video';

/**
 * La bande des démonstrations : ce qu'on vient revoir avant de s'y mettre.
 *
 * Horizontale, et de taille fixe : trois vignettes tiennent à l'écran, les
 * suivantes se font défiler. Empilées, deux illustrations et une vidéo
 * repoussaient tout le reste de la page hors de vue.
 */
export function MediaStrip({
  media,
  active = true,
  onRemove,
  onPress,
}: {
  media: readonly ExerciseMedia[];
  /** Faux quand l'écran n'est plus affiché : les vidéos s'arrêtent. */
  active?: boolean;
  /** Fourni : chaque vignette porte sa croix de retrait. */
  onRemove?: (media: ExerciseMedia) => void;
  onPress?: (media: ExerciseMedia) => void;
}) {
  if (media.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 pr-4"
    >
      {media.map((item) => (
        <View key={item.uri} className="w-[200px]">
          {item.kind === 'video' ? (
            <VideoThumb media={item} active={active} onPress={() => onPress?.(item)} />
          ) : (
            <ImageThumb media={item} onPress={() => onPress?.(item)} />
          )}

          {onRemove && (
            <Pressable
              onPress={() => onRemove(item)}
              hitSlop={8}
              className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-black/60"
            >
              <Ionicons name="close" size={16} color="#F2F4EF" />
            </Pressable>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

/** Une image, d'ici ou d'ailleurs : dans le second cas, copiée au passage. */
function ImageThumb({ media, onPress }: { media: ExerciseMedia; onPress?: () => void }) {
  const [uri, setUri] = useState<string | null>(isRemote(media) ? null : mediaUri(media));

  useEffect(() => {
    if (!isRemote(media)) return;
    let current = true;
    cachedImage(media.uri)
      .then((path) => {
        if (current) setUri(path);
      })
      // Sans réseau, l'illustration manque : ce n'est pas une erreur à
      // annoncer, c'est une image qui arrivera la prochaine fois.
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [media]);

  return (
    <Pressable
      onPress={onPress}
      className="h-[150px] overflow-hidden rounded-2xl bg-surface-alt dark:bg-surface-alt-dark"
    >
      {uri && <Image source={{ uri }} style={{ width: '100%', height: 150 }} resizeMode="cover" />}
    </Pressable>
  );
}

function VideoThumb({
  media,
  active,
  onPress,
}: {
  media: ExerciseMedia;
  active: boolean;
  onPress?: () => void;
}) {
  return (
    <View className="h-[150px]">
      <TrimmedVideo uri={mediaUri(media)} trim={media.trim} active={active} height={150} />
      {onPress && (
        // Sur une vidéo, le tap appartient au lecteur : le réglage de
        // l'extrait passe par une mention, pas par la vignette entière.
        <Pressable onPress={onPress} className="absolute bottom-2 left-2 rounded-full bg-black/60 px-3 py-1">
          <Text className="text-[11px] text-[#F2F4EF]">
            {media.trim ? 'extrait' : sourceOf(media)}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
