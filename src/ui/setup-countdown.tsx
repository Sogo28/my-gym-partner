import { Pressable, Text, View } from 'react-native';
import { Button } from './button';
import { Checkbox } from './checkbox';

/**
 * Le décompte avant le premier round d'un EMOM -- et, depuis le 2026-10-07,
 * avant chaque série ordinaire.
 *
 * Il occupe l'écran entier, et c'est voulu : à cet instant on ne lit plus
 * rien, on range le téléphone et on marche. Un grand chiffre se voit encore
 * depuis le mur, ce qu'une pastille dans un coin ne ferait pas.
 *
 * Rien n'est écrit tant qu'il tourne -- ni séance, ni série. Annuler ne
 * laisse donc rien derrière, et c'est ce qui permet de l'offrir sans
 * confirmation.
 */
export function SetupCountdown({
  remainingSeconds,
  title,
  caption,
  onCancel,
  filming,
  onToggleFilming,
}: {
  remainingSeconds: number;
  /** « Mise en place », « Prépare-toi ». */
  title: string;
  /** Ce qui part à zéro : « Tractions · série 3 sur 4 ». */
  caption: string;
  onCancel: () => void;
  /**
   * Filmer la série qui part à zéro. Fourni pour une série ordinaire
   * seulement : un round d'EMOM ne se filme pas (voir l'écran de séance).
   */
  filming?: boolean;
  onToggleFilming?: () => void;
}) {
  return (
    <View className="absolute inset-0 items-center justify-center gap-5 bg-background px-5 dark:bg-background-dark">
      <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
        {title}
      </Text>

      <Text
        className="font-mono-bold tracking-tighter text-ink dark:text-ink-dark"
        style={{ fontSize: 112, lineHeight: 120, fontVariant: ['tabular-nums'] }}
      >
        {remainingSeconds}
      </Text>

      <Text
        className="text-center text-body text-muted dark:text-muted-dark"
        numberOfLines={2}
      >
        {caption}
      </Text>

      {/* Décidé pendant le décompte, pas avant : c'est en se mettant en
          place qu'on voit si la série vaut d'être revue. */}
      {onToggleFilming && (
        <Pressable
          onPress={onToggleFilming}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: Boolean(filming) }}
          hitSlop={8}
          className="flex-row items-center gap-2.5 py-2 active:opacity-60"
        >
          <Checkbox checked={Boolean(filming)} />
          <Text className="text-body text-ink dark:text-ink-dark">Filmer cette série</Text>
        </Pressable>
      )}

      <View className="pt-2">
        <Button label="Annuler" variant="secondary" size="lg" onPress={onCancel} />
      </View>
    </View>
  );
}
