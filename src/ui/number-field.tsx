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
  step?: number;
};

/**
 * Saisie par pas plutôt qu'au clavier : en salle, on ajuste de quelques
 * répétitions ou de quelques kilos, on ne tape pas un nombre.
 *
 * Le champ affiche la valeur RÉELLEMENT enregistrée et l'écrit à chaque
 * ajustement : il n'y a rien à confirmer, donc rien à oublier de confirmer.
 */
export function NumberField({ value, onChange, unit, label, step = 1 }: NumberFieldProps) {
  return (
    <View className="flex-1 gap-1">
      {label && (
        <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
          {label}
        </Text>
      )}

      <View
        className={cn(
          'h-[56px] flex-row items-center justify-between rounded-lg border-2',
          'border-border bg-surface px-3 dark:border-border-dark dark:bg-surface-dark',
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
          className="font-mono-bold text-[20px] text-ink dark:text-ink-dark"
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

    </View>
  );
}

/** Évite 7.500000000000001 quand on ajoute des pas de 2,5. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
