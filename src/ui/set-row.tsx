import { Ionicons } from '@expo/vector-icons';
import { Text, View, type ViewStyle } from 'react-native';
import { cn } from './cn';

export type SetRowStatus = 'completed' | 'abandoned' | 'planned' | 'in-progress';

const BORDERS: Record<SetRowStatus, ViewStyle> = {
  completed: { borderWidth: 1, borderColor: '#DDE0D6', borderLeftWidth: 3, borderLeftColor: '#1B7A45' },
  abandoned: { borderWidth: 1, borderColor: '#DDE0D6' },
  planned: { borderWidth: 1, borderColor: 'transparent' },
  'in-progress': { borderWidth: 2, borderColor: '#46600F' },
};

type SetRowProps = {
  index: number;
  status: SetRowStatus;
  /** Déjà formaté : "8 reps · 20 kg". */
  values: string;
};

/**
 * Une ligne de série. Quatre états, distingués par la pastille, le filet et
 * l'étiquette -- jamais par la seule luminance du texte, qui tomberait sous
 * le seuil de contraste lisible en salle.
 */
export function SetRow({ index, status, values }: SetRowProps) {
  return (
    <View
      className={cn(
        'min-h-[56px] flex-row items-center gap-3 rounded-lg px-3',
        status === 'completed' && 'bg-surface dark:bg-surface-dark',
        status === 'abandoned' && 'bg-surface-alt dark:bg-surface-alt-dark',
        status === 'in-progress' && 'bg-surface dark:bg-surface-dark',
      )}
      // La bordure passe en style direct : appliquée par la feuille de styles,
      // elle pouvait manquer au premier tracé d'une ligne qui vient
      // d'apparaître, et ne revenir qu'au remontage de la liste.
      style={BORDERS[status]}
    >
      <Badge status={status} />

      <Text
        className="w-4 shrink-0 font-mono text-[13px] text-muted dark:text-muted-dark"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {index}
      </Text>

      <Text
        className={cn(
          'flex-1 font-mono-bold',
          // 18 et non 22 : "12 reps · 22.5 kg" ne tient pas à côté de la
          // pastille et de l'index.
          status === 'completed' && 'text-[18px] text-ink dark:text-ink-dark',
          status !== 'completed' && 'text-[17px] text-muted dark:text-muted-dark',
          status === 'abandoned' && 'line-through',
        )}
        style={{ fontVariant: ['tabular-nums'] }}
        numberOfLines={1}
      >
        {values}
      </Text>

      {/* shrink-0 : ces mentions ne doivent jamais rogner la valeur. */}
      {status === 'abandoned' && (
        <Text className="shrink-0 font-bold text-[12px] text-danger dark:text-danger-dark">
          abandonnée
        </Text>
      )}
      {status === 'in-progress' && (
        <Text className="shrink-0 font-bold text-[12px] text-primary-ink dark:text-primary-ink-dark">
          en cours
        </Text>
      )}
    </View>
  );
}

function Badge({ status }: { status: SetRowStatus }) {
  if (status === 'completed') {
    return (
      <View className="h-[22px] w-[22px] items-center justify-center rounded-full bg-success dark:bg-success-dark">
        <Ionicons name="checkmark" size={14} color="#0E0F0D" />
      </View>
    );
  }
  if (status === 'abandoned') {
    return (
      <View className="h-[22px] w-[22px] items-center justify-center rounded-full border border-danger dark:border-danger-dark">
        <Ionicons name="close" size={12} color="#B3261E" />
      </View>
    );
  }
  return (
    <View
      className={cn(
        'h-[22px] w-[22px] rounded-full border',
        status === 'in-progress'
          ? 'border-2 border-primary-ink dark:border-primary-ink-dark'
          : 'border-dashed border-planned',
      )}
    />
  );
}
