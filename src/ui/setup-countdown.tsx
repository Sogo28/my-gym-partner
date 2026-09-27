import { Text, View } from 'react-native';
import { Button } from './button';

/**
 * Le décompte avant le premier round d'un EMOM.
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
  exerciseName,
  onCancel,
}: {
  remainingSeconds: number;
  exerciseName: string;
  onCancel: () => void;
}) {
  return (
    <View className="absolute inset-0 items-center justify-center gap-5 bg-background px-5 dark:bg-background-dark">
      <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
        Mise en place
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
        {exerciseName} · le premier round part à zéro
      </Text>

      <View className="pt-2">
        <Button label="Annuler" variant="secondary" size="lg" onPress={onCancel} />
      </View>
    </View>
  );
}
