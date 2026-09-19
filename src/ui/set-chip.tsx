import { Pressable, Text, View } from 'react-native';
import { cn } from './cn';
import type { SetRowStatus } from './set-row';

/**
 * Une série en pastille. Une rangée de pastilles tient sur une ligne là où la
 * liste détaillée prend toute la hauteur de l'écran -- et se lit d'un coup
 * d'oeil, ce qui compte quand on la consulte entre deux séries.
 *
 * Elle se tape comme la ligne détaillée qu'elle remplace : replier la liste
 * fait gagner de la place, ça ne retire pas le droit de corriger une série.
 */
export function SetChip({
  index,
  status,
  values,
  onPress,
  selected = false,
}: {
  index: number;
  status: SetRowStatus;
  values: string;
  /** Fourni : la pastille ouvre l'ajustement de cette série. */
  onPress?: () => void;
  selected?: boolean;
}) {
  // Pas de zone interactive là où il n'y a rien à ouvrir -- même partage que
  // pour la ligne détaillée.
  const Chip = onPress ? Pressable : View;

  return (
    <Chip
      onPress={onPress}
      className={cn(
        'h-10 flex-row items-center gap-1.5 rounded-full border px-3',
        status === 'completed' &&
          'border-success bg-surface dark:border-success-dark dark:bg-surface-dark',
        status === 'abandoned' &&
          'border-border bg-surface-alt dark:border-border-dark dark:bg-surface-alt-dark',
        status === 'planned' && 'border-dashed border-planned bg-transparent',
        status === 'in-progress' &&
          'border-2 border-primary-ink bg-surface dark:border-primary-ink-dark dark:bg-surface-dark',
        // Ouverte à l'ajustement, elle se montre comme celle qu'on est en
        // train de faire.
        selected &&
          'border-2 border-primary-ink bg-primary-soft dark:border-primary-ink-dark dark:bg-primary-soft-dark',
      )}
    >
      <Text
        className={cn(
          'font-mono text-caption',
          status === 'completed'
            ? 'text-success dark:text-success-dark'
            : 'text-muted dark:text-muted-dark',
        )}
      >
        {index}
      </Text>
      <Text
        className={cn(
          'font-mono-bold text-body',
          status === 'completed' ? 'text-ink dark:text-ink-dark' : 'text-muted dark:text-muted-dark',
          status === 'abandoned' && 'line-through',
        )}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {values}
      </Text>
    </Chip>
  );
}
