import { Text, View } from 'react-native';
import { cn } from './cn';
import type { SetRowStatus } from './set-row';

/**
 * Une série en pastille. Une rangée de pastilles tient sur une ligne là où la
 * liste détaillée prend toute la hauteur de l'écran -- et se lit d'un coup
 * d'oeil, ce qui compte quand on la consulte entre deux séries.
 */
export function SetChip({
  index,
  status,
  values,
}: {
  index: number;
  status: SetRowStatus;
  values: string;
}) {
  return (
    <View
      className={cn(
        'h-10 flex-row items-center gap-1.5 rounded-full border px-3',
        status === 'completed' &&
          'border-success bg-surface dark:border-success-dark dark:bg-surface-dark',
        status === 'abandoned' &&
          'border-border bg-surface-alt dark:border-border-dark dark:bg-surface-alt-dark',
        status === 'planned' && 'border-dashed border-planned bg-transparent',
        status === 'in-progress' &&
          'border-[1.5px] border-primary-ink bg-surface dark:border-primary-ink-dark dark:bg-surface-dark',
      )}
    >
      <Text
        className={cn(
          'font-mono text-[11px]',
          status === 'completed'
            ? 'text-success dark:text-success-dark'
            : 'text-muted dark:text-muted-dark',
        )}
      >
        {index}
      </Text>
      <Text
        className={cn(
          'font-mono-bold text-[14px]',
          status === 'completed' ? 'text-ink dark:text-ink-dark' : 'text-muted dark:text-muted-dark',
          status === 'abandoned' && 'line-through',
        )}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {values}
      </Text>
    </View>
  );
}
