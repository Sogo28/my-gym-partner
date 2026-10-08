import { Text, View } from 'react-native';

/**
 * Le rang d'une série dans une pastille ronde : « ① 12 × 17.5 kg ».
 *
 * Le rang se distingue ainsi de la valeur qu'il précède, au lieu de se lire
 * comme un chiffre de plus (« 1. 12 reps »). Le même dessin sur la fiche d'un
 * exercice et sur le bilan d'une séance.
 */
export function SetIndex({ index }: { index: number }) {
  return (
    <View className="h-5 w-5 shrink-0 items-center justify-center rounded-full bg-border dark:bg-border-dark">
      <Text
        className="font-mono-bold text-micro text-ink dark:text-ink-dark"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {index}
      </Text>
    </View>
  );
}
