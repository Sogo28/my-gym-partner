import { Text, View } from 'react-native';
import { cn } from './cn';

/**
 * « × 5 » : combien de fois la même série se répète (décidé le 2026-10-08).
 *
 * En couleur pour se détacher de la valeur, qu'on lirait sinon comme une
 * mesure de plus. Verte pour des séries FAITES -- la couleur des choses
 * faites --, neutre pour des séries prévues : une intention n'a pas le vert.
 */
export function RepeatBadge({ count, done }: { count: number; done: boolean }) {
  return (
    <View
      className={cn(
        'shrink-0 rounded-md px-1.5 py-0.5',
        done ? 'bg-success-soft dark:bg-success-soft-dark' : 'bg-border dark:bg-border-dark',
      )}
    >
      <Text
        className={cn(
          'font-mono-bold text-caption',
          done ? 'text-success dark:text-success-dark' : 'text-ink dark:text-ink-dark',
        )}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        × {count}
      </Text>
    </View>
  );
}
