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
  /**
   * Version basse, pour une LIGNE de champs : en construisant un
   * entraînement, on empile quatre séries de deux valeurs -- à pleine
   * hauteur, la page ne montrerait plus qu'un exercice à la fois.
   */
  compact?: boolean;
};

/**
 * Saisie par pas plutôt qu'au clavier : en salle, on ajuste de quelques
 * répétitions ou de quelques kilos, on ne tape pas un nombre.
 *
 * Le champ affiche la valeur RÉELLEMENT enregistrée et l'écrit à chaque
 * ajustement : il n'y a rien à confirmer, donc rien à oublier de confirmer.
 */
export function NumberField({
  value,
  onChange,
  unit,
  label,
  step = 1,
  compact = false,
}: NumberFieldProps) {
  return (
    <View className="flex-1 gap-1">
      {label && (
        <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
          {label}
        </Text>
      )}

      <View
        className={cn(
          'flex-row items-center justify-between rounded-lg border-2',
          'border-border bg-surface px-3 dark:border-border-dark dark:bg-surface-dark',
          compact ? 'h-[40px] px-2' : 'h-[56px]',
        )}
      >
        <Pressable
          onPress={() => onChange(Math.max(0, round(value - step)))}
          hitSlop={10}
          className={cn('items-center justify-center', compact ? 'h-8 w-7' : 'h-10 w-8')}
        >
          <Ionicons name="remove" size={compact ? 17 : 20} color="#8B9086" />
        </Pressable>

        <Text
          className={cn(
            'font-mono-bold text-ink dark:text-ink-dark',
            compact ? 'text-[15px]' : 'text-[20px]',
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
          className={cn('items-center justify-center', compact ? 'h-8 w-7' : 'h-10 w-8')}
        >
          <Ionicons name="add" size={compact ? 17 : 20} color="#8B9086" />
        </Pressable>
      </View>

    </View>
  );
}

/** Évite 7.500000000000001 quand on ajoute des pas de 2,5. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
