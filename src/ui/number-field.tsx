import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { cn } from './cn';

type NumberFieldProps = {
  value: number;
  onChange: (value: number) => void;
  /** L'unité affichée sous la valeur : reps, kg, s... */
  unit: string;
  /** Titre au-dessus du champ (« Côté gauche », « Poids »...). */
  label?: string;
  /** La valeur prévue : sert à signaler une divergence. */
  planned?: number;
  step?: number;
};

/**
 * Saisie par pas plutôt qu'au clavier : en salle, on ajuste de quelques
 * répétitions ou de quelques kilos, on ne tape pas un nombre.
 *
 * La bordure et la valeur passent à l'accent dès que la valeur diffère du
 * prévu. C'est ce même signal qui fait apparaître le bouton « Corriger ».
 */
export function NumberField({
  value,
  onChange,
  unit,
  label,
  planned,
  step = 1,
}: NumberFieldProps) {
  const diverges = planned !== undefined && value !== planned;

  return (
    <View className="flex-1 gap-1">
      {label && (
        <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
          {label}
        </Text>
      )}

      <View
        className={cn(
          'h-[56px] flex-row items-center justify-between rounded-lg border-[1.5px] bg-surface px-3 dark:bg-surface-dark',
          diverges
            ? 'border-primary-ink dark:border-primary-ink-dark'
            : 'border-border dark:border-border-dark',
        )}
      >
        <Pressable
          onPress={() => onChange(Math.max(0, round(value - step)))}
          hitSlop={10}
          className="h-10 w-8 items-center justify-center"
        >
          <Ionicons name="remove" size={20} color="#8B9086" />
        </Pressable>

        <Text
          className={cn(
            'font-mono-bold text-[20px]',
            diverges ? 'text-primary-ink dark:text-primary-ink-dark' : 'text-ink dark:text-ink-dark',
          )}
          style={{ fontVariant: ['tabular-nums'] }}
          numberOfLines={1}
        >
          {value}
          <Text className="font-sans text-[13px] text-muted dark:text-muted-dark"> {unit}</Text>
        </Text>

        <Pressable
          onPress={() => onChange(round(value + step))}
          hitSlop={10}
          className="h-10 w-8 items-center justify-center"
        >
          <Ionicons name="add" size={20} color="#8B9086" />
        </Pressable>
      </View>

      {planned !== undefined && (
        <Text className="font-mono text-[12px] text-planned">
          prévu {planned} {unit}
        </Text>
      )}
    </View>
  );
}

/** Évite 7.500000000000001 quand on ajoute des pas de 2,5. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
