import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { ExerciseMedia, MediaTrim } from '../domain/exercise/media';
import { Button } from './button';
import { seekOnLoad } from './trimmed-video';
import { SheetFrame } from './sheet-frame';

/**
 * Choisir le passage d'une vidéo qu'on veut revoir.
 *
 * Pas de curseur : nous n'en avons pas, et un curseur au doigt sur cinq
 * secondes de vidéo vise mal. On laisse les contrôles natifs faire l'avance
 * -- ils savent le faire -- et deux boutons capturent la position atteinte.
 * Marquer là où on est demande moins de précision que viser un point.
 */
export function TrimSheet({
  visible,
  media,
  uri,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  media: ExerciseMedia | null;
  /** L'adresse réellement lisible, résolue par l'appelant. */
  uri: string | null;
  onConfirm: (trim: MediaTrim | null) => void;
  onClose: () => void;
}) {
  if (!visible || !media || uri === null) return null;
  return (
    <Sheet media={media} uri={uri} onConfirm={onConfirm} onClose={onClose} />
  );
}

/**
 * Le contenu vit dans son propre composant : le lecteur naît d'un crochet,
 * qui ne peut pas être appelé sous une condition.
 */
function Sheet({
  media,
  uri,
  onConfirm,
  onClose,
}: {
  media: ExerciseMedia;
  uri: string;
  onConfirm: (trim: MediaTrim | null) => void;
  onClose: () => void;
}) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
  });
  const [from, setFrom] = useState<number | null>(media.trim?.from ?? null);
  const [to, setTo] = useState<number | null>(media.trim?.to ?? null);

  // Rouvrir un extrait le montre là où il commence, pas au début du fichier.
  useEffect(() => {
    const start = media.trim?.from;
    if (start === undefined) return;
    const loaded = seekOnLoad(player, start);
    return () => loaded.remove();
  }, [player, media.trim?.from]);

  const invalid = from !== null && to !== null && to <= from;

  return (
    <SheetFrame visible onClose={onClose}>
      <View className="gap-3">
        <Text className="font-extrabold text-heading text-ink dark:text-ink-dark">
          Choisir l'extrait
        </Text>
        <Text className="text-small text-muted dark:text-muted-dark">
          Avance la vidéo jusqu'au moment voulu, puis marque le début et la fin. Le fichier n'est
          pas modifié.
        </Text>

        <View className="overflow-hidden rounded-2xl bg-black">
          <VideoView player={player} style={{ width: '100%', height: 200 }} contentFit="contain" />
        </View>

        <View className="flex-row gap-2">
          <Mark label="Début ici" value={from} onPress={() => setFrom(player.currentTime)} />
          <Mark label="Fin ici" value={to} onPress={() => setTo(player.currentTime)} />
        </View>

        {invalid && (
          <Text className="text-small text-danger dark:text-danger-dark">
            La fin doit venir après le début.
          </Text>
        )}

        <View className="flex-row gap-3 pt-1">
          <Button
            label="Tout lire"
            variant="secondary"
            size="lg"
            className="flex-1"
            onPress={() => onConfirm(null)}
          />
          <Button
            label="Garder l'extrait"
            size="lg"
            className="flex-1"
            disabled={from === null || to === null || invalid}
            onPress={() => {
              if (from === null || to === null || invalid) return;
              onConfirm({ from, to });
            }}
          />
        </View>
      </View>
    </SheetFrame>
  );
}

/** Un repère posé, et l'instant qu'il retient. */
function Mark({
  label,
  value,
  onPress,
}: {
  label: string;
  value: number | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="min-h-touch flex-1 items-center justify-center rounded-lg border border-border bg-surface dark:border-border-dark dark:bg-surface-dark"
    >
      <Text className="font-bold text-body text-ink dark:text-ink-dark">{label}</Text>
      <Text className="font-mono text-caption text-muted dark:text-muted-dark">
        {value === null ? '—' : `${Math.round(value * 10) / 10} s`}
      </Text>
    </Pressable>
  );
}
