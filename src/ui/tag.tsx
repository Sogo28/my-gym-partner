import { Text, View } from 'react-native';
import { cn } from './cn';

/**
 * Une étiquette : mesure, muscle, état. Assez petite pour qu'une carte en
 * porte plusieurs sans devenir une liste à elle seule.
 *
 * `accent` distingue ce qui qualifie l'exercice (les muscles) de ce qui le
 * décrit techniquement (ses mesures).
 */
export function Tag({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <View
      className={cn(
        'rounded-full px-2.5 py-1',
        accent ? 'bg-primary-soft dark:bg-primary-soft-dark' : 'bg-surface-alt dark:bg-surface-alt-dark',
      )}
    >
      <Text
        className={cn(
          'font-mono text-[11px]',
          accent ? 'text-primary-ink dark:text-primary-ink-dark' : 'text-muted dark:text-muted-dark',
        )}
      >
        {label}
      </Text>
    </View>
  );
}
