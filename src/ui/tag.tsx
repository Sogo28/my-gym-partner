import { Text, View } from 'react-native';
import { cn } from './cn';

/**
 * Une étiquette : mesure, muscle, état. Assez petite pour qu'une carte en
 * porte plusieurs sans devenir une liste à elle seule.
 *
 * Trois variantes, parce qu'une carte d'exercice porte trois choses de nature
 * différente : ce qui le décrit techniquement (ses mesures), ce qu'il vise
 * (le muscle principal), et ce qui travaille en soutien.
 */
export type TagVariant = 'neutral' | 'accent' | 'accent-outline';

export function Tag({ label, variant = 'neutral' }: { label: string; variant?: TagVariant }) {
  return (
    <View
      className={cn(
        // Serrée : une annotation ne doit pas peser autant que ce qu'elle
        // annote. À py-1, la pastille dépassait en hauteur la ligne du titre.
        'rounded-full px-2 py-0.5',
        variant === 'neutral' && 'bg-surface-alt dark:bg-surface-alt-dark',
        variant === 'accent' && 'bg-primary-soft dark:bg-primary-soft-dark',
        variant === 'accent-outline' &&
          'border border-primary-ink/40 dark:border-primary-ink-dark/40',
      )}
    >
      <Text
        className={cn(
          // Un NOM, pas une valeur : la chasse fixe est réservée aux nombres,
          // où elle sert à aligner les colonnes. Elle n'a rien à aligner ici,
          // et ses glyphes larges font paraître la pastille plus grosse que
          // le titre qu'elle annote.
          'font-medium text-micro',
          variant === 'neutral'
            ? 'text-muted dark:text-muted-dark'
            : 'text-primary-ink dark:text-primary-ink-dark',
        )}
      >
        {label}
      </Text>
    </View>
  );
}
