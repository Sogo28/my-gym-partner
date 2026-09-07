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
        'rounded-full px-2.5 py-1',
        variant === 'neutral' && 'bg-surface-alt dark:bg-surface-alt-dark',
        variant === 'accent' && 'bg-primary-soft dark:bg-primary-soft-dark',
        variant === 'accent-outline' &&
          'border border-primary-ink/40 dark:border-primary-ink-dark/40',
      )}
    >
      <Text
        className={cn(
          'font-mono text-[11px]',
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
